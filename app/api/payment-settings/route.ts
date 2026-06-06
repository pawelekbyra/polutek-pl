import { NextResponse } from 'next/server';
import { getPaymentCurrencyLimits } from '@/lib/payments/currency-settings';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const limits = await getPaymentCurrencyLimits();
    return NextResponse.json({ limits });
  } catch (error) {
    return handleApiError(error);
  }
}
