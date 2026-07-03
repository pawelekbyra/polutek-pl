import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { PaymentDto } from "../domain/payment.dto";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { recordMetric, recordAlert } from "@/lib/observability";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { grantPatron } from "@/lib/modules/patron";
import { getPaymentCurrencyLimits, resolvePatronThresholdMinor } from "@/lib/payments/currency-settings";
import { SupportedCurrency } from "@/lib/constants";
import { PaymentPolicy } from "../domain/payment.policy";
import { sendBecomePatronEmail, sendDonationThankYouEmail } from "@/lib/modules/email";
import { syncClerkAccess } from "@/lib/modules/users";
import { recordAuditEvent } from "@/lib/modules/audit";

export interface FulfillPaymentInput {
  paymentId: string;
  stripeIntentId?: string;
  /** @deprecated Stripe metadata user id, accepted only as a consistency check. */
  userId?: string;
  metadataUserId?: string | null;
  amountMinor: number;
  currency: string;
}

export async function fulfillPayment(
  input: FulfillPaymentInput,
  ctx: AppContext
): Promise<UseCaseResult<{ isFirstFulfillment: boolean }, PaymentError>> {
  const repo = new PaymentRepository();

  try {
    const result = await ctx.db.writeTransaction(async (tx): Promise<any> => {
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

      const user = await repo.findUserWithPaymentTotalsAndActivePatronGrants(payment.userId, tx);
      if (!user) throw new Error('USER_NOT_FOUND');

      // Atomic validated transition PENDING -> SUCCEEDED. All mutable Stripe inputs were
      // checked against the local Payment before any status, totals, or grant mutation.
      // If checkout created the Stripe intent but the local stripeIntentId write failed,
      // recover the webhook-provided intent id in the same CAS update that fulfills payment.
      const count = await repo.fulfillPendingPaymentWithCAS({
        id: payment.id,
        currentStripeIntentId: payment.stripeIntentId,
        stripeIntentId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      }, tx);

      if (count === 0) {
        if (payment.status !== PaymentStatus.SUCCEEDED) {
          logger.info(`[FulfillPayment] Payment ${input.paymentId} already fulfilled or not in a fulfillable state.`);
          return null;
        }
        logger.info(`[FulfillPayment] Payment ${input.paymentId} already SUCCEEDED; proceeding with replay-safe sync.`);
        return {
          userId: user.id,
          email: user.email,
          language: (user.language as 'pl' | 'en') || 'pl',
          isPatron: user.patronGrants.length > 0,
          normalizedTotal: normalizePaymentTotals(user.paymentTotals),
          becamePatronNow: false,
          isFirstFulfillment: false,
          wasEligible: false
        };
      }

      await repo.incrementUserPaymentTotal(payment.userId, payment.currency, payment.amountMinor, tx);

      const limits = await getPaymentCurrencyLimits();
      const currency = payment.currency.toUpperCase() as SupportedCurrency;
      const checkoutMinimumMinor = limits[currency]?.minAmountMinor;
      const thresholdMinor = checkoutMinimumMinor === undefined
        ? undefined
        : resolvePatronThresholdMinor(currency, checkoutMinimumMinor);

      const alreadyPatron = user.patronGrants.length > 0;

      const eligibility = PaymentPolicy.evaluatePaymentPatronEligibility({
        status: PaymentStatus.SUCCEEDED,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        thresholdMinor,
      });

      // A user with an active grant is already a permanent patron — PatronGrant has no
      // per-user uniqueness constraint (only per-paymentId), so without this guard a second
      // qualifying tip (e.g. an existing patron's optional extra support) would create a
      // redundant PatronGrant row and re-trigger the "become a patron" welcome email.
      const shouldGrant = eligibility.eligible && !alreadyPatron;

      let isPatron = alreadyPatron;
      let normalizedTotal = normalizePaymentTotals(user.paymentTotals);
      let becamePatronNow = false;

      if (shouldGrant) {
        const grantResult = await grantPatron({
          userId: payment.userId,
          source: 'stripe_tip',
          paymentId: payment.id,
          note: 'Granted after successful one-time Stripe tip',
        }, ctx, tx);

        if (!grantResult.ok) {
          throw new Error(`PATRON_GRANT_FAILED: ${grantResult.error.message}`);
        }

        isPatron = grantResult.data.isPatron;
        normalizedTotal = grantResult.data.normalizedTotal;
        becamePatronNow = true;
      } else {
        const reason = alreadyPatron ? 'ALREADY_PATRON' : eligibility.code;
        logger.info(`[FulfillPayment] Payment ${payment.id} did not trigger a new PatronGrant: ${reason}`);
        const updatedUser = await repo.findUserWithPaymentTotalsAndActivePatronGrants(payment.userId, tx);
        if (updatedUser) {
          normalizedTotal = normalizePaymentTotals(updatedUser.paymentTotals);
          isPatron = updatedUser.patronGrants.length > 0;
        }
      }

      return {
        userId: user.id,
        email: user.email,
        language: (user.language as 'pl' | 'en') || 'pl',
        isPatron,
        normalizedTotal,
        becamePatronNow,
        isFirstFulfillment: count > 0,
        wasEligible: shouldGrant
      };
    });

    if (!result) {
      return ok({ isFirstFulfillment: false });
    }

    await syncClerkAccess(result.userId, result.isPatron, result.normalizedTotal);

    if (result.isFirstFulfillment) {
      const { email, language, userId, becamePatronNow, wasEligible, isPatron } = result;
      const amount = input.amountMinor / 100;
      const currency = input.currency.toUpperCase();
      const shouldSendPatronEmail = becamePatronNow || (wasEligible && isPatron);

      try {
        if (shouldSendPatronEmail) {
          await sendBecomePatronEmail(email, amount, currency, language);
        } else {
          await sendDonationThankYouEmail(email, amount, currency, language);
        }
      } catch (error) {
        logger.error(`[EMAIL_FAILED] Payment fulfillment email failed for ${userId}`, error);
        await recordAuditEvent(ctx, {
          action: "EMAIL_SEND_FAILED",
          targetType: "Payment",
          targetId: input.paymentId,
          metadata: {
            emailType: shouldSendPatronEmail ? "become_patron" : "donation_thank_you",
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return ok({ isFirstFulfillment: result.isFirstFulfillment });
  } catch (error: any) {
    logger.error(`[FulfillPayment] Error fulfilling payment ${input.paymentId}:`, error);
    return fail(new PaymentError(error.message || 'Fulfillment failed'));
  }
}
