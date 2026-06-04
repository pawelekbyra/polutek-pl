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

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ?? "pk_test_YnVpbGQtdGltZS1wbGFjZWhvbGRlciRjbGVyay5hY2NvdW50cy5kZXYk";

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
