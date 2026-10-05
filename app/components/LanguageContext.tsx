'use client';

import React, { useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { isLocale, type Locale } from '@/lib/i18n/routing';
import { loadCatalog } from '@/lib/i18n/catalog';
import { translations, type Dictionary } from '@/lib/i18n/dictionary';
import { createTx, htmlLang, type Catalog } from '@/lib/i18n/ui';
import { LanguageContext, useOptionalTx } from '@/lib/i18n/language-context';

export { translations };

type Language = Locale;


// One-year cookie so the server can resolve the language on the very first paint (see
// lib/i18n/server-language.ts). Kept in sync with localStorage on every change.
function persistLanguage(lang: Language) {
  try {
    localStorage.setItem('app-language', lang);
  } catch {
    /* private mode / storage disabled — cookie still covers persistence */
  }
  document.cookie = `app-language=${lang}; path=/; max-age=31536000; samesite=lax`;
}

/** Polish and English texts live in the components; the other languages need a catalog. */
const needsCatalog = (lang: Language) => lang !== 'pl' && lang !== 'en';

export const LanguageProvider: React.FC<{
  children: React.ReactNode;
  initialLanguage?: Language;
  forcedLanguage?: Language;
  /** Catalog of `initialCatalogLanguage`, loaded by the server so the first paint is translated. */
  initialCatalog?: Catalog | null;
  initialCatalogLanguage?: Language;
}> = ({
  children,
  initialLanguage,
  forcedLanguage,
  initialCatalog,
  initialCatalogLanguage,
}) => {
  // The server already resolved the language (DB → cookie → geolocation → Accept-Language),
  // so we start from that value: correct first paint, no hydration mismatch.
  const [language, setLanguageState] = useState<Language>(forcedLanguage ?? initialLanguage ?? "pl");
  const [isInitialized, setIsInitialized] = useState(false);
  const [catalogs, setCatalogs] = useState<Partial<Record<Language, Catalog>>>(() =>
    initialCatalog && initialCatalogLanguage ? { [initialCatalogLanguage]: initialCatalog } : {},
  );
  const catalogsRef = useRef(catalogs);
  useEffect(() => {
    catalogsRef.current = catalogs;
  }, [catalogs]);
  // Latest language the viewer asked for, so a slow catalog download cannot overwrite a newer choice.
  const requestedRef = useRef<Language>(language);
  // Ref avoids stale-closure issues: tracks whether the effect has already run once,
  // so subsequent re-runs (e.g. when UrlMask clears the locale from the URL, changing
  // forcedLanguage from "en"/"pl" to undefined) don't revert the user's choice.
  const initializedRef = useRef(false);

  /**
   * Switches the displayed language. A language that needs a catalog is shown only once the catalog
   * is here (the previous language stays meanwhile), so the page never flashes untranslated text.
   * If the download fails, the language still switches and unknown texts show English.
   */
  const applyLanguage = useCallback((lang: Language) => {
    requestedRef.current = lang;
    const show = () => {
      if (requestedRef.current !== lang) return;
      setLanguageState(lang);
      document.documentElement.lang = htmlLang(lang);
    };
    if (!needsCatalog(lang) || catalogsRef.current[lang]) {
      show();
      return;
    }
    loadCatalog(lang)
      .then((catalog) => {
        if (catalog) setCatalogs((prev) => ({ ...prev, [lang]: catalog }));
      })
      .catch(() => undefined)
      .finally(show);
  }, []);

  // A language shown without its catalog (a client test, an error boundary) fetches it afterwards.
  useEffect(() => {
    if (!needsCatalog(language) || catalogs[language]) return;
    let cancelled = false;
    loadCatalog(language)
      .then((catalog) => {
        if (!cancelled && catalog) setCatalogs((prev) => ({ ...prev, [language]: catalog }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [language, catalogs]);

  useEffect(() => {
    const routeOrInitialLanguage = forcedLanguage ?? initialLanguage;
    if (routeOrInitialLanguage) {
      // On first mount: always apply the server/route decision.
      // After that: only apply when forcedLanguage is explicitly set (real locale prefix
      // in the URL). If forcedLanguage dropped to undefined (URL masked to "/"), skip the
      // state update so the user's explicit language choice is not overwritten.
      if (!initializedRef.current || forcedLanguage != null) {
        persistLanguage(routeOrInitialLanguage);
        applyLanguage(routeOrInitialLanguage);
      }
      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsInitialized(true);
      }
      return;
    }

    // Fallback for when no server value was provided: prior client-only detection.
    if (!initializedRef.current) {
      const saved = localStorage.getItem('app-language');
      if (isLocale(saved)) {
        applyLanguage(saved);
      } else if (navigator.language.startsWith('pl')) {
        applyLanguage('pl');
      } else {
        applyLanguage('en');
      }
      initializedRef.current = true;
      setIsInitialized(true);
    }
  }, [initialLanguage, forcedLanguage, applyLanguage]);

  // Signed-in viewers' changes are saved on their account by AuthLifecycleProvider (the one writer).
  const setLanguage = useCallback((lang: Language) => {
    persistLanguage(lang);
    applyLanguage(lang);
  }, [applyLanguage]);

  const t = useMemo(() => translations[language], [language]);
  const catalog = catalogs[language];
  const tx = useMemo(() => createTx(language, catalog), [language, catalog]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    isInitialized,
    t,
    tx,
  }), [language, setLanguage, isInitialized, t, tx]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
};

export { useOptionalTx };

/**
 * Low-level player states can also render in isolated tests/previews. In the
 * application they inherit LanguageProvider; outside it they fall back to the
 * document language and finally Polish.
 */
export const useOptionalLanguage = (): Language => {
  const context = useContext(LanguageContext);
  if (context) return context.language;
  if (typeof document !== 'undefined') {
    const documentLanguage = document.documentElement.lang.toLowerCase().split('-')[0];
    if (isLocale(documentLanguage)) return documentLanguage;
  }
  return 'pl';
};
