import { logger, createScopedLogger } from "@/lib/logger";
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PaymentService } from '@/lib/services/payment.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const requestId = headers().get('stripe-signature')?.slice(-20) || crypto.randomUUID();
  const scopedLogger = createScopedLogger(requestId);
  const body = await req.text();
  const sig = headers().get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  try {
    await PaymentService.handleWebhook(body, sig);
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    scopedLogger.error(`Webhook Error: ${message}`);
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
  }
}
