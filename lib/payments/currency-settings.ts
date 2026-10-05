import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  MAX_PAYMENT_BY_CURRENCY,
  MIN_PAYMENT_BY_CURRENCY,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '@/lib/constants';

/**
 * The tip limits per currency: one minimum (admin-configurable in /admin/payments) and the
 * built-in maximum. The tip gate shows the same minimum the server enforces.
 */
export type CurrencyLimit = {
  currency: SupportedCurrency;
  minAmountMinor: number;
  minAmount: number;
  maxAmountMinor: number;
  maxAmount: number;
};

/**
 * Stripe's hard minimum charge per currency (https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts).
 * A smaller amount makes paymentIntents.create fail, so a lower minimum saved in the panel (it accepts 1)
 * must never reach the gate: the effective minimum is never below this floor.
 */
export const STRIPE_MIN_CHARGE_MINOR: Record<SupportedCurrency, number> = { PLN: 200, EUR: 50, USD: 50, CHF: 50, GBP: 30 };

export function getDefaultPaymentLimits(currency: SupportedCurrency): CurrencyLimit {
  return {
    currency,
    minAmountMinor: MIN_PAYMENT_BY_CURRENCY[currency] * 100,
    minAmount: MIN_PAYMENT_BY_CURRENCY[currency],
    maxAmountMinor: MAX_PAYMENT_BY_CURRENCY[currency] * 100,
    maxAmount: MAX_PAYMENT_BY_CURRENCY[currency],
  };
}

/**
 * Effective minimum of a stored row: the minimum set in the panel, never below what Stripe can charge.
 * (The legacy `patronBoxMinMinor` / `patronThresholdMinor` columns were folded into `minAmountMinor` and
 * dropped by migration 20261005210000; the minimum users see did not change.)
 */
function effectiveMinMinor(setting: { currency: string; minAmountMinor: number }): number {
  const stripeFloor = STRIPE_MIN_CHARGE_MINOR[setting.currency as SupportedCurrency] ?? 1;
  return Math.max(stripeFloor, setting.minAmountMinor);
}

export async function getPaymentCurrencyLimits(): Promise<Record<SupportedCurrency, CurrencyLimit>> {
  const limits = Object.fromEntries(
    SUPPORTED_CURRENCIES.map((currency) => [currency, getDefaultPaymentLimits(currency)]),
  ) as Record<SupportedCurrency, CurrencyLimit>;

  let settings;
  try {
    settings = await prisma.paymentCurrencySetting.findMany({
      where: { currency: { in: [...SUPPORTED_CURRENCIES] } },
    });
  } catch (error) {
    // Never fall back to built-in defaults silently: the gate and the server would then use a
    // different minimum than the one set in the panel.
    logger.error('[PaymentSettings] Could not read payment currency settings', error);
    throw error;
  }

  for (const setting of settings) {
    const currency = setting.currency as SupportedCurrency;
    if (!SUPPORTED_CURRENCIES.includes(currency)) continue;
    const minAmountMinor = effectiveMinMinor(setting);
    limits[currency] = { ...limits[currency], minAmountMinor, minAmount: minAmountMinor / 100 };
  }

  return limits;
}

export async function getPaymentLimit(currency: SupportedCurrency) {
  const limits = await getPaymentCurrencyLimits();
  return limits[currency];
}

export async function validatePaymentAmountMinorAsync(amountMinor: number, currency: SupportedCurrency) {
  const { minAmountMinor, maxAmountMinor } = await getPaymentLimit(currency);

  if (amountMinor < minAmountMinor) {
    return `Kwota jest zbyt niska (min. ${minAmountMinor / 100} ${currency})`;
  }

  if (amountMinor > maxAmountMinor) {
    return `Kwota jest zbyt wysoka (max. ${maxAmountMinor / 100} ${currency})`;
  }

  return null;
}
