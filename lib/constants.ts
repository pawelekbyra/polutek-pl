export const DEFAULT_AVATAR_URL = 'https://www.dicebear.com/api/avataaars/anonymous.svg';

export const MIN_PATRON_AMOUNT = 5; // EUR/USD
export const MIN_PATRON_AMOUNT_PLN = 20; // PLN

export const SUPPORTED_CURRENCIES = ["PLN", "EUR", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const MIN_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 20,
  EUR: 5,
  USD: 5,
};

export const MAX_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 5000,
  EUR: 1000,
  USD: 1000,
};

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "pawelek.byra@gmail.com";

export const DISPLAY_EUR_TO_PLN_RATE = 4.3;
