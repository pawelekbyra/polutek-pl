import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeFundraisingProgress, hasFundraisingGoal, manualFundraisingProgress, pickFundraisingUpdate } from "@/lib/modules/video/domain/fundraising";

const groupBy = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { payment: { groupBy: (...args: unknown[]) => groupBy(...args) } } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import {
  __resetFundraisingTotalsCacheForTests,
  withFundraisingProgress,
} from "@/lib/modules/video/infrastructure/fundraising-progress.service";

const rates = { PLN: 1, EUR: 4, USD: 4, CHF: 4.5, GBP: 5 };
const goal = { fundraisingGoalMinor: 100_000_00, fundraisingGoalCurrency: "PLN" };

describe("computeFundraisingProgress", () => {
  it("is null without a usable goal", () => {
    expect(computeFundraisingProgress({}, [], rates)).toBeNull();
    expect(computeFundraisingProgress({ fundraisingGoalMinor: 0, fundraisingGoalCurrency: "PLN" }, [], rates)).toBeNull();
    expect(computeFundraisingProgress({ fundraisingGoalMinor: 100, fundraisingGoalCurrency: "JPY" }, [], rates)).toBeNull();
    expect(hasFundraisingGoal({ fundraisingGoalMinor: 100, fundraisingGoalCurrency: null })).toBe(false);
  });

  it("is 0 with nothing raised and floors to whole percents", () => {
    expect(computeFundraisingProgress(goal, [], rates)).toBe(0);
    expect(computeFundraisingProgress(goal, [{ currency: "PLN", netMinor: 37_999_00 }], rates)).toBe(0.37);
  });

  it("shows at least 1% for any progress and caps at 1", () => {
    expect(computeFundraisingProgress(goal, [{ currency: "PLN", netMinor: 10_00 }], rates)).toBe(0.01);
    expect(computeFundraisingProgress(goal, [{ currency: "PLN", netMinor: 99_999_99 }], rates)).toBe(0.99);
    expect(computeFundraisingProgress(goal, [{ currency: "PLN", netMinor: 250_000_00 }], rates)).toBe(1);
  });

  it("converts other currencies to the goal currency and ignores unknown/negative totals", () => {
    const totals = [
      { currency: "PLN", netMinor: 10_000_00 },
      { currency: "EUR", netMinor: 5_000_00 }, // 20 000 PLN
      { currency: "usd", netMinor: 2_500_00 }, // 10 000 PLN
      { currency: "JPY", netMinor: 999_999_00 },
      { currency: "GBP", netMinor: -500 },
    ];
    expect(computeFundraisingProgress(goal, totals, rates)).toBe(0.4);
    // Goal in EUR: 40 000 PLN raised = 10 000 EUR of a 20 000 EUR goal.
    expect(computeFundraisingProgress({ fundraisingGoalMinor: 20_000_00, fundraisingGoalCurrency: "EUR" }, totals, rates)).toBe(0.5);
  });
});

