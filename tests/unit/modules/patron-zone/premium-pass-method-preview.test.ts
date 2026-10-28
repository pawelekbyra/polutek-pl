// patron zone (docs/architecture/patron-zone.md): the method preview (which payment methods Stripe offers for a currency
// and an amount, before "Dalej"). A throw-away PaymentIntent is created, read and canceled at once; nothing is written
// to the database, no client secret leaves, results are cached, Stripe errors never reach the client. Stripe is mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Actor } from "@/lib/modules/shared/actor";

let actor: Actor = { type: "user", userId: "u1" };
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: vi.fn(async () => actor) }));
const rate = vi.fn(async (..._args: unknown[]) => ({ success: true, remaining: 9 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...args: unknown[]) => rate(...args) }));

const create = vi.fn();
const cancel = vi.fn();
const getStripeClient = vi.fn((_keySet?: string) => ({ paymentIntents: { create, cancel } }));
vi.mock("@/lib/modules/payments", () => ({
  getStripeClient: (keySet?: string) => getStripeClient(keySet),
  createCheckoutIntent: vi.fn(),
  isPremiumPassPayment: vi.fn(),
}));

const prismaWrites = vi.fn();
const prisma = new Proxy({}, { get: () => new Proxy({}, { get: () => prismaWrites }) });
vi.mock("@/lib/prisma", () => ({ prisma }));

const { logger } = await import("@/lib/logger");
const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
const { POST: methods } = await import("@/app/api/user/premium-pass/methods/route");
const { previewPatronMethods, resetPatronMethodsCache, PATRON_METHODS_PROBE, PATRON_METHODS_TTL_MS, PATRON_METHODS_FAILURE_TTL_MS } = await import("@/lib/modules/patron-zone");

const STRIPE_ENV = ["PREMIUM_PASS_PAYMENTS", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "PLATFORM_GATE_SALES", "PREMIUM_PASS_STRIPE_SECRET_KEY", "NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY", "PREMIUM_PASS_STRIPE_WEBHOOK_SECRET"] as const;
function setStripe(mode: "test" | "live" = "test") {
  process.env.PREMIUM_PASS_PAYMENTS = "stripe";
  process.env.STRIPE_SECRET_KEY = `sk_${mode}_x`;
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = `pk_${mode}_x`;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
  if (mode === "live") process.env.PLATFORM_GATE_SALES = "on";
}

const post = (payload: unknown) =>
  methods(new NextRequest("https://www.pawelperfect.com/api/user/premium-pass/methods", { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } }));
const ok = (types: string[]) => ({ id: "pi_probe_1", client_secret: "pi_probe_1_secret_SHOULD_NEVER_LEAK", payment_method_types: types });

beforeEach(() => {
  vi.clearAllMocks();
  resetPatronMethodsCache();
  actor = { type: "user", userId: "u1" };
  process.env.PREMIUM_PASS_EXPERIMENT = "all";
  for (const key of STRIPE_ENV) delete process.env[key];
  setStripe();
  create.mockImplementation(async () => ok(["card", "link", "paypal"]));
  cancel.mockResolvedValue({});
});
afterEach(() => {
  delete process.env.PREMIUM_PASS_EXPERIMENT;
  for (const key of STRIPE_ENV) delete process.env[key];
});

