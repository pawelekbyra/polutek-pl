import { Actor } from "@/lib/modules/shared/actor";

export class PaymentPolicy {
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
