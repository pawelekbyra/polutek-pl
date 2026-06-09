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
import { EmailService } from "@/lib/services/email.service";
import { UserAccessService } from "@/lib/services/user-access.service";
import { writeAuditLog } from "@/lib/services/audit.service";

export interface FulfillPaymentInput {
  paymentId: string;
  userId: string;
  amountMinor: number;
  currency: string;
}

export async function fulfillPayment(
  input: FulfillPaymentInput,
  ctx: AppContext
): Promise<UseCaseResult<{ isFirstFulfillment: boolean }, PaymentError>> {
  const repo = new PaymentRepository();

  try {
    const result = await ctx.db.writeTransaction(async (tx) => {
      // 1. CAS Update status PENDING -> SUCCEEDED
      const count = await repo.updatePaymentStatusWithCAS(input.paymentId, PaymentStatus.PENDING, PaymentStatus.SUCCEEDED, tx);

      const payment = await repo.findById(input.paymentId, tx);
      if (!payment) {
        throw new Error('PAYMENT_RECORD_LOST');
      }

      if (count === 0) {
        if (payment.status === PaymentStatus.SUCCEEDED) {
          logger.info(`[FulfillPayment] Payment ${input.paymentId} already SUCCEEDED; proceeding with replay-safe sync.`);
        } else {
          logger.info(`[FulfillPayment] Payment ${input.paymentId} already fulfilled or not in a fulfillable state.`);
          return null;
        }
      }

      // 2. Verification
      if (payment.amountMinor !== input.amountMinor) {
        throw new Error(`PAYMENT_AMOUNT_MISMATCH: Expected ${payment.amountMinor}, got ${input.amountMinor}`);
      }
      if (payment.currency.toLowerCase() !== input.currency.toLowerCase()) {
        throw new Error(`PAYMENT_CURRENCY_MISMATCH: Expected ${payment.currency}, got ${input.currency}`);
      }

      // 3. Update User Totals
      const user = await repo.findUserWithTotals(input.userId, tx);
      if (!user) throw new Error('USER_NOT_FOUND');

      let updatedTotal;
      if (count > 0) {
        updatedTotal = await repo.incrementUserPaymentTotal(input.userId, payment.currency, payment.amountMinor, tx);
      } else {
        updatedTotal = user.paymentTotals.find(t => t.currency === payment.currency);
        if (!updatedTotal) throw new Error('USER_PAYMENT_TOTAL_LOST');
      }

      // 4. Grant Patron Status
      // Current business rule: any successful one-time tip grants Patron status
      const grantResult = await grantPatron({
        userId: input.userId,
        source: 'stripe_tip',
        paymentId: payment.id,
        note: 'Granted after successful one-time Stripe tip',
      }, ctx, tx);

      if (!grantResult.ok) {
        throw new Error(`PATRON_GRANT_FAILED: ${grantResult.error.message}`);
      }

      return {
        userId: user.id,
        email: user.email,
        language: (user.language as 'pl' | 'en') || 'pl',
        isPatron: grantResult.data.isPatron,
        normalizedTotal: grantResult.data.normalizedTotal,
        becamePatronNow: true, // simplified for bridge compatibility, though grant-patron has its own logic
        isFirstFulfillment: count > 0
      };
    });

    if (!result) {
      return ok({ isFirstFulfillment: false });
    }

    // 5. Side Effects (Post-Commit style, though here still in the use case flow)
    await UserAccessService.syncClerkAccess(result.userId, result.isPatron, result.normalizedTotal);

    if (result.isFirstFulfillment) {
      const { email, language, userId, isPatron } = result;
      const amount = input.amountMinor / 100;
      const currency = input.currency.toUpperCase();

      try {
        if (isPatron) {
          await EmailService.sendBecomePatronEmail(email, amount, currency, language);
        } else {
          await EmailService.sendDonationThankYouEmail(email, amount, currency, language);
        }
      } catch (error) {
        logger.error(`[EMAIL_FAILED] Payment fulfillment email failed for ${userId}`, error);
        await writeAuditLog({
          action: "EMAIL_SEND_FAILED",
          targetType: "Payment",
          targetId: input.paymentId,
          actorUserId: userId,
          metadata: {
            emailType: isPatron ? "become_patron" : "donation_thank_you",
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
