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
import { intlLocale, type Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";

export type TipStep = "recipient" | "disclaimer" | "amount" | "method" | "pay";

export const TIP_CURRENCIES = SUPPORTED_CURRENCIES;

export const TIP_CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  PLN: "zł",
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "Fr",
};

/** Currency name in the viewer's language, e.g. "Złoty (PLN)". */
export function tipCurrencyTitle(tx: Tx, code: SupportedCurrency): string {
  switch (code) {
    case "PLN":
      return tx("Złoty (PLN)", "Polish złoty (PLN)");
    case "EUR":
      return tx("Euro (EUR)", "Euro (EUR)");
    case "USD":
      return tx("Dolar amerykański (USD)", "US dollar (USD)");
    case "GBP":
      return tx("Funt brytyjski (GBP)", "British pound (GBP)");
    case "CHF":
      return tx("Frank szwajcarski (CHF)", "Swiss franc (CHF)");
  }
}

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
const METHOD_COPY: Record<string, { icon: IconComponent; title: (tx: Tx) => string; hint: (tx: Tx) => string }> = {
  blik: { icon: BLIKIcon, title: () => "BLIK", hint: (tx) => tx("Kod z aplikacji banku", "Code from your banking app") },
  p24: { icon: Przelewy24Icon, title: () => "Przelewy24", hint: (tx) => tx("Szybki przelew z Twojego banku", "Instant transfer from your bank") },
  apple_pay: { icon: ApplePayIcon, title: () => "Apple Pay", hint: (tx) => tx("Szybko z Twojego urządzenia", "Quick from your device") },
  google_pay: { icon: GooglePayIcon, title: () => "Google Pay", hint: (tx) => tx("Szybko z Twojego telefonu", "Quick from your phone") },
  card: { icon: VisaIcon, title: (tx) => tx("Karta", "Card"), hint: (tx) => tx("Visa, Mastercard…", "Visa, Mastercard…") },
  paypal: { icon: PayPalIcon, title: () => "PayPal", hint: (tx) => tx("Konto PayPal", "Your PayPal account") },
  revolut_pay: { icon: RevolutIcon, title: () => "Revolut Pay", hint: (tx) => tx("Aplikacja Revolut", "Revolut app") },
  ideal: { icon: IDEALIcon, title: () => "iDEAL", hint: (tx) => tx("Bank w Holandii", "Dutch bank transfer") },
  bancontact: { icon: BancontactIcon, title: () => "Bancontact", hint: (tx) => tx("Bank w Belgii", "Belgian bank transfer") },
  eps: { icon: BankIcon, title: () => "EPS", hint: (tx) => tx("Bank w Austrii", "Austrian bank transfer") },
  twint: { icon: TWINTIcon, title: () => "TWINT", hint: (tx) => tx("Aplikacja TWINT", "TWINT app") },
  mobilepay: { icon: MobilePayIcon, title: () => "MobilePay", hint: (tx) => tx("Aplikacja MobilePay", "MobilePay app") },
  swish: { icon: SwishIcon, title: () => "Swish", hint: (tx) => tx("Aplikacja Swish", "Swish app") },
  klarna: { icon: KlarnaIcon, title: () => "Klarna", hint: (tx) => tx("Konto Klarna", "Your Klarna account") },
  [TIP_CRYPTO_PLACEHOLDER]: { icon: CryptoIcon, title: () => "Crypto", hint: (tx) => tx("Już wkrótce", "Coming soon") },
  [TIP_FALLBACK_METHOD]: { icon: GenericCardIcon, title: (tx) => tx("Karta i inne", "Card and more"), hint: (tx) => tx("Wszystkie dostępne metody", "All available methods") },
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

export function describeTipMethod(type: string, tx: Tx): {
  icon: IconComponent | undefined;
  title: string;
  hint: string;
} {
  const copy = METHOD_COPY[type];
  if (copy) {
    return {
      icon: copy.icon,
      title: copy.title(tx),
      hint: copy.hint(tx),
    };
  }
  const title = type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { icon: undefined, title, hint: tx("Inna metoda płatności", "Another payment method") };
}

export function formatTipAmount(amount: number, currency: SupportedCurrency, language: Locale): string {
  try {
    return new Intl.NumberFormat(intlLocale(language, "en-GB"), {
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
