import { NextResponse } from 'next/server';
import { getPaymentCurrencyLimits } from '@/lib/payments/currency-settings';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/constants';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const limits = await getPaymentCurrencyLimits();

    // Two distinct minimums, both per-currency and admin-configurable:
    //  - patronThresholds: the fixed gate price a non-patron must pay to unlock lifetime access.
    //  - patronBoxMinimums: the smallest amount an existing patron may add via the free-amount box.
    const patronThresholds = Object.fromEntries(
      SUPPORTED_CURRENCIES.map((currency: SupportedCurrency) => [
        currency,
        { thresholdMinor: limits[currency].patronThresholdMinor, threshold: limits[currency].patronThreshold },
      ]),
    );

    const patronBoxMinimums = Object.fromEntries(
      SUPPORTED_CURRENCIES.map((currency: SupportedCurrency) => [
        currency,
        { minMinor: limits[currency].patronBoxMinMinor, min: limits[currency].patronBoxMin },
      ]),
    );

    return NextResponse.json({ limits, patronThresholds, patronBoxMinimums });
  } catch (error) {
    return handleApiError(error);
  }
}
