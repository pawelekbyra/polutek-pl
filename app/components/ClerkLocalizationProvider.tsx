'use client';

import { logger } from "@/lib/logger";
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
        const metadata = user.publicMetadata as Record<string, unknown>;
        const metadataLanguage = metadata.language || metadata.preferredLanguage;
        const dbLang = metadataLanguage === 'pl' || metadataLanguage === 'en' ? metadataLanguage : null;
        if (dbLang && dbLang !== language) {
          setLanguage(dbLang, true);
        }
        setSyncedOnce(true);
      } catch (e) {
        logger.error("[ClerkLocalizationProvider] Error syncing metadata:", e);
      }
    }
  }, [user, isLoaded, isInitialized, language, setLanguage, syncedOnce]);

  // Sync Context to DB/Metadata on change
  useEffect(() => {
    if (isLoaded && user && isInitialized && syncedOnce) {
       updateUserLanguage(language).catch(err => {
         logger.warn("[ClerkLocalizationProvider] Failed to persist language choice:", err);
       });
    }
  }, [language, user, isLoaded, isInitialized, syncedOnce]);

  return <>{children}</>;
}

export default function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const localization = language === 'pl'
    ? plPL as React.ComponentProps<typeof ClerkProvider>["localization"]
    : undefined;

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    // During build/static generation, we may not have the key.
    // We log a warning instead of throwing a fatal error to allow the build to proceed.
    // The application will still fail in the browser if the key is missing at runtime.
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[ClerkLocalizationProvider] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. ' +
        'Static generation will proceed, but runtime auth will fail if this is not provided to the deployment.'
      );
    }
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={localization}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      signInForceRedirectUrl="/"
      signUpForceRedirectUrl="/"
    >
      <LocalizationLogic>
        {children}
      </LocalizationLogic>
    </ClerkProvider>
  );
}
