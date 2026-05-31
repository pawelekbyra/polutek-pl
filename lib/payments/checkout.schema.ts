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
 * TODO: Transition full checkout flow to amountMinor (integers).
 */
export const checkoutSchema = z.object({
  amount: z.number()
    .positive()
    .refine((value) => Number.isFinite(value), 'Amount must be finite')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'Amount must have at most two decimal places'),
  amountMinor: z.number().int().positive().optional(),
  currency: currencySchema,
  title: z.string().min(1).max(120),
  creatorId: z.string().uuid().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function getPaymentLimits(currency: SupportedCurrency) {
  return {
    minAmount: MIN_PAYMENT_BY_CURRENCY[currency],
    maxAmount: MAX_PAYMENT_BY_CURRENCY[currency],
  };
}

export function validatePaymentAmount(amount: number, currency: SupportedCurrency) {
  const { minAmount, maxAmount } = getPaymentLimits(currency);

  if (amount < minAmount) {
    return `Minimum parameters (min. ${minAmount} ${currency})`;
  }

  if (amount > maxAmount) {
    return `Maximum parameters (max. ${maxAmount} ${currency})`;
  }

  return null;
}
