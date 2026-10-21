// experiment: premium-pass (docs/experiments/premium-pass.md, "Strefa patrona"): the second switch,
// PREMIUM_PASS_PAYMENTS=demo|stripe. Fail closed: real charges must never be possible by accident.
import { describe, expect, it } from "vitest";
import {
  parsePremiumPaymentsMode,
  readPremiumPaymentsDto,
  resolvePremiumPayments,
  stripeKeyMode,
  toPremiumPaymentsDto,
} from "@/lib/modules/experiment-premium-pass";

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
