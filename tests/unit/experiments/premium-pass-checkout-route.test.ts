// experiment: premium-pass (docs/experiments/premium-pass.md, "Strefa patrona"): the simulated checkout (demo mode),
// the real-payment start and consent routes (stripe mode) and the demo panel. Stripe itself is mocked: no network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Actor } from "@/lib/modules/shared/actor";

let actor: Actor = { type: "user", userId: "u1" };
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: vi.fn(async () => actor) }));
const rate = vi.fn(async () => ({ success: true, remaining: 9 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...args: unknown[]) => rate(...(args as [])) }));

const createCheckoutIntent = vi.fn();
vi.mock("@/lib/modules/payments", () => ({
  createCheckoutIntent: (...args: unknown[]) => createCheckoutIntent(...args),
  isPremiumPassPayment: (metadata: unknown) => (metadata as { purpose?: unknown } | null)?.purpose === "premium_pass",
}));
const recordTermsAcceptance = vi.fn(async () => undefined);
vi.mock("@/lib/modules/users", () => ({ recordTermsAcceptance: (...args: unknown[]) => recordTermsAcceptance(...(args as [])) }));

const store = new Map<string, string>();
const payments = new Map<string, { id: string; userId: string; status: string; metadata: Record<string, unknown> }>();
const prisma = {
  appSetting: {
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (store.has(where.key) ? { value: store.get(where.key)! } : null)),
    upsert: vi.fn(async ({ where, create, update }: { where: { key: string }; create: { value: string }; update: { value: string } }) => {
      store.set(where.key, store.has(where.key) ? update.value : create.value);
      return {};
    }),
    deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
      store.delete(where.key);
      return { count: 1 };
    }),
  },
  payment: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string; status: string } }) => {
      const row = payments.get(where.id);
      return row && row.userId === where.userId && row.status === where.status ? { id: row.id, metadata: row.metadata } : null;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: { metadata: Record<string, unknown> } }) => {
      const row = payments.get(where.id);
      if (row) row.metadata = data.metadata;
      return { count: row ? 1 : 0 };
    }),
  },
  video: { findMany: vi.fn(async () => []) },
};
vi.mock("@/lib/prisma", () => ({ prisma }));

const { POST: checkout } = await import("@/app/api/user/premium-pass/checkout/route");
const { POST: intent } = await import("@/app/api/user/premium-pass/intent/route");
const { POST: consent } = await import("@/app/api/user/premium-pass/consent/route");
const { POST: demo } = await import("@/app/api/user/premium-pass/demo/route");
const { GET: status } = await import("@/app/api/user/premium-pass/route");

const REQ = "8b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d";
const body = (overrides: Record<string, unknown> = {}) => ({
  requestId: REQ,
  amountMinor: 2500,
  method: "blik",
  consents: { terms: true, waiver: true },
  simulate: "success",
  ...overrides,
});
const post = (handler: (req: NextRequest) => Promise<Response>, url: string, payload: unknown) =>
  handler(new NextRequest(`https://www.pawelperfect.com${url}`, { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } }));
const passKeys = () => [...store.keys()].filter((k) => k.startsWith("xp.premium_pass:"));
const DAY = 86_400_000;

const STRIPE_ENV = ["PREMIUM_PASS_PAYMENTS", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "PLATFORM_GATE_SALES"] as const;
function setStripe(mode: "test" | "live", gate?: "on") {
  process.env.PREMIUM_PASS_PAYMENTS = "stripe";
  process.env.STRIPE_SECRET_KEY = `sk_${mode}_x`;
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = `pk_${mode}_x`;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
  if (gate) process.env.PLATFORM_GATE_SALES = gate;
}

beforeEach(() => {
  store.clear();
  payments.clear();
  vi.clearAllMocks();
  actor = { type: "user", userId: "u1" };
  process.env.PREMIUM_PASS_EXPERIMENT = "all";
  for (const key of STRIPE_ENV) delete process.env[key];
});
afterEach(() => {
  delete process.env.PREMIUM_PASS_EXPERIMENT;
  delete process.env.PREMIUM_PASS_TESTER_IDS;
  for (const key of STRIPE_ENV) delete process.env[key];
});

