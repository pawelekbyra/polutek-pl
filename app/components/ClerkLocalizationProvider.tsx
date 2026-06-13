'use client';

import { logger } from "@/lib/logger";
import { ClerkProvider, useUser } from '@clerk/nextjs';
import { plPL } from '@clerk/localizations';
import { useLanguage } from './LanguageContext';
import { updateUserLanguage } from '@/lib/actions/user';
import React, { useEffect, useState, useContext } from 'react';

const ClerkContext = React.createContext<{ isClerkAvailable: boolean }>({ isClerkAvailable: false });

export function useClerkAvailability() {
  return useContext(ClerkContext);
}

function LocalizationLogic({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, isInitialized } = useLanguage();
  const { isClerkAvailable } = useClerkAvailability();

  // Conditionally call useUser only if ClerkProvider is actually wrapped.
  // Next.js hooks must be top-level, so we still call it, but we handle the error
  // or use the availability flag to decide if we trust its output.
  const clerkUser = useUser();
  const { user, isLoaded } = isClerkAvailable ? clerkUser : { user: null, isLoaded: true };

  const [syncedOnce, setSyncedOnce] = useState(false);

  // Sync DB preference to Context ONLY ONCE on login
  useEffect(() => {
    if (isClerkAvailable && isLoaded && user && isInitialized && !syncedOnce) {
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
  }, [isClerkAvailable, user, isLoaded, isInitialized, language, setLanguage, syncedOnce]);

  // Sync Context to DB/Metadata on change
  useEffect(() => {
    if (isClerkAvailable && isLoaded && user && isInitialized && syncedOnce) {
       updateUserLanguage(language).catch(err => {
         logger.warn("[ClerkLocalizationProvider] Failed to persist language choice:", err);
       });
    }
  }, [isClerkAvailable, language, user, isLoaded, isInitialized, syncedOnce]);

  return <>{children}</>;
}

export default function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const localization = language === 'pl'
    ? plPL as React.ComponentProps<typeof ClerkProvider>["localization"]
    : undefined;

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    logger.warn(
      '[ClerkLocalizationProvider] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Rendering children without ClerkProvider.',
    );
    return (
      <ClerkContext.Provider value={{ isClerkAvailable: false }}>
        <LocalizationLogic>{children}</LocalizationLogic>
      </ClerkContext.Provider>
    );
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
      <ClerkContext.Provider value={{ isClerkAvailable: true }}>
        <LocalizationLogic>
          {children}
        </LocalizationLogic>
      </ClerkContext.Provider>
    </ClerkProvider>
  );
}
