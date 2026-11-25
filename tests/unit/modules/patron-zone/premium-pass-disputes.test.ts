// patron zone (DP01, owner decision 2026-11-25): a payment whose dispute is open or lost gives no access; the access
// comes back by itself when the dispute is won. Pure rule + the one-query reader. Real Postgres: tests/postgres/premium-pass-disputes.pg.test.ts.
import { describe, expect, it, vi } from "vitest";
import { withoutHeldPayments, isRecordActive, passStateOf, type PassRecord } from "@/lib/modules/patron-zone/domain/pass-state";
import { applyPaymentHolds, findHeldPassPayments, PASS_HOLD_STATUSES, readEffectivePass } from "@/lib/modules/patron-zone/application/effective-pass";
import { passKey } from "@/lib/modules/patron-zone/infrastructure/pass-store";

const NOW = new Date("2026-11-25T12:00:00.000Z");
const DAY = 86_400_000;

function record(overrides: Partial<PassRecord> = {}): PassRecord {
  return {
    v: 3, provider: "STRIPE", ref: "pay_1", productId: "ACCESS_30D", priceMinor: 1499, totalMinor: 1499, currency: "PLN", method: "card",
    paymentIds: ["pay_1"], lifetime: false, lifetimePaymentId: null,
    grantedAt: new Date(NOW.getTime() - 5 * DAY).toISOString(),
    expiresAt: new Date(NOW.getTime() + 25 * DAY).toISOString(),
    consents: { termsVersion: "t", waiverAt: NOW.toISOString() },
    ...overrides,
  };
}

describe("withoutHeldPayments (pure)", () => {
  it("the only payment disputed: no access; the stored record itself is not changed", () => {
    const stored = record();
    const effective = withoutHeldPayments(stored, [{ paymentId: "pay_1", productId: "ACCESS_30D" }]);
    expect(isRecordActive(effective, NOW)).toBe(false);
    expect(stored.expiresAt).toBe(new Date(NOW.getTime() + 25 * DAY).toISOString());
  });

  it("two 30-day payments, one disputed: the other's 30 days stay", () => {
    const stored = record({ paymentIds: ["pay_1", "pay_2"], expiresAt: new Date(NOW.getTime() + 55 * DAY).toISOString() });
    const effective = withoutHeldPayments(stored, [{ paymentId: "pay_2", productId: "ACCESS_30D" }]);
    expect(effective.expiresAt).toBe(new Date(NOW.getTime() + 25 * DAY).toISOString());
    expect(passStateOf(effective, NOW).state).toBe("active");
  });

  it("a 3-month payment is measured in calendar months", () => {
    const stored = record({ paymentIds: ["pay_1", "pay_3"], expiresAt: "2027-03-20T11:00:00.000Z" });
    const effective = withoutHeldPayments(stored, [{ paymentId: "pay_3", productId: "ACCESS_LIFETIME" }]);
    expect(effective.expiresAt).toBe("2026-12-20T11:00:00.000Z");
  });

  it("ignores payments that are not part of this grant and fails closed on an unknown product", () => {
    const stored = record();
    expect(withoutHeldPayments(stored, [{ paymentId: "someone_else", productId: "ACCESS_30D" }])).toBe(stored);
    expect(isRecordActive(withoutHeldPayments(stored, [{ paymentId: "pay_1", productId: "BOGUS" }]), NOW)).toBe(false);
  });
});

function fakeDb(rows: Record<string, PassRecord>, statuses: Record<string, string>) {
  const payment = {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; status: { in: string[] } } }) =>
      where.id.in
        .filter((id) => statuses[id] !== undefined && where.status.in.includes(statuses[id]))
        .map((id) => ({ id, metadata: { purpose: "premium_pass", productId: "ACCESS_30D" } }))),
  };
  const appSetting = {
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
      const userId = Object.keys(rows).find((id) => passKey(id) === where.key);
      return userId ? { value: JSON.stringify(rows[userId]) } : null;
    }),
  };
  return { db: { appSetting, payment } as never, payment };
}

describe("readEffectivePass / applyPaymentHolds", () => {
  it("only DISPUTED and CHARGEBACK_LOST hold a payment (a partial refund does not)", () => {
    expect([...PASS_HOLD_STATUSES].sort()).toEqual(["CHARGEBACK_LOST", "DISPUTED"]);
  });

  it.each([
    ["DISPUTED", "expired"],
    ["CHARGEBACK_LOST", "expired"],
    ["SUCCEEDED", "active"],
    ["PARTIALLY_REFUNDED", "active"],
  ])("payment %s -> access %s", async (status, state) => {
    const { db } = fakeDb({ u: record() }, { pay_1: status });
    expect(passStateOf(await readEffectivePass(db, "u", NOW), NOW).state).toBe(state);
  });

  it("asks the Payment table nothing for a demo, expired or missing grant", async () => {
    const { db, payment } = fakeDb({ demo: record({ provider: "DEMO", paymentIds: [] }), old: record({ expiresAt: new Date(NOW.getTime() - DAY).toISOString() }) }, {});
    await readEffectivePass(db, "demo", NOW);
    await readEffectivePass(db, "old", NOW);
    await readEffectivePass(db, "nobody", NOW);
    expect(payment.findMany).not.toHaveBeenCalled();
  });

  it("many records cost one Payment query, and the order of the answer matches the input", async () => {
    const { db, payment } = fakeDb({}, { pay_1: "DISPUTED" });
    const out = await applyPaymentHolds(db, [record(), null, record({ paymentIds: ["pay_2"] })], NOW);
    expect(payment.findMany).toHaveBeenCalledTimes(1);
    expect(isRecordActive(out[0]!, NOW)).toBe(false);
    expect(out[1]).toBeNull();
    expect(isRecordActive(out[2]!, NOW)).toBe(true);
  });

  it("findHeldPassPayments asks once for unique ids and reads the product from the payment", async () => {
    const { db, payment } = fakeDb({}, { pay_1: "CHARGEBACK_LOST" });
    expect(await findHeldPassPayments(db, ["pay_1", "pay_1", "pay_9"])).toEqual([{ paymentId: "pay_1", productId: "ACCESS_30D" }]);
    expect(payment.findMany.mock.calls[0][0].where.id.in).toEqual(["pay_1", "pay_9"]);
    expect(await findHeldPassPayments(db, [])).toEqual([]);
    expect(payment.findMany).toHaveBeenCalledTimes(1);
  });
});
