import { createScopedLogger } from "@/lib/logger";
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PaymentService } from '@/lib/services/payment.service';
import { recordAlert, recordDurationMetric, startTimer } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const requestId = headers().get('stripe-signature')?.slice(-20) || crypto.randomUUID();
  const scopedLogger = createScopedLogger(requestId);
  const startedAt = startTimer();
  const body = await req.text();
  const sig = headers().get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  try {
    await PaymentService.handleWebhook(body, sig);
    recordDurationMetric('stripe.webhook.request', startedAt, { status: 'success' });
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    scopedLogger.error(`Webhook Error: ${message}`);
    recordAlert('stripe.webhook.request_failed', { status: 'failed' });
    recordDurationMetric('stripe.webhook.request', startedAt, { status: 'failed' }, { level: 'error', alert: true });
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
  }
}
