import { NextResponse, NextRequest } from 'next/server';
import { createScopedLogger } from "@/lib/logger";
import { handleStripeWebhook } from '@/lib/modules/payments';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { handleApiError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/utils/correlation';

export async function POST(req: NextRequest) {
  const requestId = getCorrelationId() || req.headers.get('stripe-signature')?.slice(-8) || 'stripe-webhook';
  const scopedLogger = createScopedLogger(requestId);
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  try {
    const ctx = createAppContext({ requestId });
    const result = await handleStripeWebhook({ body, signature }, ctx);

    if (!result.ok) {
        // Log error but return 200 for known non-critical issues if needed,
        // but here we follow handleApiError which might return 500
        return handleApiError(result.error);
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    scopedLogger.error('Stripe Webhook Route Error:', err);
    return handleApiError(err);
  }
}
