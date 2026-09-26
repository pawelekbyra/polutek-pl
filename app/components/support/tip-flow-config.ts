import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";

export type TipStep = "amount" | "method" | "pay";

export const TIP_CURRENCIES = SUPPORTED_CURRENCIES;

export const TIP_CURRENCY_LABELS: Record<SupportedCurrency, { flag: string; pl: string; en: string }> = {
  PLN: { flag: "🇵🇱", pl: "złoty (PLN)", en: "Polish złoty (PLN)" },
  EUR: { flag: "🇪🇺", pl: "euro (EUR)", en: "Euro (EUR)" },
  USD: { flag: "🇺🇸", pl: "dolar (USD)", en: "US dollar (USD)" },
  GBP: { flag: "🇬🇧", pl: "funt (GBP)", en: "British pound (GBP)" },
  CHF: { flag: "🇨🇭", pl: "frank (CHF)", en: "Swiss franc (CHF)" },
};

/** Tile used when Stripe didn't report a method list: opens Stripe's full form. */
export const TIP_FALLBACK_METHOD = "stripe_all";

/**
 * Stripe decides WHICH methods a tip can use (dashboard settings, currency, amount) and returns
 * them as `payment_method_types`; this only decides how a known method looks. A method Stripe
 * adds later without an entry here still gets a generic tile and Stripe's own form.
 */
const METHOD_COPY: Record<string, { icon: string; title: string; hintPl: string; hintEn: string }> = {
  blik: { icon: "📱", title: "BLIK", hintPl: "Kod z aplikacji banku", hintEn: "Code from your banking app" },
  p24: { icon: "🏦", title: "Przelewy24", hintPl: "Szybki przelew z Twojego banku", hintEn: "Instant transfer from your bank" },
  card: { icon: "💳", title: "Karta", hintPl: "Visa, Mastercard…", hintEn: "Visa, Mastercard…" },
  paypal: { icon: "🅿️", title: "PayPal", hintPl: "Konto PayPal", hintEn: "Your PayPal account" },
  revolut_pay: { icon: "🔁", title: "Revolut Pay", hintPl: "Aplikacja Revolut", hintEn: "Revolut app" },
  ideal: { icon: "🏦", title: "iDEAL", hintPl: "Bank w Holandii", hintEn: "Dutch bank transfer" },
  bancontact: { icon: "🏦", title: "Bancontact", hintPl: "Bank w Belgii", hintEn: "Belgian bank transfer" },
  eps: { icon: "🏦", title: "EPS", hintPl: "Bank w Austrii", hintEn: "Austrian bank transfer" },
  twint: { icon: "📱", title: "TWINT", hintPl: "Aplikacja TWINT", hintEn: "TWINT app" },
  mobilepay: { icon: "📱", title: "MobilePay", hintPl: "Aplikacja MobilePay", hintEn: "MobilePay app" },
  swish: { icon: "📱", title: "Swish", hintPl: "Aplikacja Swish", hintEn: "Swish app" },
  klarna: { icon: "🩷", title: "Klarna", hintPl: "Konto Klarna", hintEn: "Your Klarna account" },
  [TIP_FALLBACK_METHOD]: { icon: "💳", title: "Karta i inne", hintPl: "Wszystkie dostępne metody", hintEn: "All available methods" },
};

// Local instant methods first, then card, then accounts/wallets. Unknown methods go last.
const METHOD_ORDER = ["blik", "p24", "ideal", "bancontact", "eps", "twint", "swish", "mobilepay", "card", "paypal", "revolut_pay", "klarna"];

// Not shown as tiles: Link is Stripe's own saved-details network, and Apple/Google Pay get
// Stripe's real wallet button above the tiles instead.
const HIDDEN_TILE_METHODS = new Set(["link"]);

export function getTipMethodTiles(paymentMethodTypes: string[]): string[] {
  const rank = (type: string) => {
    const index = METHOD_ORDER.indexOf(type);
    return index === -1 ? METHOD_ORDER.length : index;
  };
  const tiles = [...new Set(paymentMethodTypes)]
    .filter((type) => !HIDDEN_TILE_METHODS.has(type))
    .sort((a, b) => rank(a) - rank(b));
  return tiles.length > 0 ? tiles : [TIP_FALLBACK_METHOD];
}

export function describeTipMethod(type: string, isPl: boolean) {
  const copy = METHOD_COPY[type];
  if (copy) {
    return {
      icon: copy.icon,
      title: !isPl && type === "card" ? "Card" : !isPl && type === TIP_FALLBACK_METHOD ? "Card and more" : copy.title,
      hint: isPl ? copy.hintPl : copy.hintEn,
    };
  }
  const title = type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { icon: "💸", title, hint: isPl ? "Inna metoda płatności" : "Another payment method" };
}

export function formatTipAmount(amount: number, currency: SupportedCurrency, language: string): string {
  try {
    return new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const LAST_METHOD_KEY = "tip-last-method";

export function readLastTipMethod(): string | null {
  try {
    return window.localStorage.getItem(LAST_METHOD_KEY);
  } catch {
    return null;
  }
}

export function rememberTipMethod(type: string) {
  try {
    window.localStorage.setItem(LAST_METHOD_KEY, type);
  } catch {
    // A per-viewer convenience only.
  }
}
