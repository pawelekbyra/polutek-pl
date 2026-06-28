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
    subscribe: 'subskrajb',
    subscribeMobile: 'subskrajb',
    subscribed: 'subskrajbd',
    subscribers: 'subskrajberów',
    share: 'Szeruj',
    noDate: 'Świeża sprawa',
    comments: 'Komentarze',
    replying: 'Wchodzisz w dyskusję',
    addComment: 'Zostaw ślad...',
    addReply: 'Odpowiedź...',
    signInToComment: 'Zaloguj się, aby dodać komentarz',
    becomePatronToComment: 'Wesprzyj kanał, aby dodać komentarz',
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
    donate: 'STREFA THANK YOU',
    available: 'Odblokowane',
    publicStatus: 'Publiczny',
    unlockedStatus: 'Bonus odblokowany',
    loginToWatch: 'Pokaż dowód (zaloguj się)',
    loginReq: 'Zaloguj się',
    public: 'Publiczny',
    patronOnly: 'Bonus za wsparcie',
    becomePatron: 'Wesprzyj i odbierz bonus',
    topSecret: 'Bonus',
    paywallText: 'Bonus',
    paywallAction: 'w podziękowaniu',
    supportArtist: 'WESPRZYJ KANAŁ',
    supportBrand: 'DZIĘKUJĘ',
    loginToWatchShort: 'Zaloguj się',
    independencyTitle: 'Nie masz psychy się zalogować',
    welcomeOn: 'WITAJ NA',
    independencyTitleLoggedIn: `WITAJ NA ${APP_NAME}`,
    patronZone: 'STREFA THANK YOU',
    patronZoneLine1: 'STREFA',
    patronZoneLine2: 'THANK YOU',
    currency: 'PLN',
    loginGatedText: 'Zaloguj się, aby obejrzeć',
    donationDescription: 'Wsparcie od widzów pomaga rozwijać serwis Polutek.pl i tworzyć kolejne materiały. W podziękowaniu otrzymujesz dostęp do Strefy Thank You.',
    paywallUnlock: 'Wesprzyj rozwój serwisu i odblokuj dostęp',
    confirmSubscribeTitle: 'CZY CHCESZ SUBSKRYBOWAĆ?',
    confirmSubscribeText: 'Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach.',
    yes: 'TAK',
    no: 'NIE',
    acceptTerms: 'Akceptuję Regulamin i Politykę Prywatności',
    pleaseAcceptTerms: 'Zaakceptuj regulamin, aby otrzymać dostęp do Strefy Thank You',
    tipTheGuy: 'WSPOMÓŻ I ODBLOKUJ'
  },
  en: {
    views: 'views',
    showMore: '...more',
    showLess: 'Show less',
    subscribe: 'Subscribe',
    subscribeMobile: 'Subscribe',
    subscribed: 'Subscribed',
    subscribers: 'subscribers',
    share: 'Share',
    noDate: 'No date',
    comments: 'Comments',
    replying: 'Replying',
    addComment: 'Add a comment...',
    addReply: 'Add a reply...',
    signInToComment: 'Sign in to comment',
    becomePatronToComment: 'Support the channel to comment',
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
    donate: 'THANK YOU ZONE',
    available: 'Available',
    publicStatus: 'Public',
    unlockedStatus: 'Bonus unlocked',
    loginToWatch: 'Log in to watch',
    loginReq: 'Login Req',
    public: 'Public',
    patronOnly: 'Thank-you bonus',
    becomePatron: 'Support and unlock bonus',
    topSecret: 'Bonus',
    paywallText: 'Thank-you',
    paywallAction: 'bonus',
    supportArtist: 'SUPPORT THE CHANNEL',
    supportBrand: 'THANK YOU',
    loginToWatchShort: 'Log in',
    independencyTitle: "You don't have the guts to log in",
    welcomeOn: 'WELCOME TO',
    independencyTitleLoggedIn: `WELCOME TO ${APP_NAME}`,
    patronZone: 'THANK YOU ZONE',
    patronZoneLine1: 'THANK YOU',
    patronZoneLine2: 'ZONE',
    currency: 'USD',
    loginGatedText: 'Log in to watch additional content',
    donationDescription: "Viewer support helps develop Polutek.pl and create new content. As a thank-you, you receive access to the Thank You Zone.",
    paywallUnlock: "Support the site's development and unlock access",
    confirmSubscribeTitle: 'DO YOU WANT TO SUBSCRIBE?',
    confirmSubscribeText: 'Subscribing means you agree to receive email notifications about news.',
    yes: 'YES',
    no: 'NO',
    acceptTerms: 'I accept the Terms and Privacy Policy',
    pleaseAcceptTerms: 'Accept the terms to receive access to the Thank You Zone',
    tipTheGuy: 'SUPPORT AND UNLOCK'
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