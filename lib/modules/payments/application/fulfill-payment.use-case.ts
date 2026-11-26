import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { recordAlert } from "@/lib/observability";
import { sendSupportThanksNotification } from "@/lib/modules/patron";
import { sendBecomePatronEmail, sendDonationThankYouEmail } from "@/lib/modules/email";
import { recordAuditEvent } from "@/lib/modules/audit";
import { ensureSupporterGrant } from "./supporter-grant";
import { isPremiumPassPayment } from "../domain/payment.purpose";
import { ensurePurchaseConfirmation } from "./send-purchase-confirmation.use-case";

export interface FulfillPaymentInput {
  paymentId: string;
  stripeIntentId?: string;
  /** @deprecated Stripe metadata user id, accepted only as a consistency check. */
  userId?: string;
  metadataUserId?: string | null;
  amountMinor: number;
  currency: string;
  /**
   * False skips the thank-you e-mail and notification (used when old payments are recovered
   * long after the fact, so nobody gets a "thanks" for a tip from months ago).
   */
  notifyPayer?: boolean;
}

/**
 * The one canonical, replay-safe path that records a tip Stripe reports as `succeeded`
 * (webhook, payment-status fast path, reconciliation cron). Validates the Stripe data against
 * the local row, moves it to SUCCEEDED with a CAS (also from FAILED/CANCELED, see
 * PaymentRepository.fulfillPaymentWithCAS), adds the supporter marker and, after the commit,
 * thanks the payer exactly once. A Premium payment gets no thank-you but the "Potwierdzenie zakupu" mail (the
 * consumer's confirmation of the contract and of the consent to immediate performance, send-purchase-confirmation
 * .use-case.ts): at most once per payment, also on a replay of the event, whatever `notifyPayer` says.
 */
