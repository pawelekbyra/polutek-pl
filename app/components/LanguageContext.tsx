'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { APP_NAME } from '@/lib/constants';

type Language = 'pl' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isInitialized: boolean;
  t: typeof translations.pl;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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

export const LanguageProvider: React.FC<{ children: React.ReactNode; initialLanguage?: Language; forcedLanguage?: Language }> = ({
  children,
  initialLanguage,
  forcedLanguage,
}) => {
  // The server already resolved the language (DB → cookie → geolocation → Accept-Language),
  // so we start from that value: correct first paint, no hydration mismatch.
  const [language, setLanguageState] = useState<Language>(forcedLanguage ?? initialLanguage ?? "pl");
  const [isInitialized, setIsInitialized] = useState(false);
  // Ref avoids stale-closure issues: tracks whether the effect has already run once,
  // so subsequent re-runs (e.g. when UrlMask clears the locale from the URL, changing
  // forcedLanguage from "en"/"pl" to undefined) don't revert the user's choice.
  const initializedRef = useRef(false);

  useEffect(() => {
    const routeOrInitialLanguage = forcedLanguage ?? initialLanguage;
    if (routeOrInitialLanguage) {
      // On first mount: always apply the server/route decision.
      // After that: only apply when forcedLanguage is explicitly set (real locale prefix
      // in the URL). If forcedLanguage dropped to undefined (URL masked to "/"), skip the
      // state update so the user's explicit language choice is not overwritten.
      if (!initializedRef.current || forcedLanguage != null) {
        persistLanguage(routeOrInitialLanguage);
        setLanguageState(routeOrInitialLanguage);
        document.documentElement.lang = routeOrInitialLanguage;
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
      if (saved === 'pl' || saved === 'en') {
        setLanguageState(saved as Language);
      } else if (navigator.language.startsWith('pl')) {
        setLanguageState('pl');
      } else {
        setLanguageState('en');
      }
      initializedRef.current = true;
      setIsInitialized(true);
    }
  }, [initialLanguage, forcedLanguage]);

  // Signed-in viewers' changes are saved on their account by AuthLifecycleProvider (the one writer).
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    persistLanguage(lang);
    document.documentElement.lang = lang;
  }, []);

  const t = useMemo(() => translations[language], [language]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    isInitialized,
    t
  }), [language, setLanguage, isInitialized, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const translations = {
  pl: {
    views: 'wyświetleń',
    showMore: '...więcej',
    showLess: 'Pokaż mniej',
    subscribe: 'Subskrajb',
    subscribeMobile: 'Subskrajb',
    subscribed: 'Subskrajbd',
    subscribersOne: 'subskrajber',
    subscribers: 'subskrajberów',
    share: 'Szeruj',
    noDate: 'Świeża sprawa',
    comments: 'Komentarze',
    replying: 'Wchodzisz w dyskusję',
    addComment: 'Zostaw ślad...',
    addReply: 'Odpowiedź...',
    signInToComment: 'Zaloguj się, aby dodać komentarz',
    cancel: 'Odpuść',
    comment: 'Wyślij',
    reply: 'Odpowiedz',
    signIn: 'WEJŚCIE',
    deleteComment: 'Wyciąć?',
    showAll: 'Wróć',
    justNow: 'przed chwilą',
    noDescription: 'Cisza w eterze.',
    materials: 'Publiczne',
    videosTab: 'Filmy',
    loginToWatch: 'Pokaż dowód (zaloguj się)',
    loginReq: 'Zaloguj się',
    public: 'Publiczny',
    loginToWatchShort: 'Zaloguj się',
    independencyTitle: 'Nie masz psychy się zalogować',
    welcomeOn: 'WITAJ NA',
    independencyTitleLoggedIn: `WITAJ NA ${APP_NAME}`,
    currency: 'PLN',
    loginGatedText: 'Zaloguj się, aby obejrzeć',
    confirmSubscribeTitle: 'CZY CHCESZ SUBSKRYBOWAĆ?',
    confirmSubscribeText: 'Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.',
    yes: 'TAK',
    no: 'NIE'
  },
  en: {
    views: 'views',
    showMore: '...more',
    showLess: 'Show less',
    subscribe: 'Subscribe',
    subscribeMobile: 'Subscribe',
    subscribed: 'Subscribed',
    subscribersOne: 'subscriber',
    subscribers: 'subscribers',
    share: 'Share',
    noDate: 'No date',
    comments: 'Comments',
    replying: 'Replying',
    addComment: 'Add a comment...',
    addReply: 'Add a reply...',
    signInToComment: 'Sign in to comment',
    cancel: 'Cancel',
    comment: 'Comment',
    reply: 'Reply',
    signIn: 'ENTER',
    deleteComment: 'Delete comment?',
    showAll: 'Show all',
    justNow: 'just now',
    noDescription: 'No description provided.',
    materials: 'Public',
    videosTab: 'Video',
    loginToWatch: 'Log in to watch',
    loginReq: 'Login Req',
    public: 'Public',
    loginToWatchShort: 'Log in',
    independencyTitle: "You don't have the guts to log in",
    welcomeOn: 'WELCOME TO',
    independencyTitleLoggedIn: `WELCOME TO ${APP_NAME}`,
    currency: 'USD',
    loginGatedText: 'Log in to watch additional content',
    confirmSubscribeTitle: 'DO YOU WANT TO SUBSCRIBE?',
    confirmSubscribeText: 'Subscribing means you agree to receive email notifications about news.',
    yes: 'YES',
    no: 'NO'
  }
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  const { language } = context;
  const t = useMemo(() => translations[language], [language]);

  return useMemo(() => ({
    ...context,
    t
  }), [context, t]);
};

/**
 * Low-level player states can also render in isolated tests/previews. In the
 * application they inherit LanguageProvider; outside it they fall back to the
 * document language and finally Polish.
 */
export const useOptionalLanguage = (): Language => {
  const context = useContext(LanguageContext);
  if (context) return context.language;
  if (typeof document !== 'undefined' && document.documentElement.lang === 'en') return 'en';
  return 'pl';
};
