import { logger } from "@/lib/logger";

type MetricValue = string | number | boolean | null | undefined;
type MetricFields = Record<string, MetricValue>;
type MetricLevel = "info" | "warn" | "error";

type RecordMetricOptions = {
  level?: MetricLevel;
  alert?: boolean;
};

function nowMs() {
  return Date.now();
}

function compactFields(fields: MetricFields = {}) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export function startTimer() {
  return nowMs();
}

export function elapsedMs(startedAt: number) {
  return Math.max(0, nowMs() - startedAt);
}

export function recordMetric(
  name: string,
  fields: MetricFields = {},
  options: RecordMetricOptions = {},
) {
  const level = options.level || (options.alert ? "warn" : "info");
  const payload = {
    metric: name,
    alert: Boolean(options.alert),
    ...compactFields(fields),
  };

  logger[level](`[METRIC] ${name}`, payload);
}

export function recordAlert(name: string, fields: MetricFields = {}) {
  recordMetric(name, fields, { level: "error", alert: true });
}

export function recordDurationMetric(
  name: string,
  startedAt: number,
  fields: MetricFields = {},
  options: RecordMetricOptions = {},
) {
  recordMetric(name, { ...fields, durationMs: elapsedMs(startedAt) }, options);
}

/**
 * Best-effort delivery of a human-readable alert to an external channel, in addition to
 * recordAlert()'s structured log line. Opt-in only: no-ops unless ALERT_WEBHOOK_URL is set, so it
 * never adds a network call to existing recordAlert() call sites that don't want one. The payload
 * ({ text }) is Slack-incoming-webhook-compatible; most other chat webhook integrations (Discord,
 * Mattermost, Teams-via-connector) accept the same shape or a superset of it.
 *
 * Deliberately separate from recordAlert() rather than folded into it — recordAlert() is called
 * from many unrelated code paths across the app, and none of them opted into an outbound network
 * call as a side effect of logging. Call this explicitly alongside recordAlert() at the specific
 * sites that need it (e.g. Mux cost-guardrail alerts).
 */
export async function notifyAlertWebhook(name: string, message: string, fields: MetricFields = {}): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    const lines = [`:rotating_light: *${name}*`, message];
    const details = compactFields(fields);
    if (Object.keys(details).length > 0) {
      lines.push("```" + JSON.stringify(details, null, 2) + "```");
    }

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
  } catch (error) {
    logger.warn(`[notifyAlertWebhook] Failed to deliver alert webhook for ${name}`, error);
  }
}
