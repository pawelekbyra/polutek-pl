"use client";

import { createContext, useContext, useMemo } from "react";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { createTx, type Tx } from "@/lib/i18n/ui";

/** The viewer's latest deliberate language choice (`setLanguage`), numbered so a repeated choice is seen too. */
export interface LanguageChoice {
  language: Locale;
  seq: number;
}

export interface LanguageContextType {
  language: Locale;
  /** A deliberate choice (switcher, dialog, account): shown, remembered in the cookie and, for a signed-in viewer, saved on the account. */
  setLanguage: (lang: Locale) => void;
  /** null until the first `setLanguage`. Following a link to a page in another language is not a choice. */
  choice: LanguageChoice | null;
  isInitialized: boolean;
  t: Dictionary;
  /** Inline interface text: `tx("Polski tekst", "English text")`, see lib/i18n/ui.ts. */
  tx: Tx;
}

/** The provider lives in app/components/LanguageContext.tsx; the context itself is here so small hooks can share it. */
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * `tx` for components that may render outside the provider (isolated tests, previews, components
 * that are handed their language as a prop): inside the app it is the provider's; outside it follows
 * `explicitLanguage`, else the document language, else Polish.
 */
export function useOptionalTx(explicitLanguage?: Locale): Tx {
  const context = useContext(LanguageContext);
  let language: Locale = explicitLanguage ?? "pl";
  if (!explicitLanguage && typeof document !== "undefined") {
    const fromDocument = document.documentElement.lang.toLowerCase().split("-")[0];
    if (isLocale(fromDocument)) language = fromDocument;
  }
  return useMemo(() => context?.tx ?? createTx(language), [context, language]);
}
