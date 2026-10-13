import { describe, expect, it } from "vitest";
import { creatorShareReversal, payoutAvailableAt, resolveChargeAmount, splitSale } from "@/lib/modules/sales";

describe("splitSale", () => {
  it("splits a 23% VAT sale with a 10% commission", () => {
    const s = splitSale({ grossMinor: 12_300, vatRateBp: 2300, feeRateBp: 1000 });
    expect(s).toMatchObject({ vatMinor: 2300, netMinor: 10_000, platformFeeMinor: 1000, creatorShareMinor: 9000 });
  });

  it("always adds up exactly, whatever the rounding", () => {
    for (let gross = 0; gross <= 5000; gross += 37) {
      for (const vat of [0, 500, 800, 1900, 2300, 2700]) {
        for (const fee of [0, 333, 1000, 1500, 4999]) {
          const s = splitSale({ grossMinor: gross, vatRateBp: vat, feeRateBp: fee });
          expect(s.vatMinor + s.netMinor).toBe(gross);
          expect(s.platformFeeMinor + s.creatorShareMinor).toBe(s.netMinor);
          expect(Math.min(s.vatMinor, s.netMinor, s.platformFeeMinor, s.creatorShareMinor)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("rejects non-integer or out-of-range input", () => {
    expect(() => splitSale({ grossMinor: 10.5, vatRateBp: 0, feeRateBp: 0 })).toThrow(RangeError);
    expect(() => splitSale({ grossMinor: -1, vatRateBp: 0, feeRateBp: 0 })).toThrow(RangeError);
    expect(() => splitSale({ grossMinor: 100, vatRateBp: 0, feeRateBp: 10_001 })).toThrow(RangeError);
  });
});

describe("creatorShareReversal", () => {
  it("sums to exactly the creator share across any sequence of partial refunds", () => {
    const gross = 999;
    const s = splitSale({ grossMinor: gross, vatRateBp: 2300, feeRateBp: 1000 });
    for (const parts of [[333, 333, 333], [1, 998], [500, 499], [100, 200, 300, 399]]) {
      let before = 0;
      let total = 0;
      for (const p of parts) {
        total += creatorShareReversal({ grossMinor: gross, creatorShareMinor: s.creatorShareMinor, refundedBefore: before, refundNow: p });
        before += p;
      }
      expect(before).toBe(gross);
      expect(total).toBe(s.creatorShareMinor);
    }
  });

  it("refuses to refund more than is left", () => {
    expect(() => creatorShareReversal({ grossMinor: 100, creatorShareMinor: 70, refundedBefore: 60, refundNow: 50 })).toThrow(RangeError);
  });
});

describe("resolveChargeAmount", () => {
  const fixed = { currency: "PLN", amountMinor: 1500, payWhatYouWant: false, minAmountMinor: null };
  const pwyw = { currency: "PLN", amountMinor: 2000, payWhatYouWant: true, minAmountMinor: 500 };
  it("charges the fixed price whatever the buyer sends", () => {
    expect(resolveChargeAmount(fixed, 1)).toEqual({ ok: true, amountMinor: 1500 });
  });
  it("keeps pay-what-you-want inside the allowed range", () => {
    expect(resolveChargeAmount(pwyw, 700)).toEqual({ ok: true, amountMinor: 700 });
    expect(resolveChargeAmount(pwyw, 100)).toEqual({ ok: false, code: "AMOUNT_TOO_LOW" });
    expect(resolveChargeAmount(pwyw, 99_999_999)).toEqual({ ok: false, code: "AMOUNT_TOO_HIGH" });
    expect(resolveChargeAmount(pwyw, undefined)).toEqual({ ok: false, code: "AMOUNT_INVALID" });
    expect(resolveChargeAmount(pwyw, 7.5)).toEqual({ ok: false, code: "AMOUNT_INVALID" });
  });
});

describe("payoutAvailableAt", () => {
  it("adds the hold period", () => {
    expect(payoutAvailableAt(new Date("2026-10-01T00:00:00Z"), 14).toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });
});
