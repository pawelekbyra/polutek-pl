import { NextRequest, NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { PaymentStatus } from "@prisma/client";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { reconcilePaymentWithStripe, reconcileRefundsWithStripe } from "@/lib/modules/payments";
import { timingSafeEqual } from "crypto";

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;
const RECOVERY_BATCH_SIZE = 500;

/**
 * Safety net next to the webhook and the payment-status fast path (systemd timer every 15 min).
 *
 * Routine run: every PENDING payment older than 15 minutes, oldest first, in batches. Stripe's
 * answer decides: succeeded → fulfillPayment(); canceled → CANCELED; still unpaid after 24 h →
 * the intent is canceled in Stripe and the row CANCELED, so abandoned tips don't stay open.
 *
 * Each run also checks the refunds of up to 25 paid payments not checked for 6 h against Stripe's refund list
 * (see reconcileRefundsWithStripe), so the refund ledger converges without a working webhook.
 *
 * `?scope=recover` (run once by hand after deploying the PAY-01 fix): also re-checks FAILED and
 * CANCELED rows, which older code wrote after a single failed attempt even when a later attempt
 * on the same intent succeeded.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ''}`;

  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    logger.error("[Cron:StripeReconciliation] STRIPE_SECRET_KEY is missing");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const recover = req.nextUrl.searchParams.get('scope') === 'recover';
  const ctx = createAppContext({
    actor: { type: 'system', reason: 'stripe-reconciliation-cron' },
  });

  const now = ctx.now();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const payments = await ctx.db.read.payment.findMany({
    where: {
      status: { in: recover ? [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELED] : [PaymentStatus.PENDING] },
      createdAt: { lt: fifteenMinutesAgo },
    },
    orderBy: { createdAt: 'asc' },
    take: recover ? RECOVERY_BATCH_SIZE : BATCH_SIZE,
    select: { id: true, status: true, stripeIntentId: true, createdAt: true },
  });

  const counts = { checked: 0, fulfilled: 0, canceled: 0, unchanged: 0, errors: 0 };

  for (const payment of payments) {
    counts.checked++;
    const result = await reconcilePaymentWithStripe(payment, ctx);
    counts[result]++;
  }

  // Refund ledger (PA-04): Stripe's refund list is the truth; catches missed webhooks, Dashboard refunds
  // and refunds that failed later. A failure here must not hide the payment pass above.
  let refunds = { checked: 0, corrected: 0, errors: 0 };
  try {
    refunds = await reconcileRefundsWithStripe(ctx);
  } catch (error) {
    logger.error('[Cron:StripeReconciliation] refund pass failed', error);
    refunds.errors = 1;
  }

  logger.info(`[Cron:StripeReconciliation] ${recover ? 'recover' : 'routine'} run: ${JSON.stringify({ ...counts, refunds })}`);
  return NextResponse.json({ scope: recover ? 'recover' : 'routine', ...counts, refunds });
}
