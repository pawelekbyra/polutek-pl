import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { intlLocale } from "@/lib/i18n/ui"
import type { Locale } from "@/lib/i18n/routing"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compact count ("1.5K"). With a `language` it follows that language's own rules through Intl (decimal separator and
 * the abbreviation, e.g. "1,5 tys." in Polish); without one it keeps the English-style K/M of older call sites.
 */
export function formatCount(count: number, language?: Locale): string {
  if (language) {
    return new Intl.NumberFormat(intlLocale(language), { notation: "compact", maximumFractionDigits: 1 }).format(count);
  }
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

export function getBaseUrl() {
  const DEFAULT_BASE_URL = 'https://www.pawelperfect.com';
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}
