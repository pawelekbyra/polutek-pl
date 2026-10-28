// patron zone (docs/architecture/patron-zone.md): the second switch,
// PREMIUM_PASS_PAYMENTS=demo|stripe. Fail closed: real charges must never be possible by accident.
import { describe, expect, it } from "vitest";
import {
  parsePremiumPaymentsMode,
  readPremiumPaymentsDto,
  resolvePremiumPayments,
  stripeKeyMode,
  toPremiumPaymentsDto,
} from "@/lib/modules/patron-zone";

const live = { STRIPE_SECRET_KEY: "sk_live_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };
const test = { STRIPE_SECRET_KEY: "sk_test_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };

describe("PREMIUM_PASS_PAYMENTS", () => {
  it("is demo unless the value is exactly `stripe`", () => {
    for (const value of [undefined, "", "demo", "live", "on", "true", "1", "stripe-live", "strip"]) expect(parsePremiumPaymentsMode(value)).toBe("demo");
    expect(parsePremiumPaymentsMode("stripe")).toBe("stripe");
    expect(parsePremiumPaymentsMode(" Stripe ")).toBe("stripe");
  });

  it("demo never reaches Stripe, whatever keys and gates are set", () => {
    expect(resolvePremiumPayments({})).toEqual({ mode: "demo" });
    expect(resolvePremiumPayments({ ...live, PLATFORM_GATE_SALES: "on" })).toEqual({ mode: "demo" });
    expect(resolvePremiumPayments({ ...live, PREMIUM_PASS_PAYMENTS: "typo" })).toEqual({ mode: "demo" });
  });

  it("recognises the mode of a key and treats anything else as unknown", () => {
    expect(stripeKeyMode("sk_live_abc")).toBe("live");
    expect(stripeKeyMode("rk_live_abc")).toBe("live");
    expect(stripeKeyMode("pk_live_abc")).toBe("live");
    expect(stripeKeyMode("sk_test_abc")).toBe("test");
    expect(stripeKeyMode("pk_test_abc")).toBe("test");
    for (const bad of [undefined, "", "whsec_x", "live_sk", "sk_prod_x"]) expect(stripeKeyMode(bad)).toBeNull();
  });

  it("stripe + test keys: available without the sales gate (no real money moves), flagged as test", () => {
    expect(resolvePremiumPayments({ ...test, PREMIUM_PASS_PAYMENTS: "stripe" })).toEqual({ mode: "stripe", available: true, stripeMode: "test" });
  });

  it("stripe + live keys: unavailable until the global sales gate is on", () => {
    expect(resolvePremiumPayments({ ...live, PREMIUM_PASS_PAYMENTS: "stripe" })).toEqual({ mode: "stripe", available: false, reason: "SALES_GATE_OFF" });
    expect(resolvePremiumPayments({ ...live, PREMIUM_PASS_PAYMENTS: "stripe", PLATFORM_GATE_SALES: "off" })).toMatchObject({ available: false, reason: "SALES_GATE_OFF" });
    expect(resolvePremiumPayments({ ...live, PREMIUM_PASS_PAYMENTS: "stripe", PLATFORM_GATE_SALES: "on" })).toEqual({ mode: "stripe", available: true, stripeMode: "live" });
  });

  it("never mixes test and live keys", () => {
    for (const mixed of [
      { STRIPE_SECRET_KEY: "sk_live_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x" },
      { STRIPE_SECRET_KEY: "sk_test_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_x" },
    ]) {
      expect(resolvePremiumPayments({ ...test, ...mixed, PREMIUM_PASS_PAYMENTS: "stripe", PLATFORM_GATE_SALES: "on" })).toEqual({ mode: "stripe", available: false, reason: "KEYS_MIXED" });
    }
  });

  it("is unavailable (and never falls back to demo) when keys or the webhook secret are missing", () => {
    expect(resolvePremiumPayments({ PREMIUM_PASS_PAYMENTS: "stripe" })).toEqual({ mode: "stripe", available: false, reason: "KEYS_MISSING" });
    expect(resolvePremiumPayments({ ...test, PREMIUM_PASS_PAYMENTS: "stripe", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined })).toMatchObject({ available: false, reason: "KEYS_MISSING" });
    expect(resolvePremiumPayments({ ...test, PREMIUM_PASS_PAYMENTS: "stripe", STRIPE_SECRET_KEY: "garbage" })).toMatchObject({ available: false, reason: "KEYS_MISSING" });
    expect(resolvePremiumPayments({ ...test, PREMIUM_PASS_PAYMENTS: "stripe", STRIPE_WEBHOOK_SECRET: " " })).toEqual({ mode: "stripe", available: false, reason: "WEBHOOK_MISSING" });
  });

  it("the browser sees the mode and the test flag, never a reason or key material", () => {
    const dto = toPremiumPaymentsDto(resolvePremiumPayments({ ...test, PREMIUM_PASS_PAYMENTS: "stripe" }));
    expect(dto).toEqual({ mode: "stripe", available: true, stripeMode: "test" });
    expect(toPremiumPaymentsDto(resolvePremiumPayments({ ...live, PREMIUM_PASS_PAYMENTS: "stripe" }))).toEqual({ mode: "stripe", available: false });
    expect(JSON.stringify(dto)).not.toMatch(/sk_|pk_|whsec/);
    expect(readPremiumPaymentsDto({ mode: "stripe", available: true, stripeMode: "weird" })).toEqual({ mode: "stripe", available: false });
    expect(readPremiumPaymentsDto(null)).toEqual({ mode: "stripe", available: false });
  });
});

// Dedicated patron-zone key set (PREMIUM_PASS_STRIPE_*): the checkout can run on Stripe TEST keys while the tips keep
// the live STRIPE_* keys.
describe("dedicated patron-zone Stripe keys", () => {
  const premiumTest = { PREMIUM_PASS_STRIPE_SECRET_KEY: "sk_test_p", NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: "pk_test_p", PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: "whsec_p" };
  const premiumLive = { PREMIUM_PASS_STRIPE_SECRET_KEY: "sk_live_p", NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: "pk_live_p", PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: "whsec_p" };

  it("without the new variables nothing changes (no keySet in the state or the DTO)", () => {
    const state = resolvePremiumPayments({ ...live, PREMIUM_PASS_PAYMENTS: "stripe", PLATFORM_GATE_SALES: "on" });
    expect(state).toEqual({ mode: "stripe", available: true, stripeMode: "live" });
    expect(toPremiumPaymentsDto(state)).toEqual({ mode: "stripe", available: true, stripeMode: "live" });
  });

  it("premium TEST keys work with the sales gate closed while STRIPE_* are LIVE (tips unaffected)", () => {
    const state = resolvePremiumPayments({ ...live, ...premiumTest, PREMIUM_PASS_PAYMENTS: "stripe" });
    expect(state).toEqual({ mode: "stripe", available: true, stripeMode: "test", keySet: "premium" });
    expect(toPremiumPaymentsDto(state)).toEqual({ mode: "stripe", available: true, stripeMode: "test", keySet: "premium" });
    expect(readPremiumPaymentsDto(toPremiumPaymentsDto(state))).toEqual({ mode: "stripe", available: true, stripeMode: "test", keySet: "premium" });
  });

  it("premium LIVE keys still need PLATFORM_GATE_SALES=on", () => {
    expect(resolvePremiumPayments({ ...test, ...premiumLive, PREMIUM_PASS_PAYMENTS: "stripe" })).toEqual({ mode: "stripe", available: false, reason: "SALES_GATE_OFF" });
    expect(resolvePremiumPayments({ ...test, ...premiumLive, PREMIUM_PASS_PAYMENTS: "stripe", PLATFORM_GATE_SALES: "on" })).toMatchObject({ available: true, stripeMode: "live", keySet: "premium" });
  });

  it("checks consistency on the premium keys, not on STRIPE_* (valid STRIPE_* cannot rescue a broken premium set)", () => {
    const env = { ...live, PREMIUM_PASS_PAYMENTS: "stripe", PLATFORM_GATE_SALES: "on" };
    expect(resolvePremiumPayments({ ...env, ...premiumTest, NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: "pk_live_p" })).toEqual({ mode: "stripe", available: false, reason: "KEYS_MIXED" });
    expect(resolvePremiumPayments({ ...env, ...premiumTest, PREMIUM_PASS_STRIPE_SECRET_KEY: "garbage" })).toEqual({ mode: "stripe", available: false, reason: "KEYS_MISSING" });
  });

  it("a mixed STRIPE_* pair does not matter once the premium set is complete", () => {
    const mixedDefault = { STRIPE_SECRET_KEY: "sk_live_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };
    expect(resolvePremiumPayments({ ...mixedDefault, ...premiumTest, PREMIUM_PASS_PAYMENTS: "stripe" })).toMatchObject({ available: true, stripeMode: "test", keySet: "premium" });
  });

  it("a partly set premium set is ignored: the checkout behaves exactly as with STRIPE_*", () => {
    const partial = { ...test, PREMIUM_PASS_STRIPE_SECRET_KEY: "sk_live_p", PREMIUM_PASS_PAYMENTS: "stripe" };
    expect(resolvePremiumPayments(partial)).toEqual({ mode: "stripe", available: true, stripeMode: "test" });
  });

  it("demo stays demo whatever premium keys exist", () => {
    expect(resolvePremiumPayments({ ...premiumTest })).toEqual({ mode: "demo" });
  });
});
