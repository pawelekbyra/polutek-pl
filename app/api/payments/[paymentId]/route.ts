import { auth } from "@/lib/auth/server";
import { NextRequest, NextResponse } from 'next/server';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getOwnedPaymentStatus } from '@/lib/modules/payments';
import { handleApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // A PENDING payment is checked against the Stripe API on every call; the tip gate polls at
    // most ~10 times per payment, so this only stops scripted loops from burning the account's
    // shared Stripe API quota.
    const limited = await rateLimit({ key: `payment-status:${userId}`, limit: 60, windowMs: 60 * 1000 });
    if (!limited.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { paymentId } = await params;
    const ctx = createAppContext({ actor: { type: 'user', userId } });
    const result = await getOwnedPaymentStatus({ paymentId, userId }, ctx);
    if (!result.ok) return handleApiError(result.error);
    if (!result.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(result.data);
  } catch (error) {
    return handleApiError(error);
  }
}