export async function fulfillPayment(
  input: FulfillPaymentInput,
  ctx: AppContext
): Promise<UseCaseResult<{ isFirstFulfillment: boolean }, PaymentError>> {
  const repo = new PaymentRepository();
  // Set when the payment turns out to be already recorded (a replay): a Premium one may still owe its confirmation mail.
  let replayedPremium = false;

  try {
    const result = await ctx.db.writeTransaction(async (tx) => {
      if (!input.paymentId) throw new Error('PAYMENT_ID_MISSING');
      const payment = await repo.findById(input.paymentId, tx);
      if (!payment) {
        throw new Error('PAYMENT_NOT_FOUND');
      }

      const metadataUserId = input.metadataUserId ?? input.userId ?? null;
      if (payment.userId && metadataUserId && metadataUserId !== payment.userId) {
        recordAlert('payment.metadata_user_mismatch', { paymentId: payment.id });
        throw new Error('PAYMENT_METADATA_USER_MISMATCH');
      }
      const stripeIntentId = input.stripeIntentId ?? payment.stripeIntentId;
      if (payment.stripeIntentId && payment.stripeIntentId !== stripeIntentId) {
        throw new Error(`PAYMENT_STRIPE_INTENT_MISMATCH: Expected ${payment.stripeIntentId}, got ${input.stripeIntentId}`);
      }
      if (payment.amountMinor !== input.amountMinor) {
        throw new Error(`PAYMENT_AMOUNT_MISMATCH: Expected ${payment.amountMinor}, got ${input.amountMinor}`);
      }
      if (payment.currency.toLowerCase() !== input.currency.toLowerCase()) {
        throw new Error(`PAYMENT_CURRENCY_MISMATCH: Expected ${payment.currency}, got ${input.currency}`);
      }

      const user = await repo.findUser(payment.userId, tx);
      if (!user) throw new Error('USER_NOT_FOUND');

      // All mutable Stripe inputs were checked against the local Payment above. If checkout
      // created the Stripe intent but the local stripeIntentId write failed, the same CAS update
      // recovers the intent id.
      const count = await repo.fulfillPaymentWithCAS({
        id: payment.id,
        currentStripeIntentId: payment.stripeIntentId,
        stripeIntentId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      }, tx);

      if (count === 0) {
        logger.info(`[FulfillPayment] Payment ${payment.id} already recorded (status ${payment.status}); nothing to do.`);
        replayedPremium = isPremiumPassPayment(payment.metadata);
        return null;
      }

      await repo.incrementUserPaymentTotal(payment.userId, payment.currency, payment.amountMinor, tx);

      // patron zone (docs/architecture/patron-zone.md): a patron-zone payment is not a tip. It grants the
      // patron-zone access (extending it when still active) here, in the same transaction as the CAS, so the payment
      // and the access are recorded together or not at all; it adds no supporter marker and sends no tip thank-you.
      const premium = isPremiumPassPayment(payment.metadata);
      if (premium) {
        const { grantPatronAccessForPayment, readPaymentConsents, readPaymentProductId } = await import("@/lib/modules/patron-zone");
        const method = (payment.metadata as { method?: unknown } | null)?.method;
        await grantPatronAccessForPayment(tx, {
          userId: payment.userId,
          paymentId: payment.id,
          productId: readPaymentProductId(payment.metadata),
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          method: typeof method === 'string' ? method : null,
          consents: readPaymentConsents(payment.metadata),
          now: ctx.now(),
        });
      }

      // "wpłacił = patron": every successful tip marks the payer, no amount threshold.
      const { created } = premium ? { created: false } : await ensureSupporterGrant({ userId: payment.userId, paymentId: payment.id }, ctx, tx);

      if (payment.status !== PaymentStatus.PENDING) {
        logger.warn(`[FulfillPayment] Payment ${payment.id} recovered from ${payment.status}: Stripe reports it succeeded.`);
        recordAlert('payment.recovered_from_terminal_status', { paymentId: payment.id, previousStatus: payment.status });
      }

      return {
        userId: user.id,
        email: user.email,
        // Polish only for a Polish account; every other interface language gets English e-mails.
        language: user.language === 'pl' ? 'pl' as const : 'en' as const,
        becameSupporterNow: created,
        premium,
      };
    });

    if (!result) {
      // Replay (webhook retry, fast path, cron): the confirmation is sent only if an earlier send failed or never ran.
      if (replayedPremium) await confirmPurchase(input.paymentId, ctx);
      return ok({ isFirstFulfillment: false });
    }

    if (result.premium) {
      // After the commit, never inside it: the money and the access are recorded whatever happens to the mail.
      await confirmPurchase(input.paymentId, ctx);
    } else if (input.notifyPayer !== false) {
      await thankPayer(input, result, ctx);
    }

    return ok({ isFirstFulfillment: true });
  } catch (error: any) {
    logger.error(`[FulfillPayment] Error fulfilling payment ${input.paymentId}:`, error);
    return fail(new PaymentError(error.message || 'Fulfillment failed'));
  }
}

/** The purchase confirmation never throws by design; this is the belt and braces: a mail problem must not undo a recorded payment. */
async function confirmPurchase(paymentId: string, ctx: AppContext) {
  try {
    await ensurePurchaseConfirmation({ paymentId }, ctx);
  } catch (error) {
    logger.error(`[FulfillPayment] Purchase confirmation for ${paymentId} threw`, error);
  }
}

/**
 * Runs after the commit and only for the first fulfilment (the CAS guarantees "at most once").
 * Failures never undo the recorded payment: they are logged and audited.
 */
async function thankPayer(
  input: FulfillPaymentInput,
  payer: { userId: string; email: string; language: 'pl' | 'en'; becameSupporterNow: boolean },
  ctx: AppContext,
) {
  const amount = input.amountMinor / 100;
  const currency = input.currency.toUpperCase();

  if (payer.becameSupporterNow) {
    await sendSupportThanksNotification(payer.userId);
  }

  try {
    if (payer.becameSupporterNow) {
      await sendBecomePatronEmail(payer.email, amount, currency, payer.language);
    } else {
      await sendDonationThankYouEmail(payer.email, amount, currency, payer.language);
    }
  } catch (error) {
    logger.error(`[EMAIL_FAILED] Payment fulfillment email failed for ${payer.userId}`, error);
    await recordAuditEvent(ctx, {
      action: "EMAIL_SEND_FAILED",
      targetType: "Payment",
      targetId: input.paymentId,
      metadata: {
        emailType: payer.becameSupporterNow ? "become_patron" : "donation_thank_you",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
