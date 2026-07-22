import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockListUsageExports = vi.fn();
const mockSetNxEx = vi.fn();
const mockRecordMetric = vi.fn();
const mockRecordAlert = vi.fn();
const mockNotifyAlertWebhook = vi.fn();

vi.mock("@/lib/modules/video/infrastructure/mux.client", () => ({
  MuxClient: class {
    static isConfigured() {
      return true;
    }
    listUsageExports(...args: unknown[]) {
      return mockListUsageExports(...args);
    }
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  setNxEx: mockSetNxEx,
}));

vi.mock("@/lib/observability", () => ({
  recordMetric: mockRecordMetric,
  recordAlert: mockRecordAlert,
  notifyAlertWebhook: mockNotifyAlertWebhook,
}));

const ENV_KEYS = ["MUX_MONTHLY_DELIVERY_MINUTES_BUDGET", "MUX_MONTHLY_BUDGET_USD", "MUX_COST_PER_DELIVERY_MINUTE_USD"] as const;

function deliveryCsv(rows: number[]): string {
  return ["asset_id,delivery_minutes", ...rows.map((value, index) => `asset-${index},${value}`)].join("\n");
}

function mockFetchCsv(csvByUrl: Record<string, string>) {
  global.fetch = vi.fn(async (url: string) => ({
    ok: true,
    text: async () => csvByUrl[url] ?? "",
  })) as unknown as typeof fetch;
}

describe("checkMuxUsageBudget", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("is disabled (no Mux calls) when no budget env var is configured", async () => {
    const { checkMuxUsageBudget } = await import("@/lib/modules/video/application/check-mux-usage-budget.use-case");
    const result = await checkMuxUsageBudget(new Date("2026-07-15T00:00:00Z"));

    expect(result).toEqual({ checked: false, reason: "NO_BUDGET_CONFIGURED" });
    expect(mockListUsageExports).not.toHaveBeenCalled();
  });

  it("sums delivery usage across every exported day this month and stays under threshold", async () => {
    process.env.MUX_MONTHLY_DELIVERY_MINUTES_BUDGET = "1000";
    mockListUsageExports.mockResolvedValue([
      { date: "2026-07-01", download_url: "https://mux.example/day1.csv" },
      { date: "2026-07-02", download_url: "https://mux.example/day2.csv" },
    ]);
    mockFetchCsv({
      "https://mux.example/day1.csv": deliveryCsv([100, 50]),
      "https://mux.example/day2.csv": deliveryCsv([100]),
    });
    mockSetNxEx.mockResolvedValue(true);

    const { checkMuxUsageBudget } = await import("@/lib/modules/video/application/check-mux-usage-budget.use-case");
    const result = await checkMuxUsageBudget(new Date("2026-07-15T00:00:00Z"));

    expect(result.checked).toBe(true);
    expect(result.deliveryUnitsMonthToDate).toBe(250);
    expect(result.minutesBudgetPct).toBeCloseTo(0.25);
    expect(result.alertedThresholds).toEqual([]);
    expect(mockRecordAlert).not.toHaveBeenCalled();
  });

  it("alerts exactly once for the highest threshold crossed", async () => {
    process.env.MUX_MONTHLY_DELIVERY_MINUTES_BUDGET = "1000";
    mockListUsageExports.mockResolvedValue([{ date: "2026-07-01", download_url: "https://mux.example/day1.csv" }]);
    mockFetchCsv({ "https://mux.example/day1.csv": deliveryCsv([850]) });
    mockSetNxEx.mockResolvedValue(true); // not yet alerted this month

    const { checkMuxUsageBudget } = await import("@/lib/modules/video/application/check-mux-usage-budget.use-case");
    const result = await checkMuxUsageBudget(new Date("2026-07-15T00:00:00Z"));

    expect(result.alertedThresholds).toEqual([0.8]);
    expect(mockRecordAlert).toHaveBeenCalledTimes(1);
    expect(mockRecordAlert).toHaveBeenCalledWith("mux.usage_budget.threshold_crossed", expect.objectContaining({ threshold: 0.8 }));
    expect(mockNotifyAlertWebhook).toHaveBeenCalledTimes(1);
  });

  it("does not re-alert the same threshold twice in the same month", async () => {
    process.env.MUX_MONTHLY_DELIVERY_MINUTES_BUDGET = "1000";
    mockListUsageExports.mockResolvedValue([{ date: "2026-07-01", download_url: "https://mux.example/day1.csv" }]);
    mockFetchCsv({ "https://mux.example/day1.csv": deliveryCsv([850]) });
    mockSetNxEx.mockResolvedValue(false); // already alerted this threshold this month

    const { checkMuxUsageBudget } = await import("@/lib/modules/video/application/check-mux-usage-budget.use-case");
    const result = await checkMuxUsageBudget(new Date("2026-07-15T00:00:00Z"));

    expect(result.alertedThresholds).toEqual([]);
    expect(mockRecordAlert).not.toHaveBeenCalled();
  });

  it("reports EXPORTS_API_UNAVAILABLE and alerts once instead of crashing when Usage Exports isn't enabled", async () => {
    process.env.MUX_MONTHLY_DELIVERY_MINUTES_BUDGET = "1000";
    mockListUsageExports.mockRejectedValue(new Error("HTTP 404"));
    mockSetNxEx.mockResolvedValue(true);

    const { checkMuxUsageBudget } = await import("@/lib/modules/video/application/check-mux-usage-budget.use-case");
    const result = await checkMuxUsageBudget(new Date("2026-07-15T00:00:00Z"));

    expect(result).toEqual({ checked: false, reason: "EXPORTS_API_UNAVAILABLE" });
    expect(mockRecordAlert).toHaveBeenCalledWith("mux.usage_budget.exports_unavailable", expect.anything());
  });
});
