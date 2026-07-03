import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentPolicy } from "../domain/payment.policy";
import { PaymentError } from "../domain/payment.errors";
import { SupportedCurrency } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CurrencyLimitDto, getPaymentSettings } from "./get-payment-settings.use-case";

export interface UpdatePaymentSettingsInput {
  limits: Array<{
    currency: SupportedCurrency;
    minAmount: number;
    // Optional: patron gate price and free-amount patron-box minimum (major units).
    patronThreshold?: number | null;
    patronBoxMin?: number | null;
  }>;
}

function toMinorOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export async function updatePaymentSettings(
  input: UpdatePaymentSettingsInput,
  ctx: AppContext
): Promise<UseCaseResult<Record<SupportedCurrency, CurrencyLimitDto>, PaymentError>> {
  if (!PaymentPolicy.canManagePaymentSettings(ctx.actor)) {
    return fail(new PaymentError("Forbidden: Cannot manage payment settings"));
  }

  const repo = new PaymentRepository();

  await ctx.db.writeTransaction(async (tx) => {
    for (const limit of input.limits) {
      await repo.upsertCurrencySetting(
        limit.currency,
        {
          minAmountMinor: Math.round(limit.minAmount * 100),
          patronThresholdMinor: toMinorOrNull(limit.patronThreshold),
          patronBoxMinMinor: toMinorOrNull(limit.patronBoxMin),
        },
        tx,
      );
    }

    await recordAuditEvent(ctx, {
      action: 'PAYMENT_SETTINGS_UPDATED',
      targetType: 'PaymentCurrencySetting',
      targetId: 'global',
      metadata: { currencies: input.limits.map((l) => l.currency) },
    }, tx);
  });

  return getPaymentSettings(ctx);
}
