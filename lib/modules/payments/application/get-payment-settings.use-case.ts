import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { MIN_PAYMENT_BY_CURRENCY, MAX_PAYMENT_BY_CURRENCY } from "@/lib/constants";

export type CurrencyLimitDto = {
  currency: SupportedCurrency;
  minAmountMinor: number;
  minAmount: number;
  maxAmountMinor: number;
  maxAmount: number;
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
        return [currency, {
            currency,
            minAmountMinor: minAmount * 100,
            minAmount: minAmount,
            maxAmountMinor: maxAmount * 100,
            maxAmount: maxAmount,
        }];
    })
  ) as Record<SupportedCurrency, CurrencyLimitDto>;

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

  return ok(defaults);
}
