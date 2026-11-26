import { AppContext } from "@/lib/modules/shared/app-context";
import { logger } from "@/lib/logger";
import { recordAlert } from "@/lib/observability";
import { recordAuditEvent } from "@/lib/modules/audit";
import { sendPurchaseConfirmationEmail, type PurchaseConfirmationEmailInput } from "@/lib/modules/email";
import { isVatExempt } from "@/lib/config/vat";
import { paymentKeySet, secretKeyIsLive } from "@/lib/payments/stripe-key-sets";
import { isPremiumPassPayment } from "../domain/payment.purpose";
import { readConfirmationMarker, SqlPurchaseConfirmationStore, type PurchaseConfirmationStore } from "../infrastructure/purchase-confirmation.store";

/** The seller named in the Premium terms (the same name, NBSP included, as SELLER_NAME in app/components/premium-pass/pass-copy.ts; a test keeps them equal). */
export const PURCHASE_CONFIRMATION_SELLER = "Paweł Perfect";

export type PurchaseConfirmationOutcome =
  | { status: "sent" }
  | { status: "skipped"; reason: "not_premium" | "not_paid" | "no_recipient" | "already_sent" | "busy" | "exhausted" }
  | { status: "failed"; error: string };

export interface PurchaseConfirmationDeps {
  store: PurchaseConfirmationStore;
  send: typeof sendPurchaseConfirmationEmail;
}

const defaultDeps = (): PurchaseConfirmationDeps => ({ store: new SqlPurchaseConfirmationStore(), send: sendPurchaseConfirmationEmail });

type Lang = "pl" | "en";

/** "Dostęp Premium na 30 dni" / "Premium access for 3 months": the length comes from the plan table, never a literal. */
function serviceName(duration: { days?: number; months?: number } | null, language: Lang): string {
  if (!duration) return language === "pl" ? "Dostęp Premium" : "Premium access";
  if (typeof duration.months === "number") {
    const n = duration.months;
    return language === "pl"
      ? `Dostęp Premium na ${n} ${n === 1 ? "miesiąc" : n >= 2 && n <= 4 ? "miesiące" : "miesięcy"}`
      : `Premium access for ${n} ${n === 1 ? "month" : "months"}`;
  }
  const d = duration.days ?? 30;
  return language === "pl" ? `Dostęp Premium na ${d} ${d === 1 ? "dzień" : "dni"}` : `Premium access for ${d} ${d === 1 ? "day" : "days"}`;
}

/**
 * Sends the "Potwierdzenie zakupu" mail for a Premium payment AT MOST ONCE per payment, however often it is called
 * (first fulfilment, webhook replay, fast path, cron, concurrent). The once-guarantee is the atomic claim of
 * `Payment.metadata.purchaseConfirmation` (infrastructure/purchase-confirmation.store.ts); a failed send is recorded
 * (audit + alert) and retried by a LATER call after a pause, up to a limit. Never throws and never touches the
 * payment or the access: the money and the access are already recorded when this runs.
 */
export async function ensurePurchaseConfirmation(
  input: { paymentId: string },
  ctx: AppContext,
  injected?: PurchaseConfirmationDeps,
): Promise<PurchaseConfirmationOutcome> {
  try {
    const deps = injected ?? defaultDeps();
    const payment = await ctx.db.read.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, status: true, amountMinor: true, currency: true, metadata: true, user: { select: { email: true, language: true, isDeleted: true } } },
    });
    if (!payment || !isPremiumPassPayment(payment.metadata)) return { status: "skipped", reason: "not_premium" };
    if (payment.status !== "SUCCEEDED") return { status: "skipped", reason: "not_paid" };
    if (!payment.user?.email || payment.user.isDeleted) return { status: "skipped", reason: "no_recipient" };
    if (readConfirmationMarker(payment.metadata)?.state === "sent") return { status: "skipped", reason: "already_sent" };

    const claim = await ctx.db.writeTransaction((tx) => deps.store.claim(payment.id, ctx.now(), tx));
    if (!claim.claimed) {
      if (claim.reason === "sent") return { status: "skipped", reason: "already_sent" };
      if (claim.reason === "exhausted") {
        recordAlert("premium_pass.confirmation_email_gave_up", { paymentId: payment.id });
        return { status: "skipped", reason: "exhausted" };
      }
      return { status: "skipped", reason: claim.reason === "busy" ? "busy" : "not_paid" };
    }

    const { patronProduct, readPaymentConsents, readPaymentProductId } = await import("@/lib/modules/patron-zone");
    const language: Lang = payment.user.language === "pl" ? "pl" : "en";
    const consents = readPaymentConsents(payment.metadata);
    const waiverAt = consents ? new Date(consents.waiverAt) : null;
    const email: PurchaseConfirmationEmailInput = {
      to: payment.user.email,
      language,
      orderNumber: payment.id,
      serviceName: serviceName(patronProduct(readPaymentProductId(payment.metadata))?.duration ?? null, language),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      paidAt: claim.paidAt,
      waiverAt: waiverAt && !Number.isNaN(waiverAt.getTime()) ? waiverAt : null,
      vatExempt: isVatExempt(),
      sellerName: PURCHASE_CONFIRMATION_SELLER,
      // Only keys that are recognisably Stripe TEST keys mark a test order; unknown never hides a real purchase.
      testMode: secretKeyIsLive(paymentKeySet(payment.metadata)) === false,
    };

    let error: string | null = null;
    try {
      const result = await deps.send(email);
      if (!result.ok) error = result.error;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    if (error === null) {
      await ctx.db.writeTransaction((tx) => deps.store.markSent(payment.id, ctx.now(), tx));
      return { status: "sent" };
    }

    logger.error(`[PurchaseConfirmation] mail for payment ${payment.id} failed (attempt ${claim.attempts})`);
    recordAlert("premium_pass.confirmation_email_failed", { paymentId: payment.id, attempt: claim.attempts });
    await ctx.db.writeTransaction((tx) => deps.store.markFailed(payment.id, ctx.now(), error as string, tx));
    await recordAuditEvent(ctx, {
      action: "EMAIL_SEND_FAILED",
      targetType: "Payment",
      targetId: payment.id,
      metadata: { emailType: "purchase_confirmation", attempt: claim.attempts, error },
    });
    return { status: "failed", error };
  } catch (e) {
    // The payment is already recorded; a problem here (database, audit) must never fail the fulfilment.
    logger.error(`[PurchaseConfirmation] unexpected error for payment ${input.paymentId}`, e);
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
