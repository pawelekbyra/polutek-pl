import { NextResponse, NextRequest } from 'next/server';
import { logger } from "@/lib/logger";
import { handleStripeWebhook, PaymentError } from '@/lib/modules/payments';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getCorrelationId } from '@/lib/utils/correlation';

export const dynamic = 'force-dynamic';

/**
 * Stripe → app. Public route (middleware `isPublicRoute`), authenticated by the Stripe signature
 * over the raw body, so the body is read once with `req.text()` and never parsed before
 * verification. 2xx tells Stripe to stop; any other status makes it retry (up to 3 days).
 */
export async function POST(req: NextRequest) {
  const requestId = getCorrelationId() || req.headers.get('x-request-id') || 'stripe-webhook';
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    logger.warn('[StripeWebhook] Rejected: request without a stripe-signature header.');
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  try {
    const ctx = createAppContext({
      actor: { type: 'system', reason: 'stripe-webhook' },
      requestId,
    });
    const result = await handleStripeWebhook({ body, signature }, ctx);

    if (!result.ok) {
      const error = result.error;
      const status = error instanceof PaymentError ? error.statusCode : 500;
      // Only the error code goes back to Stripe; details stay in our log.
      return NextResponse.json(
        {
          error: error instanceof PaymentError ? error.code : 'PAYMENT_WEBHOOK_PROCESSING_ERROR',
          message: status >= 500 ? 'Webhook processing failed' : error.message,
        },
        { status },
      );
    }

    return NextResponse.json(result.data);
  } catch (err: unknown) {
    logger.error('[StripeWebhook] Unexpected route error:', err);
    return NextResponse.json(
      { error: 'PAYMENT_WEBHOOK_PROCESSING_ERROR', message: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
