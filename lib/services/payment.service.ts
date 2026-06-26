import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { PaymentStatus, WebhookEventStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { UserAccessService } from './user-access.service';
import { PaymentCheckoutService } from './payments/checkout.service';
import { PaymentFulfillmentService } from './payments/fulfillment.service';
import { PaymentRefundService, calculateRefundAdjustment } from './payments/refund.service';
import { recordAlert, recordDurationMetric, recordMetric, startTimer } from '@/lib/observability';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing');
  return new Stripe(key);
}

function getSafeStripeEventPayload(event: Stripe.Event): Prisma.InputJsonValue {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    object: event.object,
  };
}

export { PaymentCheckoutService, PaymentFulfillmentService, PaymentRefundService };

/**
 * @deprecated Use specialized services from @/lib/services/payments/ or modular use cases from @/lib/modules/payments
 */
export { calculateRefundAdjustment, calculateChargebackNetAdjustment, applyLostChargeback } from './payments/refund.service';

/**
 * @deprecated Use modular use cases from @/lib/modules/payments.
 * R10 cleanup candidate.
 */
export class PaymentService {
  static createPayment = PaymentCheckoutService.createPayment.bind(PaymentCheckoutService);
  static fulfillPayment = PaymentFulfillmentService.fulfillPayment.bind(PaymentFulfillmentService);

