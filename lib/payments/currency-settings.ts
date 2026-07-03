import { prisma } from '@/lib/prisma';
import {
  MAX_PAYMENT_BY_CURRENCY,
  MIN_PAYMENT_BY_CURRENCY,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '@/lib/constants';

export type CurrencyLimit = {
  currency: SupportedCurrency;
  minAmountMinor: number;
  minAmount: number;
  maxAmountMinor: number;
  maxAmount: number;
};

export function getDefaultPaymentLimits(currency: SupportedCurrency): CurrencyLimit {
  return {
    currency,
    minAmountMinor: MIN_PAYMENT_BY_CURRENCY[currency] * 100,
    minAmount: MIN_PAYMENT_BY_CURRENCY[currency],
    maxAmountMinor: MAX_PAYMENT_BY_CURRENCY[currency] * 100,
    maxAmount: MAX_PAYMENT_BY_CURRENCY[currency],
  };
}

export async function getPaymentCurrencyLimits(): Promise<Record<SupportedCurrency, CurrencyLimit>> {
  const defaults = Object.fromEntries(
    SUPPORTED_CURRENCIES.map((currency) => [currency, getDefaultPaymentLimits(currency)]),
  ) as Record<SupportedCurrency, CurrencyLimit>;

  const settings = await prisma.paymentCurrencySetting?.findMany({
    where: { currency: { in: [...SUPPORTED_CURRENCIES] } },
  }).catch(() => []) ?? [];

  for (const setting of settings) {
    const currency = setting.currency as SupportedCurrency;
    if (!SUPPORTED_CURRENCIES.includes(currency)) continue;
    const fallback = defaults[currency];
    const minAmountMinor = Math.max(1, setting.minAmountMinor);
    defaults[currency] = {
      ...fallback,
      minAmountMinor,
      minAmount: minAmountMinor / 100,
    };
  }

  return defaults;
}

/**
 * Resolves the patron-eligibility threshold (in minor units) for a given currency.
 *
 * This is intentionally separate from `getPaymentCurrencyLimits()`, which controls the
 * *checkout minimum* (the smallest tip a user may send). The patron threshold is the amount
 * at or above which a successful tip grants lifetime patron access. When
 * `PATRON_MIN_TIP_AMOUNT` / `PATRON_MIN_TIP_CURRENCY` are configured and match the payment
 * currency, they raise the threshold above the checkout minimum without blocking smaller tips.
 * For any other currency (or when the env is unset), the threshold falls back to the checkout
 * minimum, preserving the prior behaviour.
 */
export function resolvePatronThresholdMinor(
  currency: SupportedCurrency,
  fallbackMinor: number,
): number {
  const configuredCurrency = process.env.PATRON_MIN_TIP_CURRENCY?.toUpperCase();
  const configuredAmount = Number(process.env.PATRON_MIN_TIP_AMOUNT);

  if (
    configuredCurrency === currency &&
    Number.isSafeInteger(configuredAmount) &&
    configuredAmount > 0
  ) {
    return Math.max(fallbackMinor, configuredAmount * 100);
  }

  return fallbackMinor;
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
