/**
 * The "VIP" comment badge comes ONLY from a paid patron-zone access, NEVER from a tip or donation (owner's legal and tax
 * constraint: tips are donations and must give nothing back). The webhook is real, signed with Stripe's own test helper;
 * only the database (in-memory fake), e-mail, notifications, audit and the Stripe client are replaced.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { createFakePaymentsDb } from "../payments/fake-payments-db";

const SECRET = "whsec_test_signing_secret_for_unit_tests";
const db = createFakePaymentsDb();
const stripeRefunds = new Map<string, Array<{ id: string; amount: number; status: string }>>();

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/modules/email", () => ({ sendBecomePatronEmail: vi.fn(), sendDonationThankYouEmail: vi.fn() }));
vi.mock("@/lib/modules/notifications", () => ({
  sendNotification: vi.fn(),
  notificationTemplates: { supportThanks: { kind: "PATRON", titlePl: "t", titleEn: "t", bodyPl: "b", bodyEn: "b" } },
}));
vi.mock("@/lib/modules/payments/infrastructure/stripe-client", () => ({
  getStripeClient: () => ({
    disputes: { retrieve: vi.fn() },
    refunds: { list: vi.fn(async ({ payment_intent }: { payment_intent: string }) => ({ data: stripeRefunds.get(payment_intent) ?? [], has_more: false })) },
  }),
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");
const { listVipUserIds } = await import("@/lib/modules/patron-zone");

let eventSeq = 0;
function signedRequest(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_vip_${++eventSeq}`, object: "event", type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object } });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new NextRequest("http://localhost/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
}

function seedPayment(overrides: Record<string, unknown> = {}) {
  const n = db.payment.rows.length + 1;
  const row = {
    id: `pay_${n}`,
    userId: "user_1",
    creatorId: "creator_1",
    amountMinor: 1499,
    currency: "PLN",
    status: "PENDING",
    stripeIntentId: `pi_${n}`,
    refundedAmountMinor: 0,
    requestId: null,
    metadata: { purpose: "premium_pass", productId: "ACCESS_30D", method: "blik", consents: { termsVersion: "t", waiverAt: "2026-10-21T10:00:00.000Z" } },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  db.payment.rows.push(row);
  return row as typeof row & { id: string; stripeIntentId: string; amountMinor: number };
}
const intent = (p: { id: string; stripeIntentId: string; amountMinor: number }, metadata: Record<string, unknown>) => ({
  id: p.stripeIntentId,
  object: "payment_intent",
  amount: p.amountMinor,
  currency: "pln",
  status: "succeeded",
  metadata: { paymentId: p.id, userId: "user_1", ...metadata },
});
const isVip = async (userId = "user_1") => (await listVipUserIds(db as never, [userId], new Date())).has(userId);

beforeEach(() => {
  for (const name of ["payment", "stripeEvent", "patronGrant", "user", "userPaymentTotal", "appSetting"]) db[name].rows.length = 0;
  db.user.rows.push({ id: "user_1", email: "payer@example.com", language: "pl" });
  stripeRefunds.clear();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
});

describe("VIP badge: paid access yes, tips never", () => {
  it("a tip of any size (supporter ledger entry, thank-you) gives NO VIP", async () => {
    for (const amountMinor of [500, 1499, 2999, 500_000]) {
      const tip = seedPayment({ amountMinor, metadata: {} });
      const res = await POST(signedRequest("payment_intent.succeeded", intent(tip, {})));
      expect(res.status).toBe(200);
    }
    // the owner's private ledger still records the payer...
    expect(db.patronGrant.rows.length).toBeGreaterThan(0);
    // ...but no access row exists, so there is nothing to show
    expect(db.appSetting.rows.filter((r: { key: string }) => r.key.startsWith("xp.premium_pass:"))).toHaveLength(0);
    expect(await isVip()).toBe(false);
  });

  it("a tip made by an account that is already VIP changes nothing about its access", async () => {
    const paid = seedPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(paid, { purpose: "premium_pass" })));
    const before = JSON.stringify(db.appSetting.rows);
    const tip = seedPayment({ amountMinor: 10_000, metadata: {} });
    await POST(signedRequest("payment_intent.succeeded", intent(tip, {})));
    expect(JSON.stringify(db.appSetting.rows)).toBe(before);
    expect(await isVip()).toBe(true);
  });

  it("a verified paid patron-zone payment gives VIP", async () => {
    const paid = seedPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(paid, { purpose: "premium_pass" })));
    expect(await isVip()).toBe(true);
  });

  it("the badge ends with the access: a 30-day access that ran out is not VIP, a fully refunded payment is not VIP", async () => {
    const paid = seedPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(paid, { purpose: "premium_pass" })));
    expect((await listVipUserIds(db as never, ["user_1"], new Date(Date.now() + 31 * 86_400_000))).size).toBe(0);

    stripeRefunds.set(paid.stripeIntentId, [{ id: "re_1", amount: 1499, status: "succeeded" }]);
    await POST(signedRequest("charge.refunded", { id: "ch_1", object: "charge", payment_intent: paid.stripeIntentId, metadata: { paymentId: paid.id } }));
    expect(await isVip()).toBe(false);
  });

  it("the unlimited access is a permanent badge", async () => {
    const life = seedPayment({ amountMinor: 2999, metadata: { purpose: "premium_pass", productId: "ACCESS_LIFETIME" } });
    await POST(signedRequest("payment_intent.succeeded", intent(life, { purpose: "premium_pass" })));
    expect((await listVipUserIds(db as never, ["user_1"], new Date("2099-01-01T00:00:00.000Z"))).has("user_1")).toBe(true);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("VIP badge source guards", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("the VIP lookup never reads the tip ledger or the supporter module", () => {
    const source = read("lib/modules/patron-zone/application/vip-status.ts").replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/patronGrant|PatronGrant|ensureSupporterGrant|getPatronStatus|modules\/patron["'/]/);
    expect(source).toMatch(/provider === "STRIPE"/);
  });

  it("the access row (what VIP reads) is written only by the paid-payment grant, the demo checkout and the demo controls", () => {
    const callers = sourceFiles(join(process.cwd(), "lib"))
      .concat(sourceFiles(join(process.cwd(), "app")))
      .filter((file) => /\bwritePass\(/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(process.cwd().length + 1).replaceAll("\\", "/"))
      .filter((file) => !file.endsWith("pass-store.ts"))
      .sort();
    expect(callers).toEqual([
      "lib/modules/patron-zone/application/checkout-demo.use-case.ts",
      "lib/modules/patron-zone/application/demo-controls.use-case.ts",
      "lib/modules/patron-zone/application/patron-grant.ts",
    ]);
  });

  it("only the premium-pass branch of fulfilment grants access; the tip branch writes the supporter ledger instead", () => {
    const source = read("lib/modules/payments/application/fulfill-payment.use-case.ts");
    expect(source).toMatch(/if \(premium\) \{\s*const \{ grantPatronAccessForPayment/);
    expect(source).toMatch(/premium \? \{ created: false \} : await ensureSupporterGrant/);
  });

  it("the comment author mapper adds VIP only when the caller says so, and no supporter field can add it", () => {
    const source = read("lib/comments-public-author.ts").replace(/\/\/.*$/gm, "");
    expect(source).toMatch(/if \(options\.isVip === true\) badges\.push\("VIP"\)/);
    expect(source).not.toMatch(/patronGrants|isPatron|PatronGrant/);
  });
});
