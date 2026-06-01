'use client';

import { ClerkProvider, useUser } from '@clerk/nextjs';
import { plPL } from '@clerk/localizations';
import { useLanguage } from './LanguageContext';
import { updateUserLanguage } from '@/lib/actions/user';
import React, { useEffect, useState } from 'react';

function LocalizationLogic({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, isInitialized } = useLanguage();
  const { user, isLoaded } = useUser();
  const [syncedOnce, setSyncedOnce] = useState(false);

  // Sync DB preference to Context ONLY ONCE on login
  useEffect(() => {
    if (isLoaded && user && isInitialized && !syncedOnce) {
      try {
        const metadata = user.publicMetadata as any;
        const dbLang = (metadata.language || metadata.preferredLanguage) as 'pl' | 'en';
        if (dbLang && dbLang !== language) {
          setLanguage(dbLang, true);
        }
        setSyncedOnce(true);
      } catch (e) {
        console.error("[ClerkLocalizationProvider] Error syncing metadata:", e);
      }
    }
  }, [user, isLoaded, isInitialized, language, setLanguage, syncedOnce]);

  // Sync Context to DB/Metadata on change
  useEffect(() => {
    if (isLoaded && user && isInitialized && syncedOnce) {
       updateUserLanguage(language).catch(err => {
         console.warn("[ClerkLocalizationProvider] Failed to persist language choice:", err);
       });
    }
  }, [language, user, isLoaded, isInitialized, syncedOnce]);

  return <>{children}</>;
}

export default function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      localization={(language === 'pl' ? plPL : undefined) as any}
      afterSignInUrl="/"
      afterSignUpUrl="/"
      signInForceRedirectUrl="/"
      signUpForceRedirectUrl="/"
    >
      <LocalizationLogic>
        {children}
      </LocalizationLogic>
    </ClerkProvider>
  );
}
