import type { ComponentType } from "react";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import {
  ApplePayIcon,
  BankIcon,
  BLIKIcon,
  BancontactIcon,
  CryptoIcon,
  GenericCardIcon,
  GooglePayIcon,
  IDEALIcon,
  KlarnaIcon,
  MobilePayIcon,
  PayPalIcon,
  Przelewy24Icon,
  RevolutIcon,
  SwishIcon,
  TWINTIcon,
  VisaIcon,
} from "@/app/components/icons/brand-icons";

export type TipStep = "recipient" | "amount" | "method" | "pay";

export const TIP_CURRENCIES = SUPPORTED_CURRENCIES;

export const TIP_CURRENCY_LABELS: Record<SupportedCurrency, { symbol: string; pl: string; en: string }> = {
  PLN: { symbol: "zł", pl: "Złoty (PLN)", en: "Polish złoty (PLN)" },
  EUR: { symbol: "€", pl: "Euro (EUR)", en: "Euro (EUR)" },
  USD: { symbol: "$", pl: "Dolar amerykański (USD)", en: "US dollar (USD)" },
  GBP: { symbol: "£", pl: "Funt brytyjski (GBP)", en: "British pound (GBP)" },
  CHF: { symbol: "Fr", pl: "Frank szwajcarski (CHF)", en: "Swiss franc (CHF)" },
};

/** Tile used when Stripe didn't report a method list: opens Stripe's full form. */
export const TIP_FALLBACK_METHOD = "stripe_all";

/** Placeholder only (owner's request): listed last, its pay step just says it's coming soon. */
// Not "crypto": that is a real Stripe payment method type and must never be shadowed.
export const TIP_CRYPTO_PLACEHOLDER = "crypto_placeholder";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * Stripe decides WHICH methods a tip can use (dashboard settings, currency, amount) and returns
 * them as `payment_method_types`; this only decides how a known method looks. A method Stripe
 * adds later without an entry here still gets a generic tile and Stripe's own form.
 */
const METHOD_COPY: Record<string, { icon: IconComponent; title: string; hintPl: string; hintEn: string }> = {
  blik: { icon: BLIKIcon, title: "BLIK", hintPl: "Kod z aplikacji banku", hintEn: "Code from your banking app" },
  p24: { icon: Przelewy24Icon, title: "Przelewy24", hintPl: "Szybki przelew z Twojego banku", hintEn: "Instant transfer from your bank" },
  apple_pay: { icon: ApplePayIcon, title: "Apple Pay", hintPl: "Szybko z Twojego urządzenia", hintEn: "Quick from your device" },
  google_pay: { icon: GooglePayIcon, title: "Google Pay", hintPl: "Szybko z Twojego telefonu", hintEn: "Quick from your phone" },
  card: { icon: VisaIcon, title: "Karta", hintPl: "Visa, Mastercard…", hintEn: "Visa, Mastercard…" },
  paypal: { icon: PayPalIcon, title: "PayPal", hintPl: "Konto PayPal", hintEn: "Your PayPal account" },
  revolut_pay: { icon: RevolutIcon, title: "Revolut Pay", hintPl: "Aplikacja Revolut", hintEn: "Revolut app" },
  ideal: { icon: IDEALIcon, title: "iDEAL", hintPl: "Bank w Holandii", hintEn: "Dutch bank transfer" },
  bancontact: { icon: BancontactIcon, title: "Bancontact", hintPl: "Bank w Belgii", hintEn: "Belgian bank transfer" },
  eps: { icon: BankIcon, title: "EPS", hintPl: "Bank w Austrii", hintEn: "Austrian bank transfer" },
  twint: { icon: TWINTIcon, title: "TWINT", hintPl: "Aplikacja TWINT", hintEn: "TWINT app" },
  mobilepay: { icon: MobilePayIcon, title: "MobilePay", hintPl: "Aplikacja MobilePay", hintEn: "MobilePay app" },
  swish: { icon: SwishIcon, title: "Swish", hintPl: "Aplikacja Swish", hintEn: "Swish app" },
  klarna: { icon: KlarnaIcon, title: "Klarna", hintPl: "Konto Klarna", hintEn: "Your Klarna account" },
  [TIP_CRYPTO_PLACEHOLDER]: { icon: CryptoIcon, title: "Crypto", hintPl: "Już wkrótce", hintEn: "Coming soon" },
  [TIP_FALLBACK_METHOD]: { icon: GenericCardIcon, title: "Karta i inne", hintPl: "Wszystkie dostępne metody", hintEn: "All available methods" },
};

// Local instant methods first, then card, then accounts/wallets. Unknown methods go last.
const METHOD_ORDER = ["blik", "apple_pay", "google_pay", "p24", "ideal", "bancontact", "eps", "twint", "swish", "mobilepay", "card", "paypal", "revolut_pay", "klarna"];

// Not shown as a tile: Link is Stripe's own saved-details network.
const HIDDEN_TILE_METHODS = new Set(["link"]);

export type TipWallet = "apple_pay" | "google_pay";

export const TIP_WALLETS: readonly TipWallet[] = ["apple_pay", "google_pay"];

/**
 * Apple Pay / Google Pay are card payments to Stripe, so they only get a tile when the intent
 * allows cards and the browser says the wallet is set up on this device.
 */
export function getTipMethodTiles(paymentMethodTypes: string[], wallets: readonly TipWallet[] = []): string[] {
  const rank = (type: string) => {
    const index = METHOD_ORDER.indexOf(type);
    return index === -1 ? METHOD_ORDER.length : index;
  };
  const withWallets = paymentMethodTypes.includes("card") ? [...paymentMethodTypes, ...wallets] : paymentMethodTypes;
  const tiles = [...new Set(withWallets)]
    .filter((type) => !HIDDEN_TILE_METHODS.has(type))
    .sort((a, b) => rank(a) - rank(b));
  return [...(tiles.length > 0 ? tiles : [TIP_FALLBACK_METHOD]), TIP_CRYPTO_PLACEHOLDER];
}

export function describeTipMethod(type: string, isPl: boolean): {
  icon: IconComponent | undefined;
  title: string;
  hint: string;
} {
  const copy = METHOD_COPY[type];
  if (copy) {
    return {
      icon: copy.icon,
      title: !isPl && type === "card" ? "Card" : !isPl && type === TIP_FALLBACK_METHOD ? "Card and more" : copy.title,
      hint: isPl ? copy.hintPl : copy.hintEn,
    };
  }
  const title = type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { icon: undefined, title, hint: isPl ? "Inna metoda płatności" : "Another payment method" };
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
  if (type === TIP_CRYPTO_PLACEHOLDER) return;
  try {
    window.localStorage.setItem(LAST_METHOD_KEY, type);
  } catch {
    // A per-viewer convenience only.
  }
}
