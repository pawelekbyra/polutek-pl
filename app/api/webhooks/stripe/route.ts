import { NextResponse, NextRequest } from 'next/server';
import { createScopedLogger } from "@/lib/logger";
import { PaymentService } from '@/lib/services/payment.service';
import { handleApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || req.headers.get('stripe-signature')?.slice(-8) || 'stripe-webhook';
  const scopedLogger = createScopedLogger(requestId);
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  try {
    // Handle the webhook through centralized payment service
    await PaymentService.handleWebhook(body, sig);
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    scopedLogger.error('Stripe Webhook Error:', err);
    return handleApiError(err);
  }
}
