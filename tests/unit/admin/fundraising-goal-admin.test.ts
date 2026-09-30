import { describe, it, expect } from "vitest";
import { adminVideoFundraisingGoalSchema, adminVideoWriteSchema } from "@/lib/api/admin-schemas";
import { buildAdminVideoUpdatePayload, fundraisingGoalUpdateFields } from "@/lib/modules/video/application/admin-video-payload";
import { buildFundraisingPayload, fundraisingFormFields } from "@/app/admin/videos/components/video-utils";

const ok = (v: unknown) => adminVideoFundraisingGoalSchema.safeParse(v).success;

describe("admin fundraising goal validation", () => {
  it("accepts a goal, null (remove) or absent", () => {
    expect(ok({ amountMinor: 5_000_000, currency: "PLN", startAt: "2026-09-30T00:00:00.000Z" })).toBe(true);
    expect(ok({ amountMinor: 100, currency: "eur", startAt: null })).toBe(true);
    expect(ok(null)).toBe(true);
    expect(ok(undefined)).toBe(true);
  });

  it("rejects bad amounts, currencies, dates and extra fields", () => {
    expect(ok({ amountMinor: 0, currency: "PLN", startAt: null })).toBe(false);
    expect(ok({ amountMinor: -5, currency: "PLN", startAt: null })).toBe(false);
    expect(ok({ amountMinor: 10.5, currency: "PLN", startAt: null })).toBe(false);
    expect(ok({ amountMinor: 1_000_000_001, currency: "PLN", startAt: null })).toBe(false);
    expect(ok({ amountMinor: 100, currency: "JPY", startAt: null })).toBe(false);
    expect(ok({ amountMinor: 100, currency: "PLN", startAt: "yesterday" })).toBe(false);
    expect(ok({ amountMinor: 100, currency: "PLN", startAt: null, raised: 5 })).toBe(false);
    expect(adminVideoWriteSchema.safeParse({ title: "x", fundraisingGoal: { amountMinor: "a" } }).success).toBe(false);
  });

  it("maps the goal onto the video columns", () => {
    expect(fundraisingGoalUpdateFields({ amountMinor: 100, currency: "eur", startAt: "2026-09-30T00:00:00.000Z" })).toEqual({
      fundraisingGoalMinor: 100,
      fundraisingGoalCurrency: "EUR",
      fundraisingStartAt: new Date("2026-09-30T00:00:00.000Z"),
    });
    expect(fundraisingGoalUpdateFields(null)).toEqual({ fundraisingGoalMinor: null, fundraisingGoalCurrency: null, fundraisingStartAt: null });
    expect(fundraisingGoalUpdateFields(undefined)).toEqual({});
    const payload = buildAdminVideoUpdatePayload({ id: "v1", fundraisingGoal: { amountMinor: 100, currency: "PLN", startAt: null } });
    expect(payload).toMatchObject({ id: "v1", fundraisingGoalMinor: 100, fundraisingGoalCurrency: "PLN", fundraisingStartAt: null });
    expect(buildAdminVideoUpdatePayload({ id: "v1", fundraisingGoalMinor: 5 })).not.toHaveProperty("fundraisingGoalMinor");
  });
});

describe("admin fundraising form", () => {
  it("loads an existing goal and defaults a new one to today", () => {
    const loaded = fundraisingFormFields({ fundraisingGoalMinor: 5_000_000, fundraisingGoalCurrency: "EUR", fundraisingStartAt: null });
    expect(loaded).toMatchObject({ amount: "50000", currency: "EUR", startDate: "", hadGoal: true });
    const fresh = fundraisingFormFields(null);
    expect(fresh.amount).toBe("");
    expect(fresh.currency).toBe("PLN");
    expect(fresh.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fresh.hadGoal).toBe(false);
  });

  it("builds set / remove / unchanged payloads and rejects bad amounts", () => {
    const base = { currency: "PLN" as const, startDate: "", hadGoal: false };
    expect(buildFundraisingPayload({ ...base, amount: "50 000,50" })).toEqual({
      fundraisingGoal: { amountMinor: 5_000_050, currency: "PLN", startAt: null },
    });
    expect(buildFundraisingPayload({ ...base, amount: "" })).toEqual({});
    expect(buildFundraisingPayload({ ...base, amount: "", hadGoal: true })).toEqual({ fundraisingGoal: null });
    expect(buildFundraisingPayload({ ...base, amount: "abc" })).toHaveProperty("error");
    expect(buildFundraisingPayload({ ...base, amount: "0" })).toHaveProperty("error");
    expect(buildFundraisingPayload({ ...base, amount: "20000000" })).toHaveProperty("error");
    const withDate = buildFundraisingPayload({ ...base, amount: "100", startDate: "2026-09-30" });
    expect("fundraisingGoal" in withDate && withDate.fundraisingGoal?.startAt).toBe(new Date(2026, 8, 30).toISOString());
  });
});
