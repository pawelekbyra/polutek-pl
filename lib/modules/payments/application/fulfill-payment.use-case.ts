import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { grantPatron } from "@/lib/modules/patron";
import { getPaymentCurrencyLimits } from "@/lib/payments/currency-settings";
import { SupportedCurrency } from "@/lib/constants";
import { PaymentPolicy } from "../domain/payment.policy";
import { EmailService } from "@/lib/services/email.service";
import { UserAccessService } from "@/lib/services/user-access.service";
import { writeAuditLog } from "@/lib/services/audit.service";

export interface FulfillPaymentInput {
  paymentId: string;
  stripeIntentId?: string;
  metadataUserId?: string;
  /** Stripe metadata userId; local Payment.userId remains the access source of truth. */
  userId?: string;
  amountMinor: number;
  currency: string;
}

const fulfillableStatuses = new Set<PaymentStatus>([PaymentStatus.PENDING]);

export async function fulfillPayment(
  input: FulfillPaymentInput,
  ctx: AppContext
): Promise<UseCaseResult<{ isFirstFulfillment: boolean }, PaymentError>> {
  const repo = new PaymentRepository();

  try {
    const result = await ctx.db.writeTransaction(async (tx): Promise<any> => {
      const payment = await repo.findById(input.paymentId, tx);
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');

      const metadataUserId = input.metadataUserId ?? input.userId;
      if (metadataUserId && metadataUserId !== payment.userId) {
        throw new Error('PAYMENT_METADATA_USER_MISMATCH');
      }
      const stripeIntentId = input.stripeIntentId ?? payment.stripeIntentId;
      if (!stripeIntentId || payment.stripeIntentId !== stripeIntentId) {
        throw new Error('PAYMENT_STRIPE_INTENT_MISMATCH');
      }
      if (payment.amountMinor !== input.amountMinor) {
        throw new Error(`PAYMENT_AMOUNT_MISMATCH: Expected ${payment.amountMinor}, got ${input.amountMinor}`);
      }
      if (payment.currency.toLowerCase() !== input.currency.toLowerCase()) {
        throw new Error(`PAYMENT_CURRENCY_MISMATCH: Expected ${payment.currency}, got ${input.currency}`);
      }

      const user = await repo.findUserWithTotals(payment.userId, tx);
      if (!user) throw new Error('USER_NOT_FOUND');

      if (payment.status === PaymentStatus.SUCCEEDED) {
        logger.info(`[FulfillPayment] Payment ${payment.id} already SUCCEEDED; replay-safe sync only.`);
        return {
          userId: user.id,
          isPatron: user.isPatron,
          normalizedTotal: normalizePaymentTotals(user.paymentTotals),
          isFirstFulfillment: false,
        };
      }

      if (!fulfillableStatuses.has(payment.status)) {
        logger.info(`[FulfillPayment] Payment ${payment.id} is not fulfillable from status ${payment.status}.`);
        return null;
      }

      const count = await repo.markPaymentSucceededIfMatches({
        paymentId: payment.id,
        stripeIntentId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      }, tx);

      if (count === 0) {
        const latest = await repo.findById(payment.id, tx);
        if (latest?.status === PaymentStatus.SUCCEEDED) {
          return {
            userId: user.id,
            isPatron: user.isPatron,
            normalizedTotal: normalizePaymentTotals(user.paymentTotals),
            isFirstFulfillment: false,
          };
        }
        throw new Error('PAYMENT_FULFILLMENT_CAS_CONFLICT');
      }

      await repo.incrementUserPaymentTotal(payment.userId, payment.currency, payment.amountMinor, tx);

      const limits = await getPaymentCurrencyLimits();
      const currency = payment.currency.toUpperCase() as SupportedCurrency;
      const thresholdMinor = limits[currency]?.minAmountMinor;
      const eligibility = PaymentPolicy.evaluatePaymentPatronEligibility({
        status: PaymentStatus.SUCCEEDED,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        thresholdMinor,
      });

      let isPatron = user.isPatron;
      let normalizedTotal = normalizePaymentTotals(user.paymentTotals);
      let becamePatronNow = false;

      if (eligibility.eligible) {
        const grantResult = await grantPatron({
          userId: payment.userId,
          source: 'stripe_tip',
          paymentId: payment.id,
          note: 'Granted after successful one-time Stripe tip',
        }, ctx, tx);
        if (!grantResult.ok) throw new Error(`PATRON_GRANT_FAILED: ${grantResult.error.message}`);
        isPatron = grantResult.data.isPatron;
        normalizedTotal = grantResult.data.normalizedTotal;
        becamePatronNow = true;
      } else {
        const updatedUser = await repo.findUserWithTotals(payment.userId, tx);
        if (updatedUser) normalizedTotal = normalizePaymentTotals(updatedUser.paymentTotals);
      }

      return {
        userId: user.id,
        email: user.email,
        language: (user.language as 'pl' | 'en') || 'pl',
        isPatron,
        normalizedTotal,
        becamePatronNow,
        isFirstFulfillment: true,
        wasEligible: eligibility.eligible,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      };
    });

    if (!result) return ok({ isFirstFulfillment: false });

    await UserAccessService.syncClerkAccess(result.userId, result.isPatron, result.normalizedTotal);

    if (result.isFirstFulfillment) {
      const shouldSendPatronEmail = result.becamePatronNow || (result.wasEligible && result.isPatron);
      try {
        if (shouldSendPatronEmail) {
          await EmailService.sendBecomePatronEmail(result.email, result.amountMinor / 100, result.currency.toUpperCase(), result.language);
        } else {
          await EmailService.sendDonationThankYouEmail(result.email, result.amountMinor / 100, result.currency.toUpperCase(), result.language);
        }
      } catch (error) {
        logger.error(`[EMAIL_FAILED] Payment fulfillment email failed for ${result.userId}`, error);
        await writeAuditLog({
          action: "EMAIL_SEND_FAILED",
          targetType: "Payment",
          targetId: input.paymentId,
          actorUserId: result.userId,
          metadata: { emailType: shouldSendPatronEmail ? "become_patron" : "donation_thank_you", error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    return ok({ isFirstFulfillment: result.isFirstFulfillment });
  } catch (error: any) {
    logger.error(`[FulfillPayment] Error fulfilling payment ${input.paymentId}:`, error);
    return fail(new PaymentError(error.message || 'Fulfillment failed'));
  }
}
