'use client';

import { logger } from "@/lib/logger";
import { ClerkProvider, useUser } from '@clerk/nextjs';
import { plPL } from '@clerk/localizations';
import { useLanguage } from './LanguageContext';
import { updateUserLanguage } from '@/lib/actions/user';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import UnsubscribedEmailConsentPrompt from './subscriptions/UnsubscribedEmailConsentPrompt';

function LocalizationLogic({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { language, setLanguage, isInitialized } = useLanguage();
  const { user, isLoaded } = useUser();
  const [syncedOnce, setSyncedOnce] = useState(false);
  // Track the language that is already persisted in Clerk metadata so we don't
  // make a redundant API call on every mount.
  const [persistedLanguage, setPersistedLanguage] = useState<string | null>(null);
  // null = not yet observed. Used to detect a live sign-in/sign-out transition
  // (as opposed to already being in that state on first mount) so server-rendered
  // patron/access/comment state gets refetched instead of staying stale until a
  // manual reload.
  const wasSignedInRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    const isSignedIn = Boolean(user);
    if (wasSignedInRef.current !== null && wasSignedInRef.current !== isSignedIn) {
      // Client-side caches (comments, viewer permissions, sidebar layout) are
      // keyed independent of auth state, so a plain router.refresh() leaves
      // them showing the previous session's data until they naturally go stale.
      queryClient.clear();
      router.refresh();
    }
    wasSignedInRef.current = isSignedIn;
  }, [isLoaded, user, router, queryClient]);

  // Sync DB preference to Context ONLY ONCE on login
  useEffect(() => {
    if (isLoaded && user && isInitialized && !syncedOnce) {
      try {
        const metadata = user.publicMetadata as Record<string, unknown>;
        const metadataLanguage = metadata.language || metadata.preferredLanguage;
        const dbLang = metadataLanguage === 'pl' || metadataLanguage === 'en' ? metadataLanguage as string : null;
        if (dbLang && dbLang !== language) {
          setLanguage(dbLang as 'en' | 'pl', true);
        }
        // Record what language is already stored so we skip a redundant write
        setPersistedLanguage(dbLang ?? language);
        setSyncedOnce(true);
      } catch (e) {
        logger.error("[ClerkLocalizationProvider] Error syncing metadata:", e);
        setSyncedOnce(true);
      }
    }
  }, [user, isLoaded, isInitialized, language, setLanguage, syncedOnce]);

  // Sync Context to DB/Metadata only when language actually changes after initial load
  useEffect(() => {
    if (!isLoaded || !user || !isInitialized || !syncedOnce) return;
    // Skip if the language is already what Clerk has stored
    if (language === persistedLanguage) return;
    updateUserLanguage(language).then(() => {
      setPersistedLanguage(language);
    }).catch(err => {
      logger.warn("[ClerkLocalizationProvider] Failed to persist language choice:", err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, syncedOnce]);

  return (
    <>
      {children}
      <UnsubscribedEmailConsentPrompt />
    </>
  );
}

export default function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const localization = language === 'pl'
    ? plPL as React.ComponentProps<typeof ClerkProvider>["localization"]
    : undefined;

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required. Run npm run env:validate or set the Clerk publishable key before starting the app.',
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={localization}
      afterSignOutUrl="/"
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