describe("POST /api/user/premium-pass/checkout (demo mode, simulated)", () => {
  it("404 when the experiment is off or invisible to the viewer", async () => {
    delete process.env.PREMIUM_PASS_EXPERIMENT;
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(404);
    process.env.PREMIUM_PASS_EXPERIMENT = "testers";
    process.env.PREMIUM_PASS_TESTER_IDS = "someone-else";
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(404);
    expect((await status(new NextRequest("https://www.pawelperfect.com/api/user/premium-pass"))).status).toBe(404);
    expect(passKeys()).toEqual([]);
  });

  it("401 for a guest", async () => {
    actor = { type: "guest" };
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(401);
  });

  it("400 for unknown fields (no card or BLIK data is ever accepted) and bad values", async () => {
    for (const bad of [body({ cardNumber: "4242424242424242" }), body({ blikCode: "123456" }), body({ method: "paypal" }), body({ requestId: "x" }), body({ simulate: "charge" }), body({ product: "PASS_7D" }), body({ amountMinor: 12.5 }), body({ amountMinor: "2500" })]) {
      const res = await post(checkout, "/api/user/premium-pass/checkout", bad);
      expect(res.status).toBe(400);
    }
    expect(passKeys()).toEqual([]);
  });

  it("400 AMOUNT_INVALID below the minimum or above the maximum, nothing written", async () => {
    for (const amountMinor of [1999, 499, 0, -500, 100_001]) {
      const res = await post(checkout, "/api/user/premium-pass/checkout", body({ amountMinor }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "AMOUNT_INVALID" });
    }
    expect(passKeys()).toEqual([]);
  });

  it("400 CONSENT_REQUIRED without both consents, nothing written", async () => {
    const res = await post(checkout, "/api/user/premium-pass/checkout", body({ consents: { terms: true, waiver: false } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "CONSENT_REQUIRED" });
    expect(passKeys()).toEqual([]);
  });

  it("declined writes nothing (402)", async () => {
    const res = await post(checkout, "/api/user/premium-pass/checkout", body({ simulate: "declined" }));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ code: "DEMO_DECLINED" });
    expect(passKeys()).toEqual([]);
  });

  it("success writes one DEMO row for the typed amount; the same requestId gives the same answer; another payment extends by 30 days", async () => {
    const first = await post(checkout, "/api/user/premium-pass/checkout", body({ amountMinor: 2550, method: "card" }));
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    const receipt = (await first.json()).pass;
    expect(receipt).toMatchObject({ state: "active", provider: "DEMO", priceMinor: 2550, totalMinor: 2550, method: "card" });
    expect(receipt.ref).toMatch(/^DEMO-/);
    expect(receipt.requestId).toBeUndefined();
    expect(receipt.paymentIds).toBeUndefined();
    expect(passKeys()).toEqual(["xp.premium_pass:u1"]);
    const row = JSON.parse(store.get("xp.premium_pass:u1")!);
    expect(row).toMatchObject({ v: 2, provider: "DEMO", currency: "PLN", priceMinor: 2550, consents: { termsVersion: "patron-2026-10-draft" } });
    expect(new Date(row.expiresAt).getTime() - new Date(row.grantedAt).getTime()).toBe(30 * DAY);
    expect(JSON.stringify(row)).not.toMatch(/@|email/i);

    const again = await post(checkout, "/api/user/premium-pass/checkout", body({ amountMinor: 2550, method: "card" }));
    expect(again.status).toBe(200);
    expect((await again.json()).pass.ref).toBe(receipt.ref);
    expect(JSON.parse(store.get("xp.premium_pass:u1")!).expiresAt).toBe(row.expiresAt);

    const other = await post(checkout, "/api/user/premium-pass/checkout", body({ requestId: "1b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d", amountMinor: 2000 }));
    expect(other.status).toBe(200);
    const extended = JSON.parse(store.get("xp.premium_pass:u1")!);
    expect(new Date(extended.expiresAt).getTime() - new Date(row.expiresAt).getTime()).toBe(30 * DAY);
    expect(extended).toMatchObject({ priceMinor: 2000, totalMinor: 4550, grantedAt: row.grantedAt });
  });

  it("refuses to extend beyond the 365-day horizon", async () => {
    store.set("xp.premium_pass:u1", JSON.stringify({
      v: 2, provider: "DEMO", ref: "DEMO-AAAA-BBBB", priceMinor: 500, totalMinor: 500, currency: "PLN", method: "blik", paymentIds: [],
      grantedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 340 * DAY).toISOString(), consents: { termsVersion: "x", waiverAt: new Date().toISOString() },
    }));
    const res = await post(checkout, "/api/user/premium-pass/checkout", body({ requestId: "3b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("MAX_AHEAD");
  });

  it("ADMIN on the public site can use the demo checkout too", async () => {
    actor = { type: "admin", userId: "a1" };
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(200);
    expect(passKeys()).toEqual(["xp.premium_pass:a1"]);
  });

  it("is rate limited per account", async () => {
    rate.mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(429);
  });

  it("is refused in stripe mode (the simulation must never hand out access that real money should have paid for)", async () => {
    setStripe("live");
    const res = await post(checkout, "/api/user/premium-pass/checkout", body());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("WRONG_MODE");
    setStripe("test");
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(409);
    expect(passKeys()).toEqual([]);
  });

  it("the status carries the payments info the checkout needs", async () => {
    let res = await status(new NextRequest("https://www.pawelperfect.com/api/user/premium-pass"));
    expect((await res.json()).offer.payments).toEqual({ mode: "demo" });
    setStripe("test");
    res = await status(new NextRequest("https://www.pawelperfect.com/api/user/premium-pass"));
    expect((await res.json()).offer.payments).toEqual({ mode: "stripe", available: true, stripeMode: "test" });
    setStripe("live");
    res = await status(new NextRequest("https://www.pawelperfect.com/api/user/premium-pass"));
    expect((await res.json()).offer.payments).toEqual({ mode: "stripe", available: false });
  });
});

describe("POST /api/user/premium-pass/intent (stripe mode: the real payment starts here)", () => {
  const input = (overrides: Record<string, unknown> = {}) => ({ requestId: REQ, amountMinor: 2500, ...overrides });
  beforeEach(() => {
    createCheckoutIntent.mockResolvedValue({ ok: true, data: { paymentId: "pay_1", clientSecret: "pi_1_secret_x", paymentMethodTypes: ["blik", "card", "p24"] } });
  });

  it("404 when the experiment is off, 401 for a guest", async () => {
    setStripe("test");
    delete process.env.PREMIUM_PASS_EXPERIMENT;
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(404);
    process.env.PREMIUM_PASS_EXPERIMENT = "all";
    actor = { type: "guest" };
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(401);
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it("demo mode (the default) never creates a payment", async () => {
    const res = await post(intent, "/api/user/premium-pass/intent", input());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("WRONG_MODE");
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it("live keys with the sales gate closed (the situation today) create no payment", async () => {
    setStripe("live");
    const res = await post(intent, "/api/user/premium-pass/intent", input());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("PAYMENTS_UNAVAILABLE");
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it("mixed keys or a missing webhook secret create no payment", async () => {
    setStripe("test");
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_x";
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(503);
    setStripe("test");
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(503);
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it("validates the amount on the server and accepts nothing else from the client", async () => {
    setStripe("test");
    for (const amountMinor of [1999, 499, 100_001, 0, -1]) {
      const res = await post(intent, "/api/user/premium-pass/intent", input({ amountMinor }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("AMOUNT_INVALID");
    }
    for (const bad of [input({ amountMinor: 25.5 }), input({ amountMinor: "2500" }), input({ currency: "EUR" }), input({ userId: "u2" }), input({ purpose: "tip" }), input({ requestId: "nope" }), {}]) {
      expect((await post(intent, "/api/user/premium-pass/intent", bad)).status).toBe(400);
    }
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it("creates the payment through the tip gateway's createCheckoutIntent: PLN, the session's user, purpose premium_pass", async () => {
    setStripe("test");
    const res = await post(intent, "/api/user/premium-pass/intent", input({ amountMinor: 2234 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ paymentId: "pay_1", clientSecret: "pi_1_secret_x", paymentMethodTypes: ["blik", "card", "p24"], terminal: false });
    expect(createCheckoutIntent).toHaveBeenCalledTimes(1);
    expect(createCheckoutIntent.mock.calls[0]![0]).toEqual({ userId: "u1", amountMinor: 2234, currency: "PLN", requestId: REQ, purpose: "premium_pass" });
    expect(passKeys()).toEqual([]); // starting a payment grants nothing
  });

  it("works with live keys once the sales gate is on", async () => {
    setStripe("live", "on");
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(200);
  });

  it("refuses another payment when the access already runs beyond the horizon", async () => {
    setStripe("test");
    store.set("xp.premium_pass:u1", JSON.stringify({
      v: 2, provider: "STRIPE", ref: "pay_0", priceMinor: 500, totalMinor: 500, currency: "PLN", method: "blik", paymentIds: ["pay_0"],
      grantedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 340 * DAY).toISOString(), consents: { termsVersion: "x", waiverAt: new Date().toISOString() },
    }));
    const res = await post(intent, "/api/user/premium-pass/intent", input());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("MAX_AHEAD");
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });

  it("maps a finished attempt, a payment in progress and a provider error", async () => {
    setStripe("test");
    createCheckoutIntent.mockResolvedValueOnce({ ok: true, data: { paymentId: "pay_1", clientSecret: null, terminal: true } });
    expect(await (await post(intent, "/api/user/premium-pass/intent", input())).json()).toMatchObject({ terminal: true });
    createCheckoutIntent.mockResolvedValueOnce({ ok: false, error: { code: "PAYMENT_IN_PROGRESS" } });
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(409);
    createCheckoutIntent.mockResolvedValueOnce({ ok: false, error: { code: "PAYMENT_PROVIDER_ERROR" } });
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(502);
  });

  it("is rate limited per account", async () => {
    setStripe("test");
    rate.mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await post(intent, "/api/user/premium-pass/intent", input())).status).toBe(429);
    expect(createCheckoutIntent).not.toHaveBeenCalled();
  });
});

describe("POST /api/user/premium-pass/consent (step 2, right before the payment is confirmed)", () => {
  const ok = { paymentId: "pay_1", method: "blik", consents: { terms: true, waiver: true } };
  beforeEach(() => {
    payments.set("pay_1", { id: "pay_1", userId: "u1", status: "PENDING", metadata: { purpose: "premium_pass", requestId: REQ } });
    payments.set("tip_1", { id: "tip_1", userId: "u1", status: "PENDING", metadata: {} });
    payments.set("pay_2", { id: "pay_2", userId: "u2", status: "PENDING", metadata: { purpose: "premium_pass" } });
    payments.set("pay_3", { id: "pay_3", userId: "u1", status: "SUCCEEDED", metadata: { purpose: "premium_pass" } });
  });

  it("stores the consent and the method on the viewer's own unpaid patron payment, and records the Terms acceptance", async () => {
    const res = await post(consent, "/api/user/premium-pass/consent", ok);
    expect(res.status).toBe(200);
    expect(payments.get("pay_1")!.metadata).toMatchObject({ purpose: "premium_pass", requestId: REQ, method: "blik", consents: { termsVersion: "patron-2026-10-draft" } });
    expect(typeof (payments.get("pay_1")!.metadata.consents as { waiverAt: string }).waiverAt).toBe("string");
    expect(recordTermsAcceptance).toHaveBeenCalledTimes(1);
    expect(passKeys()).toEqual([]);
  });

  it("refuses a tip, another account's payment and an already paid one", async () => {
    for (const paymentId of ["tip_1", "pay_2", "pay_3", "missing"]) {
      const res = await post(consent, "/api/user/premium-pass/consent", { ...ok, paymentId });
      expect(res.status).toBe(404);
    }
    expect(payments.get("pay_2")!.metadata).toEqual({ purpose: "premium_pass" });
  });

  it("requires both boxes and rejects unknown fields", async () => {
    for (const bad of [{ ...ok, consents: { terms: true, waiver: false } }, { ...ok, consents: { terms: true } }, { ...ok, method: "Not A Method" }, { ...ok, extra: 1 }]) {
      expect((await post(consent, "/api/user/premium-pass/consent", bad)).status).toBe(400);
    }
    expect(payments.get("pay_1")!.metadata).toEqual({ purpose: "premium_pass", requestId: REQ });
  });
});

describe("POST /api/user/premium-pass/demo (own access only, demo mode or Stripe TEST keys only)", () => {
  it("expires and deletes the caller's access, never another account's", async () => {
    await post(checkout, "/api/user/premium-pass/checkout", body());
    actor = { type: "user", userId: "u2" };
    expect((await post(demo, "/api/user/premium-pass/demo", { action: "expire" })).status).toBe(404);
    expect((await post(demo, "/api/user/premium-pass/demo", { action: "reset", userId: "u1" })).status).toBe(400);
    expect(store.has("xp.premium_pass:u1")).toBe(true);

    actor = { type: "user", userId: "u1" };
    const expired = await post(demo, "/api/user/premium-pass/demo", { action: "expire" });
    expect((await expired.json()).pass.state).toBe("expired");
    const reset = await post(demo, "/api/user/premium-pass/demo", { action: "reset" });
    expect((await reset.json()).pass).toEqual({ state: "none" });
    expect(store.has("xp.premium_pass:u1")).toBe(false);
  });

  it("after expiry a new demo payment is allowed", async () => {
    await post(checkout, "/api/user/premium-pass/checkout", body());
    await post(demo, "/api/user/premium-pass/demo", { action: "expire" });
    const res = await post(checkout, "/api/user/premium-pass/checkout", body({ requestId: "2b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d" }));
    expect(res.status).toBe(200);
  });

  it("with LIVE keys it cannot remove the proof of a real payment; with TEST keys it can", async () => {
    store.set("xp.premium_pass:u1", JSON.stringify({
      v: 2, provider: "STRIPE", ref: "pay_0", priceMinor: 500, totalMinor: 500, currency: "PLN", method: "blik", paymentIds: ["pay_0"],
      grantedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 10 * DAY).toISOString(), consents: { termsVersion: "x", waiverAt: new Date().toISOString() },
    }));
    setStripe("live", "on");
    expect((await post(demo, "/api/user/premium-pass/demo", { action: "reset" })).status).toBe(409);
    setStripe("live");
    expect((await post(demo, "/api/user/premium-pass/demo", { action: "reset" })).status).toBe(409);
    expect(store.has("xp.premium_pass:u1")).toBe(true);
    setStripe("test");
    expect((await post(demo, "/api/user/premium-pass/demo", { action: "reset" })).status).toBe(200);
    expect(store.has("xp.premium_pass:u1")).toBe(false);
  });
});
