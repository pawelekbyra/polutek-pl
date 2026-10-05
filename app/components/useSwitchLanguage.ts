"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "./LanguageContext";
import { appendQueryString, SUPPORTED_LOCALES, switchLocalePath, type Locale } from "@/lib/i18n/routing";

/**
 * The one way to change the site language from the UI (navbar switcher, sign-in dialog, ...):
 * updates the language context (all copy) and the localized URL.
 */
export function useSwitchLanguage() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (locale: Locale) => {
    if (locale === language) return;
    setLanguage(locale);
    const newPath = appendQueryString(switchLocalePath(pathname || "/", locale), searchParams);
    // On the home page, avoid a server re-render (which triggers loading.tsx and flashes
    // a blank screen). LanguageContext already updates all copy; history.replaceState updates
    // the URL client-side without a navigation. Same pattern as video switching (CLAUDE.md §4.13).
    const isHomePage = pathname === "/" || (SUPPORTED_LOCALES as readonly string[]).some((locale) => pathname === `/${locale}`);
    if (isHomePage) {
      window.history.replaceState(null, "", newPath);
    } else {
      router.push(newPath);
    }
  };
}
