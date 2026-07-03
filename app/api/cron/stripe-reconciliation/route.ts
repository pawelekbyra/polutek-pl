import { NextRequest, NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { PaymentStatus } from "@prisma/client";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { fulfillPayment } from "@/lib/modules/payments";
import Stripe from "stripe";
import { timingSafeEqual } from "crypto";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ''}`;

  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    logger.error("[Cron:StripeReconciliation] STRIPE_SECRET_KEY is missing");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
  const ctx = createAppContext({
    actor: { type: 'system', reason: 'stripe-reconciliation-cron' },
  });

  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const pendingPayments = await ctx.db.read.payment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      stripeIntentId: { not: null },
      createdAt: {
        lt: fifteenMinutesAgo,
        gt: sevenDaysAgo,
      },
    },
  });

  let checked = 0;
  let updated = 0;
  let errors = 0;

  for (const payment of pendingPayments) {
    checked++;
    try {
      if (!payment.stripeIntentId) continue;

      const intent = await stripe.paymentIntents.retrieve(payment.stripeIntentId);

      if (intent.status === 'succeeded') {
        const result = await fulfillPayment({
          paymentId: payment.id,
          stripeIntentId: payment.stripeIntentId,
          amountMinor: intent.amount,
          currency: intent.currency,
        }, ctx);

        if (result.ok) {
          logger.info(`[Cron:StripeReconciliation] Fulfilled payment ${payment.id} (Stripe succeeded)`);
          updated++;
        } else {
          logger.error(`[Cron:StripeReconciliation] Failed to fulfill payment ${payment.id}: ${result.error.message}`);
          errors++;
        }
      } else if (intent.status === 'canceled') {
        await ctx.db.writeTransaction(async (tx) => {
          await tx.payment.updateMany({
              where: { id: payment.id, status: PaymentStatus.PENDING },
              data: { status: PaymentStatus.FAILED }
          });
        });
        logger.info(`[Cron:StripeReconciliation] Marked payment ${payment.id} as FAILED (Stripe ${intent.status})`);
        updated++;
      } else if (intent.status === 'requires_payment_method') {
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (payment.createdAt < twentyFourHoursAgo) {
          await ctx.db.writeTransaction(async (tx) => {
            await tx.payment.updateMany({
                where: { id: payment.id, status: PaymentStatus.PENDING },
                data: { status: PaymentStatus.FAILED }
            });
          });
          logger.info(`[Cron:StripeReconciliation] Marked payment ${payment.id} as FAILED after 24h (Stripe ${intent.status})`);
          updated++;
        }
      } else {
        // Other statuses — skip
        continue;
      }
    } catch (err: any) {
      logger.error(`[Cron:StripeReconciliation] Error processing payment ${payment.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ checked, updated, errors });
}
