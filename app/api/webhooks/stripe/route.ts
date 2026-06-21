import { NextResponse, NextRequest } from 'next/server';
import { createScopedLogger } from "@/lib/logger";
import { handleStripeWebhook } from '@/lib/modules/payments';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { handleApiError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/utils/correlation';

function isSignatureFailure(error: unknown) {
  if (!(error instanceof Error)) return false;

  return error.message.toLowerCase().includes('signature');
}

function webhookFailureResponse(error: unknown) {
  if (isSignatureFailure(error)) {
    return handleApiError(error);
  }

  const message = error instanceof Error ? error.message : 'Webhook processing failed';

  return NextResponse.json(
    { error: 'PAYMENT_WEBHOOK_PROCESSING_ERROR', message },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  const requestId = getCorrelationId() || req.headers.get('stripe-signature')?.slice(-8) || 'stripe-webhook';
  const scopedLogger = createScopedLogger(requestId);
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  try {
    const ctx = createAppContext({
      actor: { type: 'system', reason: 'stripe-webhook' },
      requestId,
    });
    const result = await handleStripeWebhook({ body, signature }, ctx);

    if (!result.ok) {
      return webhookFailureResponse(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err: unknown) {
    scopedLogger.error('Stripe Webhook Route Error:', err);
    return handleApiError(err);
  }
}
