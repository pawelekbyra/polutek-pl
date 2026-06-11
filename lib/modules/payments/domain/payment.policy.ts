import { Actor } from "@/lib/modules/shared/actor";
import { PaymentStatus } from "@prisma/client";

export interface PaymentPatronEligibility {
  eligible: boolean;
  code: 'ELIGIBLE' | 'BELOW_THRESHOLD' | 'PAYMENT_NOT_SUCCEEDED' | 'CURRENCY_NOT_SUPPORTED';
  threshold?: number;
  amount: number;
  currency: string;
}

export class PaymentPolicy {
  static evaluatePaymentPatronEligibility(params: {
    status: PaymentStatus;
    amountMinor: number;
    currency: string;
    thresholdMinor?: number;
  }): PaymentPatronEligibility {
    const currency = params.currency.toUpperCase();
    const amount = params.amountMinor / 100;
    const threshold = params.thresholdMinor ? params.thresholdMinor / 100 : undefined;

    if (params.status !== PaymentStatus.SUCCEEDED) {
      return {
        eligible: false,
        code: 'PAYMENT_NOT_SUCCEEDED',
        amount,
        currency,
        threshold
      };
    }

    if (!params.thresholdMinor) {
      return {
        eligible: false,
        code: 'CURRENCY_NOT_SUPPORTED',
        amount,
        currency,
        threshold
      };
    }

    if (params.amountMinor < params.thresholdMinor) {
      return {
        eligible: false,
        code: 'BELOW_THRESHOLD',
        amount,
        currency,
        threshold
      };
    }

    return {
      eligible: true,
      code: 'ELIGIBLE',
      amount,
      currency,
      threshold
    };
  }

  static canCreateCheckout(actor: Actor): boolean {
    return actor.type === 'user' || actor.type === 'admin';
  }

  static getStripeCurrency(currency: string): string {
    return currency.toLowerCase();
  }

  static getDbCurrency(currency: string): string {
    return currency.toUpperCase();
  }

  static canManagePaymentSettings(actor: Actor): boolean {
    return actor.type === 'admin';
  }
}
