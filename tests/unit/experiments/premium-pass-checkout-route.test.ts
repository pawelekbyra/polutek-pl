// experiment: premium-pass (docs/experiments/premium-pass.md, section 12): the simulated checkout and demo routes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Actor } from "@/lib/modules/shared/actor";

let actor: Actor = { type: "user", userId: "u1" };
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: vi.fn(async () => actor) }));
const rate = vi.fn(async () => ({ success: true, remaining: 9 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...args: unknown[]) => rate(...(args as [])) }));

const store = new Map<string, string>();
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
  video: { findMany: vi.fn(async () => []) },
};
vi.mock("@/lib/prisma", () => ({ prisma }));

const { POST: checkout } = await import("@/app/api/user/premium-pass/checkout/route");
const { POST: demo } = await import("@/app/api/user/premium-pass/demo/route");
const { GET: status } = await import("@/app/api/user/premium-pass/route");

const body = (overrides: Record<string, unknown> = {}) => ({
  requestId: "8b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d",
  product: "PASS_7D",
  method: "blik",
  consents: { terms: true, waiver: true },
  simulate: "success",
  ...overrides,
});
const post = (handler: (req: NextRequest) => Promise<Response>, url: string, payload: unknown) =>
  handler(new NextRequest(`https://www.pawelperfect.com${url}`, { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } }));
const passKeys = () => [...store.keys()].filter((k) => k.startsWith("xp.premium_pass:"));

describe("POST /api/user/premium-pass/checkout", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    actor = { type: "user", userId: "u1" };
    process.env.PREMIUM_PASS_EXPERIMENT = "all";
  });
  afterEach(() => {
    delete process.env.PREMIUM_PASS_EXPERIMENT;
    delete process.env.PREMIUM_PASS_TESTER_IDS;
  });

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
    for (const bad of [body({ cardNumber: "4242424242424242" }), body({ blikCode: "123456" }), body({ method: "paypal" }), body({ requestId: "x" }), body({ simulate: "charge" }), body({ product: "PASS_365D" })]) {
      const res = await post(checkout, "/api/user/premium-pass/checkout", bad);
      expect(res.status).toBe(400);
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

  it("success writes one DEMO row and returns the receipt; same requestId = same answer; another purchase = 409", async () => {
    const first = await post(checkout, "/api/user/premium-pass/checkout", body({ product: "PASS_30D", method: "card" }));
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    const receipt = (await first.json()).pass;
    expect(receipt).toMatchObject({ state: "active", product: "PASS_30D", priceMinor: 2900, method: "card" });
    expect(receipt.ref).toMatch(/^DEMO-/);
    expect(receipt.requestId).toBeUndefined();
    expect(passKeys()).toEqual(["xp.premium_pass:u1"]);
    const row = JSON.parse(store.get("xp.premium_pass:u1")!);
    expect(row).toMatchObject({ provider: "DEMO", currency: "PLN", consents: { termsVersion: "demo-2026-10" } });
    expect(new Date(row.expiresAt).getTime() - new Date(row.grantedAt).getTime()).toBe(30 * 86_400_000);
    expect(JSON.stringify(row)).not.toMatch(/@|email/i);

    const again = await post(checkout, "/api/user/premium-pass/checkout", body({ product: "PASS_30D", method: "card" }));
    expect(again.status).toBe(200);
    expect((await again.json()).pass.ref).toBe(receipt.ref);

    const other = await post(checkout, "/api/user/premium-pass/checkout", body({ requestId: "1b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d" }));
    expect(other.status).toBe(409);
    expect(await other.json()).toEqual({ code: "PASS_ALREADY_ACTIVE", expiresAt: row.expiresAt });
  });

  it("ADMIN on the public site can buy the demo pass too", async () => {
    actor = { type: "admin", userId: "a1" };
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(200);
    expect(passKeys()).toEqual(["xp.premium_pass:a1"]);
  });

  it("is rate limited per account", async () => {
    rate.mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await post(checkout, "/api/user/premium-pass/checkout", body())).status).toBe(429);
  });
});

describe("POST /api/user/premium-pass/demo (own pass only)", () => {
  beforeEach(() => {
    store.clear();
    actor = { type: "user", userId: "u1" };
    process.env.PREMIUM_PASS_EXPERIMENT = "all";
  });
  afterEach(() => {
    delete process.env.PREMIUM_PASS_EXPERIMENT;
  });

  it("expires and deletes the caller's pass, never another account's", async () => {
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

  it("after expiry a new purchase is allowed", async () => {
    await post(checkout, "/api/user/premium-pass/checkout", body());
    await post(demo, "/api/user/premium-pass/demo", { action: "expire" });
    const res = await post(checkout, "/api/user/premium-pass/checkout", body({ requestId: "2b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d" }));
    expect(res.status).toBe(200);
  });
});
