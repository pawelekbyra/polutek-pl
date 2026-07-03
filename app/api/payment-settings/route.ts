import { NextResponse } from 'next/server';
import { getPaymentCurrencyLimits, resolvePatronThresholdMinor } from '@/lib/payments/currency-settings';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/constants';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const limits = await getPaymentCurrencyLimits();

    const patronThresholds = Object.fromEntries(
      SUPPORTED_CURRENCIES.map((currency: SupportedCurrency) => {
        const thresholdMinor = resolvePatronThresholdMinor(currency, limits[currency].minAmountMinor);
        return [currency, { thresholdMinor, threshold: thresholdMinor / 100 }];
      }),
    );

    return NextResponse.json({ limits, patronThresholds });
  } catch (error) {
    return handleApiError(error);
  }
}
