import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getOwnedPaymentStatus } from '@/lib/modules/payments';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
