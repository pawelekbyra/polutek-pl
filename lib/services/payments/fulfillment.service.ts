import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { PaymentStatus, Prisma } from '@prisma/client';
import { EmailService } from '../email.service';
import { UserAccessService, normalizePaymentTotals } from '../user-access.service';
import { grantPatronStatus } from '../patron.service';
import { writeAuditLog } from '../audit.service';
import Stripe from 'stripe';


export class PaymentFulfillmentService {
  private static async sendPaymentEmailSafely(
    type: 'DONATION' | 'PATRON',
    email: string,
    amount: number,
    currency: string,
    language: 'pl' | 'en',
    userId: string,
    paymentId: string
  ): Promise<void> {
    try {
      if (type === 'DONATION') {
        await EmailService.sendDonationThankYouEmail(email, amount, currency, language);
      } else {
        await EmailService.sendBecomePatronEmail(email, amount, currency, language);
      }
    } catch (error) {
      logger.error(`[${type}_EMAIL_FAILED]`, error);
      await writeAuditLog({
        action: "EMAIL_SEND_FAILED",
        targetType: "Payment",
        targetId: paymentId,
        actorUserId: userId,
        metadata: {
          emailType: type === 'DONATION' ? "donation_thank_you" : "become_patron",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  static async fulfillPayment(intent: Stripe.PaymentIntent) {
    const paymentId = intent.metadata.paymentId;
    const userId = intent.metadata.userId;

    if (!paymentId || !userId) {
      logger.error('[PaymentFulfillmentService] Missing metadata in intent', intent.id);
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const { count } = await tx.payment.updateMany({
            where: { id: paymentId, status: PaymentStatus.PENDING },
            data: { status: PaymentStatus.SUCCEEDED }
        });

        const updatedPayment = await tx.payment.findUnique({ where: { id: paymentId } });

        if (count === 0) {
            if (updatedPayment?.status === PaymentStatus.SUCCEEDED) {
              logger.info(`[PaymentFulfillmentService] Payment ${paymentId} already SUCCEEDED; proceeding with replay-safe sync.`);
            } else {
              logger.info(`[PaymentFulfillmentService] Payment ${paymentId} already fulfilled or not in a fulfillable state.`);
              return null;
            }
        }

        if (!updatedPayment) throw new Error('PAYMENT_RECORD_LOST');

        if (updatedPayment.amountMinor !== intent.amount) {
            throw new Error(`PAYMENT_AMOUNT_MISMATCH: Expected ${updatedPayment.amountMinor}, got ${intent.amount}`);
        }
        if (updatedPayment.currency.toLowerCase() !== intent.currency.toLowerCase()) {
            throw new Error(`PAYMENT_CURRENCY_MISMATCH: Expected ${updatedPayment.currency}, got ${intent.currency}`);
        }

        const existingUser = await tx.user.findUnique({
            where: { id: userId },
            include: { paymentTotals: true }
        });

        if (!existingUser) throw new Error('USER_NOT_FOUND');

        let updatedTotal;
        if (count > 0) {
          updatedTotal = await tx.userPaymentTotal.upsert({
              where: { userId_currency: { userId, currency: updatedPayment.currency } },
              create: {
                  userId,
                  currency: updatedPayment.currency,
                  amountMinor: updatedPayment.amountMinor
              },
              update: {
                  amountMinor: { increment: updatedPayment.amountMinor }
              }
          });
        } else {
          updatedTotal = await tx.userPaymentTotal.findUnique({
              where: { userId_currency: { userId, currency: updatedPayment.currency } }
          });
          if (!updatedTotal) throw new Error('USER_PAYMENT_TOTAL_LOST');
        }

        // Any successful one-time Stripe tip that passed checkout minimum validation grants Patron status.
        const grantsPatron = true;
        let user = { ...existingUser, paymentTotals: existingUser.paymentTotals.map(t =>
            t.currency === updatedPayment.currency ? updatedTotal : t
        ) };
        let becamePatronNow = false;
        let normalizedTotal = normalizePaymentTotals(user.paymentTotals);

        if (grantsPatron) {
            const grantResult = await grantPatronStatus(userId, {
                source: 'stripe_tip',
                paymentId: updatedPayment.id,
                note: 'Granted after successful one-time Stripe tip',
            }, tx);
            user = grantResult.user;
            becamePatronNow = grantResult.becamePatronNow;
            normalizedTotal = grantResult.normalizedTotal;
        }

        return { user, becamePatronNow, normalizedTotal, isFirstFulfillment: count > 0 };
      });

      if (!result) return;
      const { user, becamePatronNow, normalizedTotal, isFirstFulfillment } = result;

      await UserAccessService.syncClerkAccess(user.id, user.isPatron, normalizedTotal);

      const language = (user.language as 'pl' | 'en') || 'pl';
      const amount = intent.amount / 100;

      if (isFirstFulfillment) {
          if (becamePatronNow) {
            await this.sendPaymentEmailSafely(
              'PATRON',
              user.email,
              amount,
              intent.currency.toUpperCase(),
              language,
              user.id,
              paymentId
            );
          } else {
            await this.sendPaymentEmailSafely(
              'DONATION',
              user.email,
              amount,
              intent.currency.toUpperCase(),
              language,
              user.id,
              paymentId
            );
          }
      }

      logger.info(`[PaymentFulfillmentService] Payment fulfilled for user ${userId}: ${amount} ${intent.currency}`);
    } catch (error) {
      logger.error('[PaymentFulfillmentService] Error fulfilling payment:', error);
      throw error;
    }
  }
}
