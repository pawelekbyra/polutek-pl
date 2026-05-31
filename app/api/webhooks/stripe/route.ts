import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PaymentService } from '@/lib/services/payment.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  try {
    await PaymentService.handleWebhook(body, sig);
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error(`[STRIPE_WEBHOOK_ERROR]`, err);
    // Return a generic error message to Stripe
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
  }
}
