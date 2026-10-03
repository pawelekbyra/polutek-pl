import { NextResponse } from 'next/server';
import { getPaymentCurrencyLimits } from '@/lib/payments/currency-settings';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** Public tip limits per currency (the minimum the tip gate shows is the one the server enforces). */
export async function GET() {
  try {
    return NextResponse.json({ limits: await getPaymentCurrencyLimits() });
  } catch (error) {
    return handleApiError(error);
  }
}
