"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "./LanguageContext";
import { isHomePathname, switchLocaleHref, type Locale } from "@/lib/i18n/routing";
import { readRealLocation } from "@/lib/i18n/real-location";

/**
 * The one way to change the site language from the UI (navbar switcher, footer, account window,
 * sign-in dialog, ...): updates the language context (all copy) and opens the SAME page in the new
 * language. The page comes from the real location (lib/i18n/real-location.ts), not from the address
 * bar, which UrlMask keeps at "/": a channel stays that channel, search keeps `q` and the filters,
 * a playlist and the `?v=` video stay as they are.
 */
export function useSwitchLanguage() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();

  return (locale: Locale) => {
    if (locale === language) return;
    setLanguage(locale);
    const real = readRealLocation();
    const target = switchLocaleHref(real.pathname, real.search, locale);
    if (isHomePathname(real.pathname)) {
      // The home page is a client app within a session (CLAUDE.md §4.13): LanguageContext already
      // updates all copy, so only the address changes, with no server render (which would flash
      // loading.tsx). The history state stays (video entry, Next's own keys).
      window.history.replaceState(window.history.state, "", target);
    } else {
      // Another page renders texts on the server: open it in the new language.
      router.push(target);
    }
  };
}
