import { NextResponse, NextRequest } from 'next/server';
import { logger } from "@/lib/logger";
import { handleStripeWebhook, PaymentError } from '@/lib/modules/payments';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getCorrelationId } from '@/lib/utils/correlation';
import { RequestBodyTooLargeError, readRequestTextWithLimit } from '@/lib/utils/request-body';

export const dynamic = 'force-dynamic';

/** Stripe events are a few KB (a dispute with evidence can reach some hundred KB); anything past this is not Stripe (audit S03). */
const MAX_STRIPE_WEBHOOK_BODY_BYTES = 1_000_000;

/**
 * Stripe → app. Public route (middleware `isPublicRoute`), authenticated by the Stripe signature
 * over the raw body, so the body is read once with `req.text()` and never parsed before
 * verification. 2xx tells Stripe to stop; any other status makes it retry (up to 3 days).
 */
export async function POST(req: NextRequest) {
  const requestId = getCorrelationId() || req.headers.get('x-request-id') || 'stripe-webhook';
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    logger.warn('[StripeWebhook] Rejected: request without a stripe-signature header.');
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  // Read with a byte limit, before anything is buffered whole and before the signature check.
  let body: string;
  try {
    body = await readRequestTextWithLimit(req, MAX_STRIPE_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      logger.warn('[StripeWebhook] Rejected: payload too large.');
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    throw error;
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
