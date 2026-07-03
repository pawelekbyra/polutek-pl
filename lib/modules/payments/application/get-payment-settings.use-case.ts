import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { MIN_PAYMENT_BY_CURRENCY, MAX_PAYMENT_BY_CURRENCY } from "@/lib/constants";
import { resolvePatronThresholdMinor } from "@/lib/payments/currency-settings";

export type CurrencyLimitDto = {
  currency: SupportedCurrency;
  minAmountMinor: number;
  minAmount: number;
  maxAmountMinor: number;
  maxAmount: number;
  // Patron-eligibility gate price (fixed amount for non-patrons).
  patronThresholdMinor: number;
  patronThreshold: number;
  // Minimum for the free-amount patron support box.
  patronBoxMinMinor: number;
  patronBoxMin: number;
};

export async function getPaymentSettings(
  ctx: AppContext
): Promise<UseCaseResult<Record<SupportedCurrency, CurrencyLimitDto>>> {
  const repo = new PaymentRepository();
  const settings = await repo.getCurrencySettings(ctx.db.read);

  const defaults = Object.fromEntries(
    SUPPORTED_CURRENCIES.map((currency) => {
        const minAmount = MIN_PAYMENT_BY_CURRENCY[currency];
        const maxAmount = MAX_PAYMENT_BY_CURRENCY[currency];
        const minAmountMinor = minAmount * 100;
        return [currency, {
            currency,
            minAmountMinor,
            minAmount: minAmount,
            maxAmountMinor: maxAmount * 100,
            maxAmount: maxAmount,
            patronThresholdMinor: minAmountMinor,
            patronThreshold: minAmount,
            patronBoxMinMinor: minAmountMinor,
            patronBoxMin: minAmount,
        }];
    })
  ) as Record<SupportedCurrency, CurrencyLimitDto>;

  for (const setting of settings) {
    const currency = setting.currency as SupportedCurrency;
    if (!SUPPORTED_CURRENCIES.includes(currency)) continue;
    const fallback = defaults[currency];
    const minAmountMinor = Math.max(1, setting.minAmountMinor);
    const patronThresholdMinor = resolvePatronThresholdMinor(
      currency,
      minAmountMinor,
      setting.patronThresholdMinor ?? null,
    );
    const patronBoxMinMinor = Math.max(minAmountMinor, setting.patronBoxMinMinor ?? minAmountMinor);
    defaults[currency] = {
      ...fallback,
      minAmountMinor,
      minAmount: minAmountMinor / 100,
      patronThresholdMinor,
      patronThreshold: patronThresholdMinor / 100,
      patronBoxMinMinor,
      patronBoxMin: patronBoxMinMinor / 100,
    };
  }

  return ok(defaults);
}
