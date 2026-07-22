import { MuxClient } from "../infrastructure/mux.client";
import { sumDeliveryUsageFromCsv } from "../infrastructure/mux-usage-csv";
import { recordMetric, recordAlert, notifyAlertWebhook } from "@/lib/observability";
import { setNxEx } from "@/lib/rate-limit";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger("MuxUsageBudget");

// Checked from highest to lowest so a single run only ever alerts for the highest threshold it
// actually crossed today, not every lower one it passed through on a prior run.
const ALERT_THRESHOLDS = [1.0, 0.8, 0.5] as const;

// ~32 days: comfortably covers a calendar month even for the longest months, so the "already
// alerted this threshold this month" flag reliably expires before the same threshold key could
// recur next month.
const ALERT_FLAG_TTL_SECONDS = 32 * 24 * 60 * 60;
const EXPORTS_UNAVAILABLE_FLAG_TTL_SECONDS = 24 * 60 * 60;

export interface MuxUsageBudgetResult {
  checked: boolean;
  reason?: string;
  monthKey?: string;
  deliveryUnitsMonthToDate?: number;
  estimatedCostUsd?: number | null;
  minutesBudgetPct?: number | null;
  usdBudgetPct?: number | null;
  alertedThresholds?: number[];
}

function currentMonthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function startOfMonthEpochSeconds(now: Date): number {
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
}

/**
 * Daily budget check against Mux's Usage Exports API (system/v1/usage/exports). Sums delivery
 * usage for every day exported so far this month and compares it against whichever budget(s) are
 * configured, alerting once per threshold (50/80/100%) per calendar month.
 *
 * PREREQUISITES — this cannot work without manual setup, see the summary this ticket produced:
 * 1. Usage Exports must be enabled for the Mux account by contacting Mux support first — the API
 *    returns an empty/error response otherwise, which this treats as "can't check" (one alert per
 *    day, not a crash) rather than "usage is zero".
 * 2. The delivery-column detection in mux-usage-csv.ts matches by header name containing
 *    "delivery" — Mux does not publish the exact CSV schema, so verify this against a real
 *    exported CSV for this account before trusting the numbers.
 * 3. "estimatedCostUsd" is a rough estimate (deliveryUnits * MUX_COST_PER_DELIVERY_MINUTE_USD),
 *    not Mux's actual invoiced amount — real pricing has volume tiers this doesn't model. Mux's
 *    own dashboard billing alerts (see the summary) are the authoritative safety net.
 *
 * Disabled (no Mux API calls at all) unless at least one budget env var is configured.
 */
export async function checkMuxUsageBudget(now: Date = new Date()): Promise<MuxUsageBudgetResult> {
  const minutesBudget = Number(process.env.MUX_MONTHLY_DELIVERY_MINUTES_BUDGET);
  const usdBudget = Number(process.env.MUX_MONTHLY_BUDGET_USD);
  const costPerMinute = Number(process.env.MUX_COST_PER_DELIVERY_MINUTE_USD);

  const hasMinutesBudget = Number.isFinite(minutesBudget) && minutesBudget > 0;
  const hasUsdBudget = Number.isFinite(usdBudget) && usdBudget > 0 && Number.isFinite(costPerMinute) && costPerMinute > 0;

  if (!hasMinutesBudget && !hasUsdBudget) {
    return { checked: false, reason: "NO_BUDGET_CONFIGURED" };
  }

  if (!MuxClient.isConfigured()) {
    return { checked: false, reason: "MUX_NOT_CONFIGURED" };
  }

  const monthKey = currentMonthKey(now);
  const client = new MuxClient();

  let exports: Array<{ date: string; download_url: string }>;
  try {
    exports = await client.listUsageExports({
      sinceEpochSeconds: startOfMonthEpochSeconds(now),
      // "yesterday": today's export isn't generated yet.
      untilEpochSeconds: Math.floor(now.getTime() / 1000),
    });
  } catch (error) {
    logger.error("Failed to list Mux usage exports", error);
    const shouldAlert = await setNxEx(`mux:usage-exports-unavailable:${monthKey}`, "1", EXPORTS_UNAVAILABLE_FLAG_TTL_SECONDS);
    if (shouldAlert) {
      const fields = { error: error instanceof Error ? error.message : String(error) };
      recordAlert("mux.usage_budget.exports_unavailable", fields);
      await notifyAlertWebhook(
        "Mux usage budget check failed",
        "Could not list Mux usage exports — Usage Exports may not be enabled for this account yet (contact Mux support to enable it). Budget monitoring is blind until this is fixed.",
        fields,
      );
    }
    return { checked: false, reason: "EXPORTS_API_UNAVAILABLE" };
  }

  if (exports.length === 0) {
    return { checked: true, monthKey, deliveryUnitsMonthToDate: 0, estimatedCostUsd: hasUsdBudget ? 0 : null, minutesBudgetPct: hasMinutesBudget ? 0 : null, usdBudgetPct: hasUsdBudget ? 0 : null, alertedThresholds: [] };
  }

  let deliveryUnitsMonthToDate = 0;
  for (const exportEntry of exports) {
    try {
      const csvResponse = await fetch(exportEntry.download_url);
      if (!csvResponse.ok) continue;
      const csvText = await csvResponse.text();
      deliveryUnitsMonthToDate += sumDeliveryUsageFromCsv(csvText);
    } catch (error) {
      logger.warn(`Failed to download/parse usage export for ${exportEntry.date}`, error);
    }
  }

  const estimatedCostUsd = hasUsdBudget ? deliveryUnitsMonthToDate * costPerMinute : null;
  const minutesBudgetPct = hasMinutesBudget ? deliveryUnitsMonthToDate / minutesBudget : null;
  const usdBudgetPct = hasUsdBudget && estimatedCostUsd !== null ? estimatedCostUsd / usdBudget : null;
  const worstPct = Math.max(minutesBudgetPct ?? 0, usdBudgetPct ?? 0);

  recordMetric("mux.usage.month_to_date", {
    monthKey,
    deliveryUnitsMonthToDate,
    estimatedCostUsd,
    minutesBudgetPct,
    usdBudgetPct,
  });

  const alertedThresholds: number[] = [];
  for (const threshold of ALERT_THRESHOLDS) {
    if (worstPct < threshold) continue;

    const flagKey = `mux:usage-alert:${monthKey}:${threshold}`;
    const isNewAlert = await setNxEx(flagKey, "1", ALERT_FLAG_TTL_SECONDS);
    if (!isNewAlert) break; // Already alerted this (or a lower) threshold this month.

    alertedThresholds.push(threshold);
    const fields = { monthKey, threshold, deliveryUnitsMonthToDate, estimatedCostUsd, minutesBudgetPct, usdBudgetPct };
    recordAlert("mux.usage_budget.threshold_crossed", fields);
    await notifyAlertWebhook(
      "Mux monthly usage budget alert",
      `Mux delivery usage is at ${Math.round(worstPct * 100)}% of the configured monthly budget for ${monthKey}.`,
      fields,
    );
    break; // Only the highest crossed threshold needs an alert per run.
  }

  return {
    checked: true,
    monthKey,
    deliveryUnitsMonthToDate,
    estimatedCostUsd,
    minutesBudgetPct,
    usdBudgetPct,
    alertedThresholds,
  };
}
