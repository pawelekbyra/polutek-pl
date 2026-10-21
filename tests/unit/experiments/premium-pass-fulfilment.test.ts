/**
 * experiment: premium-pass (docs/experiments/premium-pass.md, "Strefa patrona"): the patron-zone access is granted ONLY
 * by the verified Stripe webhook / fulfillPayment(). Payloads are signed with Stripe's own test helper and verified by
 * the real `constructEvent`; only the database (in-memory fake), e-mail, notifications, audit and the Stripe API client
 * are replaced. No network, no charge.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { createFakePaymentsDb } from "../modules/payments/fake-payments-db";

const SECRET = "whsec_test_signing_secret_for_unit_tests";
const db = createFakePaymentsDb();
const stripeRefunds = new Map<string, Array<{ id: string; amount: number; status: string }>>();
const refundsList = vi.fn(async ({ payment_intent }: { payment_intent: string }) => ({ data: stripeRefunds.get(payment_intent) ?? [], has_more: false }));
const sendBecomePatronEmail = vi.fn();
const sendDonationThankYouEmail = vi.fn();
const sendNotification = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/modules/email", () => ({
  sendBecomePatronEmail: (...args: unknown[]) => sendBecomePatronEmail(...args),
  sendDonationThankYouEmail: (...args: unknown[]) => sendDonationThankYouEmail(...args),
}));
vi.mock("@/lib/modules/notifications", () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
  notificationTemplates: { supportThanks: { kind: "PATRON", titlePl: "t", titleEn: "t", bodyPl: "b", bodyEn: "b" } },
}));
vi.mock("@/lib/modules/payments/infrastructure/stripe-client", () => ({
  getStripeClient: () => ({ disputes: { retrieve: vi.fn() }, refunds: { list: refundsList } }),
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");
const { parsePassRecord, passStateOf } = await import("@/lib/modules/experiment-premium-pass");

let eventSeq = 0;
function signedRequest(type: string, object: Record<string, unknown>, options: { livemode?: boolean; secret?: string; id?: string } = {}) {
  const payload = JSON.stringify({
    id: options.id ?? `evt_test_${++eventSeq}`,
    object: "event",
    type,
    livemode: options.livemode ?? false,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: options.secret ?? SECRET });
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

function intent(payment: { id: string; stripeIntentId: string; amountMinor: number; currency?: string }, extra: Record<string, unknown> = {}) {
  return {
    id: payment.stripeIntentId,
    object: "payment_intent",
    amount: payment.amountMinor,
    currency: (payment.currency ?? "PLN").toLowerCase(),
    status: "succeeded",
    metadata: { paymentId: payment.id, userId: "user_1", purpose: "premium_pass" },
    ...extra,
  };
}

function seedPatronPayment(overrides: Record<string, unknown> = {}) {
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
    metadata: { purpose: "premium_pass", productId: "ACCESS_30D", method: "blik", consents: { termsVersion: "patron-2026-10-draft", waiverAt: "2026-10-21T10:00:00.000Z" } },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  db.payment.rows.push(row);
  return row as typeof row & { id: string; stripeIntentId: string; amountMinor: number; status: string };
}

const grant = () => parsePassRecord(db.appSetting.rows.find((row: any) => row.key === "xp.premium_pass:user_1")?.value);
const DAY = 86_400_000;

beforeEach(() => {
  for (const name of ["payment", "stripeEvent", "patronGrant", "user", "userPaymentTotal", "appSetting"]) db[name].rows.length = 0;
  db.user.rows.push({ id: "user_1", email: "payer@example.com", language: "pl" });
  vi.clearAllMocks();
  stripeRefunds.clear();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
});

describe("patron zone access from the verified webhook", () => {
  it("grants access for 30 days, records the payment in the ledger, adds no supporter marker and sends no tip e-mail", async () => {
    const payment = seedPatronPayment();
    expect(grant()).toBeNull();

    const res = await POST(signedRequest("payment_intent.succeeded", intent(payment)));

    expect(res.status).toBe(200);
    expect(payment.status).toBe("SUCCEEDED");
    const record = grant()!;
    expect(record).toMatchObject({ v: 3, provider: "STRIPE", ref: payment.id, productId: "ACCESS_30D", priceMinor: 1499, totalMinor: 1499, currency: "PLN", method: "blik", paymentIds: [payment.id], lifetime: false, lifetimePaymentId: null });
    expect(record.consents).toEqual({ termsVersion: "patron-2026-10-draft", waiverAt: "2026-10-21T10:00:00.000Z" });
    const days = (new Date(record.expiresAt!).getTime() - new Date(record.grantedAt).getTime()) / DAY;
    expect(days).toBe(30);
    expect(db.userPaymentTotal.rows[0]).toMatchObject({ userId: "user_1", currency: "PLN", amountMinor: 1499 });
    expect(db.patronGrant.rows).toHaveLength(0);
    expect(sendBecomePatronEmail).not.toHaveBeenCalled();
    expect(sendDonationThankYouEmail).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(JSON.stringify(record)).not.toMatch(/@|email/i);
  });

  it("is idempotent: a replayed event and a second event for the same payment grant nothing more", async () => {
    const payment = seedPatronPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(payment), { id: "evt_same" }));
    const first = grant()!;

    const replay = await POST(signedRequest("payment_intent.succeeded", intent(payment), { id: "evt_same" }));
    const other = await POST(signedRequest("payment_intent.succeeded", intent(payment), { id: "evt_other" }));

    expect(replay.status).toBe(200);
    expect(other.status).toBe(200);
    expect(grant()).toEqual(first);
    expect(db.userPaymentTotal.rows[0].amountMinor).toBe(1499);
  });

  it("a second 30-day payment while access is active extends it from its end", async () => {
    const first = seedPatronPayment();
    const second = seedPatronPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(first)));
    const afterFirst = grant()!;
    await POST(signedRequest("payment_intent.succeeded", intent(second)));
    const afterSecond = grant()!;

    expect(new Date(afterFirst.expiresAt!).getTime() - new Date(afterFirst.grantedAt).getTime()).toBe(30 * DAY);
    expect(new Date(afterSecond.expiresAt!).getTime() - new Date(afterFirst.expiresAt!).getTime()).toBe(30 * DAY);
    expect(afterSecond).toMatchObject({ totalMinor: 2998, priceMinor: 1499, paymentIds: [first.id, second.id], grantedAt: afterFirst.grantedAt });
  });

  it("the unlimited option stores an explicit lifetime marker, not a far-future date", async () => {
    const payment = seedPatronPayment({ amountMinor: 2999, metadata: { purpose: "premium_pass", productId: "ACCESS_LIFETIME", method: "card" } });
    await POST(signedRequest("payment_intent.succeeded", intent(payment)));
    const record = grant()!;
    expect(record).toMatchObject({ productId: "ACCESS_LIFETIME", priceMinor: 2999, lifetime: true, lifetimePaymentId: payment.id, expiresAt: null, paymentIds: [payment.id] });
    expect(passStateOf(record, new Date("2099-01-01T00:00:00.000Z")).state).toBe("active");
    expect(JSON.stringify(record)).not.toMatch(/20[3-9]\d-|2[1-9]\d\d-/);
  });

  it("unlimited bought while a 30-day access runs converts it to lifetime; a later 30-day payment adds nothing", async () => {
    const first = seedPatronPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(first)));
    const running = grant()!;
    const life = seedPatronPayment({ amountMinor: 2999, metadata: { purpose: "premium_pass", productId: "ACCESS_LIFETIME" } });
    await POST(signedRequest("payment_intent.succeeded", intent(life)));
    const converted = grant()!;
    expect(converted).toMatchObject({ lifetime: true, lifetimePaymentId: life.id, totalMinor: 4498, grantedAt: running.grantedAt, paymentIds: [first.id, life.id] });
    const late = seedPatronPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(late)));
    expect(grant()).toMatchObject({ lifetime: true, expiresAt: converted.expiresAt, paymentIds: [first.id, life.id, late.id] });
  });

  it("after an ended access a new payment starts a fresh 30 days from now", async () => {
    db.appSetting.rows.push({
      key: "xp.premium_pass:user_1",
      value: JSON.stringify({ v: 2, provider: "STRIPE", ref: "old", priceMinor: 1000, totalMinor: 1000, currency: "PLN", method: "card", paymentIds: ["old"], grantedAt: "2026-01-01T10:00:00.000Z", expiresAt: "2026-01-31T10:00:00.000Z", consents: { termsVersion: "x", waiverAt: "2026-01-01T10:00:00.000Z" } }),
    });
    const payment = seedPatronPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(payment)));
    const record = grant()!;
    expect(new Date(record.expiresAt!).getTime() - Date.now()).toBeGreaterThan(29 * DAY);
    expect(new Date(record.expiresAt!).getTime() - Date.now()).toBeLessThanOrEqual(30 * DAY);
    // the list of applied payments is the idempotency memory: it survives the end of an access period
    expect(record.paymentIds).toEqual(["old", payment.id]);
    expect(record.totalMinor).toBe(2499);
    expect(record.grantedAt).not.toBe("2026-01-01T10:00:00.000Z");
  });

  it("never grants from an unsigned or wrongly signed event", async () => {
    const payment = seedPatronPayment();
    const res = await POST(signedRequest("payment_intent.succeeded", intent(payment), { secret: "whsec_someone_else" }));
    expect(res.status).toBe(400);
    const bare = await POST(new NextRequest("http://localhost/api/webhooks/stripe", { method: "POST", body: JSON.stringify({ type: "payment_intent.succeeded" }) }));
    expect(bare.status).toBeGreaterThanOrEqual(400);
    expect(payment.status).toBe("PENDING");
    expect(grant()).toBeNull();
  });

  it("never grants when the event's mode differs from the key's mode", async () => {
    const payment = seedPatronPayment();
    const res = await POST(signedRequest("payment_intent.succeeded", intent(payment), { livemode: true }));
    expect(res.status).toBe(200);
    expect(payment.status).toBe("PENDING");
    expect(grant()).toBeNull();
  });

  it("never grants when Stripe's amount differs from the local row (amount is decided server-side)", async () => {
    const payment = seedPatronPayment({ amountMinor: 2000 });
    const res = await POST(signedRequest("payment_intent.succeeded", intent(payment, { amount: 100_000 })));
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(payment.status).toBe("PENDING");
    expect(grant()).toBeNull();
  });

  it("fails closed: a payment whose amount or currency is not exactly the table's price for its product is recorded as received but grants no access", async () => {
    const life = { purpose: "premium_pass", productId: "ACCESS_LIFETIME" };
    const cases = [
      seedPatronPayment({ amountMinor: 200 }), // re-priced below
      seedPatronPayment({ amountMinor: 2999 }), // lifetime price on the 30-day product
      seedPatronPayment({ amountMinor: 1499, metadata: life }), // 30-day price on the lifetime product
      seedPatronPayment({ amountMinor: 1499, metadata: { purpose: "premium_pass", productId: "ACCESS_FOREVER" } }), // unknown product
      seedPatronPayment({ amountMinor: 1499, currency: "EUR" }), // PLN price paid in euro
      seedPatronPayment({ amountMinor: 399, currency: "PLN" }), // euro price paid in zloty
      seedPatronPayment({ amountMinor: 399, currency: "SEK" }), // a currency the table does not know
    ];
    for (const payment of cases) {
      const res = await POST(signedRequest("payment_intent.succeeded", intent(payment)));
      expect(res.status).toBe(200);
      expect(payment.status).toBe("SUCCEEDED");
    }
    expect(grant()).toBeNull();
  });

  it("another supported currency grants at its own table price and the record keeps the paid currency", async () => {
    const eur = seedPatronPayment({ amountMinor: 399, currency: "EUR" });
    await POST(signedRequest("payment_intent.succeeded", intent(eur)));
    expect(grant()).toMatchObject({ currency: "EUR", priceMinor: 399, totalMinor: 399, productId: "ACCESS_30D", lifetime: false });
    const usdLife = seedPatronPayment({ amountMinor: 899, currency: "USD", metadata: { purpose: "premium_pass", productId: "ACCESS_LIFETIME" } });
    await POST(signedRequest("payment_intent.succeeded", intent(usdLife)));
    // totals never mix currencies: the paid currency changed, so the running total restarts
    expect(grant()).toMatchObject({ currency: "USD", priceMinor: 899, totalMinor: 899, lifetime: true });
  });

  it("never grants when the intent metadata names another account", async () => {
    const payment = seedPatronPayment();
    const res = await POST(signedRequest("payment_intent.succeeded", intent(payment, { metadata: { paymentId: payment.id, userId: "intruder", purpose: "premium_pass" } })));
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(grant()).toBeNull();
  });

  it("a plain tip (no purpose) still gets the supporter marker and no access", async () => {
    const tip = seedPatronPayment({ metadata: {} });
    const res = await POST(signedRequest("payment_intent.succeeded", intent(tip, { metadata: { paymentId: tip.id, userId: "user_1" } })));
    expect(res.status).toBe(200);
    expect(db.patronGrant.rows).toHaveLength(1);
    expect(sendBecomePatronEmail).toHaveBeenCalledTimes(1);
    expect(grant()).toBeNull();
  });

  it("a full refund takes that payment's period back; a partial refund does not", async () => {
    const first = seedPatronPayment();
    const second = seedPatronPayment();
    await POST(signedRequest("payment_intent.succeeded", intent(first)));
    await POST(signedRequest("payment_intent.succeeded", intent(second)));
    const both = grant()!;
    const refundEvent = () => signedRequest("charge.refunded", { id: "ch_1", object: "charge", payment_intent: second.stripeIntentId, metadata: { paymentId: second.id } });

    stripeRefunds.set(second.stripeIntentId, [{ id: "re_1", amount: 500, status: "succeeded" }]);
    await POST(refundEvent());
    expect(grant()).toEqual(both);

    stripeRefunds.set(second.stripeIntentId, [{ id: "re_1", amount: 1499, status: "succeeded" }]);
    await POST(refundEvent());
    const after = grant()!;
    expect(second.status).toBe("REFUNDED");
    expect(after.paymentIds).toEqual([first.id]);
    expect(after.totalMinor).toBe(1499);
    expect(new Date(both.expiresAt!).getTime() - new Date(after.expiresAt!).getTime()).toBe(30 * DAY);
  });

  it("a full refund of the unlimited payment removes the lifetime marker; of a 30-day payment it leaves it", async () => {
    const thirty = seedPatronPayment();
    const life = seedPatronPayment({ amountMinor: 2999, metadata: { purpose: "premium_pass", productId: "ACCESS_LIFETIME" } });
    await POST(signedRequest("payment_intent.succeeded", intent(thirty)));
    await POST(signedRequest("payment_intent.succeeded", intent(life)));
    const refund = (p: { id: string; stripeIntentId: string }, amount: number) => {
      stripeRefunds.set(p.stripeIntentId, [{ id: `re_${p.id}`, amount, status: "succeeded" }]);
      return POST(signedRequest("charge.refunded", { id: `ch_${p.id}`, object: "charge", payment_intent: p.stripeIntentId, metadata: { paymentId: p.id } }));
    };
    await refund(thirty, 1499);
    expect(grant()).toMatchObject({ lifetime: true, lifetimePaymentId: life.id, paymentIds: [life.id] });
    await refund(life, 2999);
    const ended = grant()!;
    expect(ended).toMatchObject({ lifetime: false, lifetimePaymentId: null, paymentIds: [], totalMinor: 0 });
    expect(passStateOf(ended, new Date(Date.now() + 1000)).state).toBe("expired");
  });
});
