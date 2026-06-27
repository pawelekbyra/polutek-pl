'use client';

import { logger } from "@/lib/logger";
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { APP_NAME } from '@/lib/constants';

type Language = 'pl' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language, skipSync?: boolean) => void;
  isInitialized: boolean;
  t: typeof translations.pl;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("pl");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('app-language');
    if (saved === 'pl' || saved === 'en') {
      setLanguageState(saved as Language);
    } else if (navigator.language.startsWith('pl')) {
      setLanguageState('pl');
    } else {
      setLanguageState('en');
    }
    setIsInitialized(true);
  }, []);

  const setLanguage = useCallback(async (lang: Language, skipSync: boolean = false) => {
    const prevLang = language;
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);

    // Sync with database if requested and changed
    if (!skipSync && lang !== prevLang && isInitialized) {
      try {
        const res = await fetch('/api/user/language', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang })
        });

        // No need to alert on 401, user just might not be logged in
      } catch (e) {
        logger.warn('[LanguageContext] Failed to sync language with DB:', e);
      }
    }
  }, [language, isInitialized]);

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
    subscribe: 'Subskrybuj',
    subscribeMobile: 'Subskrybuj',
    subscribed: 'Subskrybowany ✓',
    subscribers: 'subskrybentów',
    share: 'Szeruj',
    noDate: 'Świeża sprawa',
    comments: 'Komentarze',
    replying: 'Wchodzisz w dyskusję',
    addComment: 'Zostaw ślad...',
    addReply: 'Odpowiedź...',
    signInToComment: 'Zaloguj się, aby dodać komentarz',
    becomePatronToComment: 'Zostań Patronem, aby dodać komentarz',
    cancel: 'Odpuść',
    comment: 'Wyślij',
    reply: 'Odpowiedz',
    signIn: 'WEJŚCIE',
    deleteComment: 'Wyciąć?',
    showAll: 'Wróć',
    justNow: 'przed chwilą',
    noDescription: 'Cisza w eterze.',
    support: 'Mecenat',
    materials: 'Publiczne',
    videosTab: 'Filmy',
    donate: 'Bramka Napiwkowa',
    available: 'Odblokowane',
    publicStatus: 'Publiczny',
    unlockedStatus: 'Odblokowane',
    loginToWatch: 'Pokaż dowód (zaloguj się)',
    loginReq: 'Zaloguj się',
    public: 'Publiczny',
    patronOnly: 'Dla Patronów',
    becomePatron: 'Zostań Patronem',
    topSecret: 'Ściśle Tajne',
    paywallText: 'Strefa',
    paywallAction: 'Zalogowanych',
    supportArtist: 'ZOSTAŃ PATRONEM',
    supportBrand: 'WSPIERAJ',
    loginToWatchShort: 'Zaloguj się',
    independencyTitle: 'Nie masz psychy się zalogować',
    welcomeOn: 'WITAJ NA',
    independencyTitleLoggedIn: `WITAJ NA ${APP_NAME}`,
    patronZone: 'Strefa Patronów',
    patronZoneLine1: 'Strefa',
    patronZoneLine2: 'Patronów',
    currency: 'PLN',
    loginGatedText: 'Zaloguj się, aby obejrzeć',
    donationDescription: 'Wpłaty od widzów pomogą szybko rozwijać kanał\ni tworzyć kolejne materiały. W podziękowaniu za napiwek zapraszam do Strefy Patronów.',
    paywallUnlock: 'Wyślij napiwek, aby dołączyć',
    confirmSubscribeTitle: 'CZY CHCESZ SUBSKRYBOWAĆ?',
    confirmSubscribeText: 'Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.',
    yes: 'TAK',
    no: 'NIE',
    acceptTerms: 'Akceptuję Regulamin i Politykę Prywatności',
    pleaseAcceptTerms: 'Zapraszam do Strefy Patronów (zaakceptuj regulamin)',
    tipTheGuy: 'NAPIWKUJ'
  },
  en: {
    views: 'views',
    showMore: '...more',
    showLess: 'Show less',
    subscribe: 'Subscribe',
    subscribeMobile: 'Subscribe',
    subscribed: 'Subscribed ✓',
    subscribers: 'subscribers',
    share: 'Share',
    noDate: 'No date',
    comments: 'Comments',
    replying: 'Replying',
    addComment: 'Add a comment...',
    addReply: 'Add a reply...',
    signInToComment: 'Sign in to comment',
    becomePatronToComment: 'Become a Patron to comment',
    cancel: 'Cancel',
    comment: 'Comment',
    reply: 'Reply',
    signIn: 'ENTER',
    deleteComment: 'Delete comment?',
    showAll: 'Show all',
    justNow: 'just now',
    noDescription: 'No description provided.',
    support: 'Support',
    materials: 'Public',
    videosTab: 'Video',
    donate: 'tippping gate',
    available: 'Available',
    publicStatus: 'Public',
    unlockedStatus: 'Unlocked',
    loginToWatch: 'Log in to watch',
    loginReq: 'Login Req',
    public: 'Public',
    patronOnly: 'Patron Only',
    becomePatron: 'Become a Patron',
    topSecret: 'TOP SECRET',
    paywallText: 'Login',
    paywallAction: 'Zone',
    supportArtist: 'BECOME A PATRON',
    supportBrand: 'SUPPORT',
    loginToWatchShort: 'Log in',
    independencyTitle: "You don't have the guts to log in",
    welcomeOn: 'WELCOME TO',
    independencyTitleLoggedIn: `WELCOME TO ${APP_NAME}`,
    patronZone: "Patrons' Zone",
    patronZoneLine1: 'Patrons',
    patronZoneLine2: 'Zone',
    currency: 'USD',
    loginGatedText: 'Log in to watch additional content',
    donationDescription: "Viewer contributions will help rapidly grow the channel \nand create new content. In appreciation for your tip, I invite you to the Patrons' Zone.",
    paywallUnlock: 'Send a tip to join',
    confirmSubscribeTitle: 'DO YOU WANT TO SUBSCRIBE?',
    confirmSubscribeText: 'Subscribing means you agree to receive email notifications about news.',
    yes: 'YES',
    no: 'NO',
    acceptTerms: 'I accept the Terms and Privacy Policy',
    pleaseAcceptTerms: 'I invite you to the Patrons\' Zone (please accept terms)',
    tipTheGuy: 'TIP THE GUY'
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
