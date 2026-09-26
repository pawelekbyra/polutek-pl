import { NextResponse } from 'next/server';
import { getPaymentCurrencyLimits } from '@/lib/payments/currency-settings';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/constants';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const limits = await getPaymentCurrencyLimits();

    // Two distinct minimums, both per-currency and admin-configurable:
    //  - patronThresholds: a tip at or above this records a PatronGrant (supporter badge only —
    //    it unlocks nothing, CLAUDE.md §4.1).
    //  - patronBoxMinimums: the smallest tip the free-amount box accepts.
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