describe("previewPatronMethods", () => {
  const ctx = (at = Date.now()) => ({ actor, now: () => new Date(at) });

  it("creates a probe intent for the price of the product in that currency and cancels it at once", async () => {
    const result = await previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "EUR" });
    expect(result).toEqual({ ok: true, data: { paymentMethodTypes: ["card", "link", "paypal"] } });
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0]!;
    expect(params).toEqual({ amount: 399, currency: "eur", automatic_payment_methods: { enabled: true }, metadata: { probe: PATRON_METHODS_PROBE } });
    expect(options).toMatchObject({ timeout: expect.any(Number), maxNetworkRetries: 0 });
    expect(cancel).toHaveBeenCalledWith("pi_probe_1", undefined, expect.objectContaining({ timeout: expect.any(Number) }));
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(cancel.mock.invocationCallOrder[0]!);
  });

  it("carries no user data, no payment id, no customer, and never returns the client secret", async () => {
    const result = await previewPatronMethods(ctx(), { productId: "ACCESS_LIFETIME", currency: "PLN" });
    const [params] = create.mock.calls[0]!;
    expect(Object.keys(params).sort()).toEqual(["amount", "automatic_payment_methods", "currency", "metadata"]);
    expect(JSON.stringify(params)).not.toMatch(/u1|paymentId|customer|userId|receipt_email/);
    expect(params.amount).toBe(2999);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("writes nothing to the database", async () => {
    await previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "PLN" });
    expect(prismaWrites).not.toHaveBeenCalled();
  });

  it("uses the Stripe client of the checkout's key set (premium set when configured, else default)", async () => {
    await previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "PLN" });
    expect(getStripeClient).toHaveBeenLastCalledWith("default");
    resetPatronMethodsCache();
    process.env.PREMIUM_PASS_STRIPE_SECRET_KEY = "sk_test_premium";
    process.env.NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY = "pk_test_premium";
    process.env.PREMIUM_PASS_STRIPE_WEBHOOK_SECRET = "whsec_premium";
    await previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "PLN" });
    expect(getStripeClient).toHaveBeenCalledWith("premium");
    expect(getStripeClient).not.toHaveBeenLastCalledWith("default");
  });

  it("caches per key set, currency and amount for ten minutes", async () => {
    const t = Date.now();
    const input = { productId: "ACCESS_30D", currency: "EUR" } as const;
    await previewPatronMethods(ctx(t), input);
    await previewPatronMethods(ctx(t + PATRON_METHODS_TTL_MS - 1), input);
    expect(create).toHaveBeenCalledTimes(1);
    await previewPatronMethods(ctx(t), { productId: "ACCESS_LIFETIME", currency: "EUR" }); // another amount
    await previewPatronMethods(ctx(t), { productId: "ACCESS_30D", currency: "USD" }); // another currency
    expect(create).toHaveBeenCalledTimes(3);
    await previewPatronMethods(ctx(t + PATRON_METHODS_TTL_MS + 1), input);
    expect(create).toHaveBeenCalledTimes(4);
  });

  it("concurrent requests for the same combination share one probe", async () => {
    let release!: () => void;
    create.mockImplementation(() => new Promise((resolve) => { release = () => resolve(ok(["card"])); }));
    const first = previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "GBP" });
    const second = previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "GBP" });
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    release();
    expect(await first).toEqual({ ok: true, data: { paymentMethodTypes: ["card"] } });
    expect(await second).toEqual({ ok: true, data: { paymentMethodTypes: ["card"] } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("a Stripe error gives no list (null), is not retried for a short while and leaks nothing", async () => {
    create.mockRejectedValue(new Error("Invalid API Key provided: sk_test_****abcd"));
    const t = Date.now();
    const result = await previewPatronMethods(ctx(t), { productId: "ACCESS_30D", currency: "CHF" });
    expect(result).toEqual({ ok: true, data: { paymentMethodTypes: null } });
    expect(cancel).not.toHaveBeenCalled(); // nothing was created
    await previewPatronMethods(ctx(t + PATRON_METHODS_FAILURE_TTL_MS - 1), { productId: "ACCESS_30D", currency: "CHF" });
    expect(create).toHaveBeenCalledTimes(1);
    create.mockResolvedValue(ok(["card", "klarna"]));
    const later = await previewPatronMethods(ctx(t + PATRON_METHODS_FAILURE_TTL_MS + 1), { productId: "ACCESS_30D", currency: "CHF" });
    expect(later).toEqual({ ok: true, data: { paymentMethodTypes: ["card", "klarna"] } });
  });

  it("a missing Stripe client (no key) also ends as null, not as an exception", async () => {
    getStripeClient.mockImplementationOnce(() => { throw new Error("STRIPE_SECRET_KEY is missing"); });
    expect(await previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "PLN" })).toEqual({ ok: true, data: { paymentMethodTypes: null } });
  });

  it("still returns the list when the cancel fails (the probe has no secret in anyone's hands)", async () => {
    cancel.mockRejectedValue(new Error("network"));
    expect(await previewPatronMethods(ctx(), { productId: "ACCESS_30D", currency: "PLN" })).toEqual({ ok: true, data: { paymentMethodTypes: ["card", "link", "paypal"] } });
    expect(warn).toHaveBeenCalled();
  });

  it("is refused outside real payments: demo mode, unavailable Stripe, invisible zone, guest", async () => {
    const input = { productId: "ACCESS_30D", currency: "PLN" } as const;
    process.env.PREMIUM_PASS_PAYMENTS = "demo";
    expect(await previewPatronMethods(ctx(), input)).toEqual({ ok: false, code: "WRONG_MODE" });
    setStripe();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(await previewPatronMethods(ctx(), input)).toEqual({ ok: false, code: "PAYMENTS_UNAVAILABLE" });
    setStripe("live");
    delete process.env.PLATFORM_GATE_SALES; // live keys, sales gate closed
    expect(await previewPatronMethods(ctx(), input)).toEqual({ ok: false, code: "PAYMENTS_UNAVAILABLE" });
    setStripe();
    delete process.env.PREMIUM_PASS_EXPERIMENT;
    expect(await previewPatronMethods(ctx(), input)).toEqual({ ok: false, code: "NOT_VISIBLE" });
    process.env.PREMIUM_PASS_EXPERIMENT = "all";
    expect(await previewPatronMethods({ actor: { type: "guest" }, now: () => new Date() }, input)).toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /api/user/premium-pass/methods", () => {
  it("returns the method names with no-store headers and nothing else", async () => {
    const res = await post({ productId: "ACCESS_LIFETIME", currency: "USD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ paymentMethodTypes: ["card", "link", "paypal"] });
  });

  it("404 when the zone is invisible, 401 for a guest, 429 over the rate limit (before any Stripe call)", async () => {
    delete process.env.PREMIUM_PASS_EXPERIMENT;
    expect((await post({ productId: "ACCESS_30D", currency: "PLN" })).status).toBe(404);
    process.env.PREMIUM_PASS_EXPERIMENT = "all";
    actor = { type: "guest" };
    expect((await post({ productId: "ACCESS_30D", currency: "PLN" })).status).toBe(401);
    actor = { type: "user", userId: "u1" };
    rate.mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await post({ productId: "ACCESS_30D", currency: "PLN" })).status).toBe(429);
    expect(create).not.toHaveBeenCalled();
    expect(rate).toHaveBeenLastCalledWith(expect.objectContaining({ key: "premium-pass:methods:u1" }));
  });

  it("400 for unknown products and currencies, an amount from the client or any extra field", async () => {
    for (const bad of [{ productId: "ACCESS_365D", currency: "PLN" }, { productId: "ACCESS_30D", currency: "JPY" }, { productId: "ACCESS_30D", currency: "PLN", amountMinor: 1 }, { productId: "ACCESS_30D" }, { currency: "PLN" }, null, "x"]) {
      expect((await post(bad)).status).toBe(400);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("503 in unavailable payments and 409 in demo mode, without calling Stripe", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await post({ productId: "ACCESS_30D", currency: "PLN" })).status).toBe(503);
    process.env.PREMIUM_PASS_PAYMENTS = "demo";
    expect((await post({ productId: "ACCESS_30D", currency: "PLN" })).status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it("a Stripe failure is a 200 without a list, with no Stripe detail in the body", async () => {
    create.mockRejectedValue(new Error("Invalid API Key provided: sk_test_****abcd"));
    const res = await post({ productId: "ACCESS_30D", currency: "PLN" });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ paymentMethodTypes: null });
    expect(text).not.toMatch(/sk_|Invalid API/);
  });
});