describe("withFundraisingProgress", () => {
  beforeEach(() => {
    groupBy.mockReset();
    __resetFundraisingTotalsCacheForTests();
  });

  const start = new Date("2026-09-30T00:00:00.000Z");
  const rows = [
    { id: "goal", creatorId: "c1", fundraisingGoalMinor: 1_000_00, fundraisingGoalCurrency: "PLN", fundraisingStartAt: start },
    { id: "plain", creatorId: "c1", fundraisingGoalMinor: null, fundraisingGoalCurrency: null, fundraisingStartAt: null },
  ];
  const dtos = [{ id: "goal", title: "A" }, { id: "plain", title: "B" }];

  it("adds only a fraction — no goal or raised amount ever reaches the DTO", async () => {
    groupBy.mockResolvedValueOnce([
      { currency: "PLN", _sum: { amountMinor: 600_00, refundedAmountMinor: 100_00 } },
    ]);
    groupBy.mockResolvedValueOnce([]); // no patron-zone payments
    const result = await withFundraisingProgress(dtos, rows);
    expect(result).toEqual([
      { id: "goal", title: "A", fundraisingProgress: 0.5 },
      { id: "plain", title: "B", fundraisingProgress: null },
    ]);
    const json = JSON.stringify(result);
    for (const leaked of ["fundraisingGoal", "Minor", "currency", "PLN", "60000", "100000", "amount"]) {
      expect(json).not.toContain(leaked);
    }
  });

  it("counts net successful tips since the goal start for the channel", async () => {
    groupBy.mockResolvedValue([]);
    await withFundraisingProgress(dtos, rows);
    expect(groupBy).toHaveBeenCalledTimes(2);
    const where = groupBy.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] });
    expect(where.createdAt).toEqual({ gte: start });
    expect(where.OR).toEqual([{ creatorId: "c1" }, { creatorId: null }]);
  });

  it("patron-zone payments are sales, not tips: they are subtracted from the tip bar (experiment: premium-pass)", async () => {
    groupBy.mockResolvedValueOnce([{ currency: "PLN", _sum: { amountMinor: 800_00, refundedAmountMinor: 0 } }]);
    groupBy.mockResolvedValueOnce([{ currency: "PLN", _sum: { amountMinor: 300_00, refundedAmountMinor: 0 } }]);
    const result = await withFundraisingProgress(dtos, rows);
    expect(result[0].fundraisingProgress).toBe(0.5); // (800 - 300) / 1000
    expect(groupBy.mock.calls[1][0].where.metadata).toEqual({ path: ["purpose"], equals: "premium_pass" });
    expect(groupBy.mock.calls[1][0].where.status).toEqual({ in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] });
  });

  it("caches totals between requests", async () => {
    groupBy.mockResolvedValue([]);
    await withFundraisingProgress(dtos, rows);
    await withFundraisingProgress(dtos, rows);
    expect(groupBy).toHaveBeenCalledTimes(2); // one request = the tip query + the patron-zone query, cached together
  });

  it("hides the bar (null) when the aggregate fails", async () => {
    groupBy.mockRejectedValue(new Error("db down"));
    const result = await withFundraisingProgress(dtos, rows);
    expect(result[0].fundraisingProgress).toBeNull();
  });

  it("skips the query entirely when no video has a goal", async () => {
    await withFundraisingProgress([dtos[1]], [rows[1]]);
    expect(groupBy).not.toHaveBeenCalled();
  });
});

describe("hand-set fill (fundraisingManualPercent)", () => {
  beforeEach(() => {
    groupBy.mockReset();
    __resetFundraisingTotalsCacheForTests();
  });

  it("maps whole percents to a 0..1 fraction, including the 0 and 100 bounds", () => {
    expect(manualFundraisingProgress({ fundraisingManualPercent: 65 })).toBe(0.65);
    expect(manualFundraisingProgress({ fundraisingManualPercent: 0 })).toBe(0);
    expect(manualFundraisingProgress({ fundraisingManualPercent: 100 })).toBe(1);
    expect(manualFundraisingProgress({ fundraisingManualPercent: 150 })).toBe(1);
    expect(manualFundraisingProgress({ fundraisingManualPercent: -3 })).toBe(0);
    expect(manualFundraisingProgress({ fundraisingManualPercent: null })).toBeNull();
    expect(manualFundraisingProgress({})).toBeNull();
  });

  it("overrides the goal computation and skips the payment query", async () => {
    groupBy.mockResolvedValue([{ currency: "PLN", _sum: { amountMinor: 1_000_00, refundedAmountMinor: 0 } }]);
    const rows = [
      { id: "manual", creatorId: "c1", fundraisingGoalMinor: 1_000_00, fundraisingGoalCurrency: "PLN", fundraisingManualPercent: 65 },
      { id: "zero", creatorId: "c1", fundraisingManualPercent: 0 },
      { id: "full", creatorId: "c1", fundraisingManualPercent: 100 },
    ];
    const result = await withFundraisingProgress(rows.map(({ id }) => ({ id })), rows);
    expect(result).toEqual([
      { id: "manual", fundraisingProgress: 0.65 },
      { id: "zero", fundraisingProgress: 0 },
      { id: "full", fundraisingProgress: 1 },
    ]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("falls back to the goal when the hand-set fill is off", async () => {
    groupBy.mockResolvedValueOnce([{ currency: "PLN", _sum: { amountMinor: 250_00, refundedAmountMinor: 0 } }]);
    groupBy.mockResolvedValueOnce([]);
    const rows = [{ id: "goal", creatorId: "c1", fundraisingGoalMinor: 1_000_00, fundraisingGoalCurrency: "PLN", fundraisingManualPercent: null }];
    const [dto] = await withFundraisingProgress([{ id: "goal" }], rows);
    expect(dto.fundraisingProgress).toBe(0.25);
  });

  it("is written to the video only when sent", () => {
    expect(pickFundraisingUpdate({ fundraisingManualPercent: 65 })).toEqual({ fundraisingManualPercent: 65 });
    expect(pickFundraisingUpdate({ fundraisingManualPercent: null })).toEqual({ fundraisingManualPercent: null });
    expect(pickFundraisingUpdate({})).toEqual({});
  });
});
