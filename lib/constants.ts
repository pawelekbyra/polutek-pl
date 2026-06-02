export const DEFAULT_AVATAR_URL = 'https://www.dicebear.com/api/avataaars/anonymous.svg';

export const MIN_PATRON_AMOUNT = 5; // EUR/USD/GBP/CHF
export const MIN_PATRON_AMOUNT_PLN = 20; // PLN

export const SUPPORTED_CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const MIN_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 20,
  EUR: 5,
  USD: 5,
  GBP: 5,
  CHF: 5,
};

export const MIN_PATRON_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: MIN_PATRON_AMOUNT_PLN,
  EUR: MIN_PATRON_AMOUNT,
  USD: MIN_PATRON_AMOUNT,
  GBP: MIN_PATRON_AMOUNT,
  CHF: MIN_PATRON_AMOUNT,
};

export const MAX_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 5000,
  EUR: 1000,
  USD: 1000,
  GBP: 1000,
  CHF: 1000,
};

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.local";

export const DISPLAY_EUR_TO_PLN_RATE = Number(process.env.DISPLAY_EUR_TO_PLN_RATE) || 4.3;
