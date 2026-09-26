import { z } from 'zod';
import {
  MAX_PAYMENT_BY_CURRENCY,
  MIN_PAYMENT_BY_CURRENCY,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '@/lib/constants';

/**
 * Payment methods the tip gate lets the viewer pick up front. `card` also covers Apple Pay /
 * Google Pay (Stripe treats wallets as card payments).
 */
export const TIP_PAYMENT_METHODS = ['card', 'blik', 'p24'] as const;
export type TipPaymentMethod = (typeof TIP_PAYMENT_METHODS)[number];

/** Presentment currencies each method supports (Stripe: BLIK is PLN-only, P24 is PLN/EUR). */
export const TIP_PAYMENT_METHOD_CURRENCIES: Record<TipPaymentMethod, readonly SupportedCurrency[]> = {
  card: SUPPORTED_CURRENCIES,
  blik: ['PLN'],
  p24: ['PLN', 'EUR'],
};

export function isPaymentMethodAvailableForCurrency(method: TipPaymentMethod, currency: SupportedCurrency) {
  return TIP_PAYMENT_METHOD_CURRENCIES[method].includes(currency);
}

export const TIP_MESSAGE_MAX_LENGTH = 140;

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
  title: z.string().min(1).max(120),
  requestId: z.string().uuid().optional(), // Client-side UUID for idempotency
  // Omitted by the sidebar box: Stripe then offers every enabled method (automatic).
  paymentMethod: z.enum(TIP_PAYMENT_METHODS).optional(),
  // Optional private note to the creator; stored with the payment, never shown publicly.
  message: z.string().trim().max(TIP_MESSAGE_MAX_LENGTH).optional(),
}).refine(
  (value) => !value.paymentMethod || isPaymentMethodAvailableForCurrency(value.paymentMethod, value.currency),
  { message: 'Payment method is not available for this currency', path: ['paymentMethod'] },
);

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
