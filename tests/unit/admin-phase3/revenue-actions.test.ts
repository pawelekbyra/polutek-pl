import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  adminRefund: vi.fn(),
  adminDisputeSync: vi.fn(),
  getPaymentBrief: vi.fn(),
  guard: { requireAdmin: vi.fn(async () => ({ userId: "adm1", email: "o@x", name: "O", sessionCreatedAt: "", stepUpSecondsLeft: 0 })), hasFreshStepUp: vi.fn(async () => true) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-ray": "ray1", "cf-connecting-ip": "203.0.113.5" }) }));
vi.mock("@/lib/modules/payments", () => ({ adminRefund: m.adminRefund, adminDisputeSync: m.adminDisputeSync }));
vi.mock("@/lib/modules/admin-revenue", async () => ({ ...(await vi.importActual<object>("@/lib/modules/admin-revenue")), getPaymentBrief: m.getPaymentBrief }));
vi.mock("@admin/lib/auth/guard", () => m.guard);

import { refundAction, syncDisputeAction } from "@admin/app/(panel)/przychody/actions";
import { resetRateLimits } from "@admin/lib/actions/rate-limit";

const KEY = "0b9a6a8e-1111-4222-8333-123456789abc";
const base = { paymentId: "p1", mode: "partial" as const, amount: "12,50", stripeReason: "requested_by_customer" as const, note: "prośba wspierającego", idempotencyKey: KEY };
const brief = { id: "p1", status: "SUCCEEDED", amountMinor: 5000, refundedAmountMinor: 1000, currency: "PLN", email: "a@x.pl" };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  delete process.env.ADMIN_DEV_FIXTURES;
  m.guard.hasFreshStepUp.mockResolvedValue(true);
  m.getPaymentBrief.mockResolvedValue(brief);
  m.adminRefund.mockResolvedValue({ ok: true, data: { stripeRefundId: "re_1", amountMinor: 1250, status: "succeeded" } });
});

describe("refundAction", () => {
  it("needs a fresh step-up and does nothing without it", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    expect(await refundAction(base)).toMatchObject({ ok: false, code: "STEP_UP_REQUIRED" });
    expect(m.adminRefund).not.toHaveBeenCalled();
  });

  it("passes amount in minor units, reason, Stripe reason and the idempotency key to the use case", async () => {
    const r = await refundAction(base);
    expect(r).toMatchObject({ ok: true, data: { amountMinor: 1250 } });
    expect(m.adminRefund).toHaveBeenCalledWith({ paymentId: "p1", amountMinor: 1250, reason: "prośba wspierającego", stripeReason: "requested_by_customer", idempotencyKey: KEY }, expect.objectContaining({ actor: { type: "admin", userId: "adm1" }, client: expect.objectContaining({ ip: "203.0.113.5" }) }));
  });

  it("a full refund refunds exactly what is left, never the original amount", async () => {
    await refundAction({ ...base, mode: "full", amount: undefined });
    expect(m.adminRefund.mock.calls[0][0].amountMinor).toBe(4000);
  });

  it("refuses more than is left, a malformed amount, a missing reason and extra fields", async () => {
    expect(await refundAction({ ...base, amount: "40,01" })).toMatchObject({ ok: false, fieldErrors: { amount: expect.stringContaining("zostało") } });
    expect(await refundAction({ ...base, amount: "1,234" })).toMatchObject({ ok: false, fieldErrors: { amount: expect.any(String) } });
    expect(await refundAction({ ...base, note: "ab" })).toMatchObject({ ok: false, fieldErrors: { note: expect.any(String) } });
    expect(await refundAction({ ...base, idempotencyKey: "short" })).toMatchObject({ ok: false, fieldErrors: { idempotencyKey: expect.any(String) } });
    expect(await refundAction({ ...base, extra: 1 } as never)).toMatchObject({ ok: false });
    expect(m.adminRefund).not.toHaveBeenCalled();
  });

  it("refuses a disputed payment and an unknown one", async () => {
    m.getPaymentBrief.mockResolvedValue({ ...brief, status: "DISPUTED" });
    expect(await refundAction(base)).toMatchObject({ ok: false, code: "DISPUTED" });
    m.getPaymentBrief.mockResolvedValue(null);
    expect(await refundAction(base)).toMatchObject({ ok: false, message: "Nie ma takiej wpłaty." });
    expect(m.adminRefund).not.toHaveBeenCalled();
  });

  it("is rate limited to 10 per 10 minutes", async () => {
    for (let i = 0; i < 10; i++) await refundAction(base);
    expect(await refundAction(base)).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });

  it("translates a Stripe failure into a Polish message without details", async () => {
    m.adminRefund.mockResolvedValue({ ok: false, error: { code: "PAYMENT_PROVIDER_ERROR", message: "Stripe refund failed. Details are in the server log." } });
    const r = await refundAction(base);
    expect(r).toMatchObject({ ok: false, code: "PAYMENT_PROVIDER_ERROR", message: expect.stringContaining("Stripe odrzucił") });
  });
});

describe("syncDisputeAction", () => {
  it("syncs through the use case and reports the Stripe status", async () => {
    m.adminDisputeSync.mockResolvedValue({ ok: true, data: { synced: true, disputeStatus: "needs_response", disputeId: "dp_1", message: "" } });
    expect(await syncDisputeAction({ paymentId: "p1" })).toMatchObject({ ok: true, message: expect.stringContaining("needs_response") });
    expect(await syncDisputeAction({ paymentId: "" })).toMatchObject({ ok: false });
  });
});