  static async handleWebhook(body: string, sig: string) {
    const startedAt = startTimer();
    const stripe = getStripe();
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET is missing');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: unknown) {
      throw new Error(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const STRIPE_STALE_MS = 10 * 60_000;
    try {
      await prisma.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
          status: WebhookEventStatus.PROCESSING,
          payload: getSafeStripeEventPayload(event)
        }
      });
      logger.info(`[StripeWebhook] Lock acquired for new event: ${event.id} (${event.type})`);
      recordMetric('stripe.webhook.lock_acquired', { eventType: event.type });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - STRIPE_STALE_MS);

        const { count } = await prisma.stripeEvent.updateMany({
          where: {
            id: event.id,
            OR: [
              { status: WebhookEventStatus.FAILED },
              { status: WebhookEventStatus.PROCESSING, updatedAt: { lt: staleThreshold } }
            ]
          },
          data: { status: WebhookEventStatus.PROCESSING, updatedAt: now, error: null }
        });

        if (count === 0) {
          const existing = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
          if (existing?.status === WebhookEventStatus.PROCESSED) {
            logger.info(`[PaymentService] Event ${event.id} (${event.type}) already PROCESSED.`);
            recordMetric('stripe.webhook.duplicate_event', { eventType: event.type, status: existing.status });
          } else {
            logger.info(`[PaymentService] Event ${event.id} (${event.type}) lock not acquired. Status: ${existing?.status}.`);
            recordAlert('stripe.webhook.lock_conflict', { eventType: event.type, status: existing?.status || 'unknown' });
          }
          return;
        }
      } else {
        throw e;
      }
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const intent = event.data.object as Stripe.PaymentIntent;
                await this.fulfillPayment(intent);
                break;
            }
            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge;
                await this.handleRefund(charge);
                break;
            }
            case 'charge.dispute.created':
            case 'charge.dispute.closed': {
                const dispute = event.data.object as Stripe.Dispute;
                const syncData = await this.handleDispute(dispute);
                if (syncData) {
                    await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal);
                }
                break;
            }
            case 'payment_intent.payment_failed': {
                const intent = event.data.object as Stripe.PaymentIntent;
                const { count } = await prisma.payment.updateMany({
                    where: { stripeIntentId: intent.id },
                    data: { status: PaymentStatus.FAILED }
                });
                recordAlert('payment.failure', { matchedPayments: count, currency: intent.currency || 'unknown', stripeIntentId: intent.id });
                break;
            }
        }

        await prisma.stripeEvent.update({
            where: { id: event.id },
            data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() }
        });
        logger.info(`[StripeWebhook] Event ${event.id} (${event.type}) PROCESSED successfully.`);
        recordDurationMetric('stripe.webhook.processing_time', startedAt, { eventType: event.type, status: 'processed' });
    } catch (error: unknown) {
        logger.error(`[PaymentService] Error handling event ${event.id}:`, error);
        recordDurationMetric('stripe.webhook.processing_time', startedAt, { eventType: event.type, status: 'failed' }, { level: 'error', alert: true });
        await prisma.stripeEvent.update({
            where: { id: event.id },
            data: {
                status: WebhookEventStatus.FAILED,
                error: error instanceof Error ? error.message : String(error)
            }
        });
        throw error;
    }
  }

  private static async handleRefund(charge: Stripe.Charge) {
    const paymentId = charge.metadata?.paymentId;
    const stripeIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

    logger.info(`[PaymentService] Handling refund. paymentId=${paymentId || 'none'}, intentId=${stripeIntentId || 'none'}`);

    const syncData = await prisma.$transaction(async (tx) => {
        const payment = paymentId
          ? await tx.payment.findUnique({ where: { id: paymentId } })
          : stripeIntentId
            ? await tx.payment.findUnique({ where: { stripeIntentId } })
            : null;

        if (!payment) {
          recordAlert('payment.refund_unmatched', { hasPaymentId: Boolean(paymentId), hasStripeIntentId: Boolean(stripeIntentId) });
          return null;
        }

        const reportedRefundedMinor = charge.amount_refunded || 0;
        const refund = calculateRefundAdjustment(payment, reportedRefundedMinor);
        if (!refund.status) return null;
        recordMetric('payment.refund_received', { status: refund.status, deltaMinor: refund.deltaRefundMinor, fullRefund: refund.isFullRefund });

        const { count } = await tx.payment.updateMany({
            where: { id: payment.id, refundedAmountMinor: payment.refundedAmountMinor ?? 0 },
            data: { refundedAmountMinor: refund.newRefundedAmountMinor, status: refund.status }
        });

        if (count === 0) {
          recordAlert('payment.refund_cas_conflict', { paymentStatus: payment.status });
          return null;
        }

        await PaymentRefundService.decrementUserTotals(tx, payment.userId, payment.currency, refund.deltaRefundMinor);

        if (refund.isFullRefund) {
            await tx.patronGrant.updateMany({ where: { paymentId: payment.id, revokedAt: null }, data: { revokedAt: new Date(), reason: 'Payment fully refunded' } });
        }

        const { isPatron, normalizedTotal } = await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
        return { userId: payment.userId, isPatron, normalizedTotal };
    });

    if (syncData) {
        await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal).catch(e => logger.error("[PaymentService] Post-refund sync failed:", e));
    }
    return syncData;
  }

  private static async handleDispute(dispute: Stripe.Dispute) {
    const stripeIntentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
    if (!stripeIntentId) {
      recordAlert('payment.dispute_missing_intent', { disputeStatus: dispute.status });
      return;
    }

    const payment = await prisma.payment.findUnique({ where: { stripeIntentId } });
    if (!payment) {
      recordAlert('payment.dispute_unmatched', { disputeStatus: dispute.status });
      return;
    }

    if (dispute.status === 'lost') {
        const syncData = await prisma.$transaction(async (tx) => {
            await PaymentRefundService.applyLostChargeback(tx, payment, dispute.status);
            const { isPatron, normalizedTotal } = await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
            return { userId: payment.userId, isPatron, normalizedTotal };
        });
        if (syncData) await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal).catch(e => logger.error("[PaymentService] Post-dispute sync failed:", e));
        recordAlert('payment.dispute_lost', { currency: payment.currency });
        return syncData;
    }

    if (dispute.status === 'won') {
        const syncData = await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.SUCCEEDED }
            });
            const { isPatron, normalizedTotal } = await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
            return { userId: payment.userId, isPatron, normalizedTotal };
        });
        if (syncData) await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal).catch(e => logger.error("[PaymentService] Post-dispute-win sync failed:", e));
        logger.info(`[PaymentService] Dispute WON for payment ${payment.id}. Patron status restored if applicable.`);
        return syncData;
    }

    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.DISPUTED } });
    recordAlert('payment.dispute_opened', { disputeStatus: dispute.status, currency: payment.currency });
  }
}
