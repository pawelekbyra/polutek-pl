import { z } from 'zod';
import {
  MAX_PAYMENT_BY_CURRENCY,
  MIN_PAYMENT_BY_CURRENCY,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '@/lib/constants';

export const currencySchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.toUpperCase() : value),
  z.enum(SUPPORTED_CURRENCIES)
);

/**
 * Checkout flow uses amountMinor (integers) to avoid float precision issues.
 */
export const checkoutSchema = z.object({
  amountMinor: z.number().int().positive(),
  currency: currencySchema,
  // One UUID per tip attempt (kept while the payer changes the amount): the same attempt reuses
  // and updates one PaymentIntent instead of creating a new one per amount.
  requestId: z.string().uuid().optional(),
  // Version (LEGAL_DOCUMENTS_VERSION) of the Terms the payer ticked in the tip gate; recorded on the user.
  acceptedTermsVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function getPaymentLimitsMinor(currency: SupportedCurrency) {
  return {
    minAmountMinor: MIN_PAYMENT_BY_CURRENCY[currency] * 100,
    maxAmountMinor: MAX_PAYMENT_BY_CURRENCY[currency] * 100,
  };
}

export function validatePaymentAmountMinor(amountMinor: number, currency: SupportedCurrency) {
  const { minAmountMinor, maxAmountMinor } = getPaymentLimitsMinor(currency);

  if (amountMinor < minAmountMinor) {
    return `Kwota jest zbyt niska (min. ${minAmountMinor / 100} ${currency})`;
  }

  if (amountMinor > maxAmountMinor) {
    return `Kwota jest zbyt wysoka (max. ${maxAmountMinor / 100} ${currency})`;
  }

  return null;
}
