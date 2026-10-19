"use client";

import { logger } from "@/lib/logger";
import { useLanguage } from "../LanguageContext";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import UnsubscribedEmailConsentPrompt from "../subscriptions/UnsubscribedEmailConsentPrompt";
import { refreshSession, useUser } from "@/lib/auth/react";
import { announceNotificationsChanged } from "../notifications/notification-events";

/**
 * App-wide reactions to the session: refresh server-rendered state on a live sign-in/sign-out,
 * and keep the viewer's saved language (stored on the user row) in step with the UI language.
 */
export default function AuthLifecycleProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { language, setLanguage, isInitialized } = useLanguage();
  const { user, isLoaded } = useUser();
  const [syncedOnce, setSyncedOnce] = useState(false);
  // The language already stored for the user, so a redundant write is skipped on mount.
  const [persistedLanguage, setPersistedLanguage] = useState<string | null>(null);
  // null = not yet observed. Used to detect a live sign-in/sign-out transition (as opposed to
  // already being in that state on first mount) so server-rendered patron/access/comment state
  // gets refetched instead of staying stale until a manual reload.
  const wasSignedInRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    const isSignedIn = Boolean(user);
    if (wasSignedInRef.current !== null && wasSignedInRef.current !== isSignedIn) {
      // Client-side caches (comments, viewer permissions, sidebar layout) are keyed independent
      // of auth state, so a plain router.refresh() leaves them showing the previous session's
      // data until they naturally go stale.
      queryClient.clear();
      router.refresh();
    }
    wasSignedInRef.current = isSignedIn;
  }, [isLoaded, user, router, queryClient]);

  // The same person's profile changes while the page stays open (finishing the first-sign-in dialog, a new nickname
  // or avatar): the comments on screen were fetched for the old state ("sign in to comment" for a new account, the
  // old name under their own comments), and the first-sign-in welcome has just been put in the bell.
  const profileKeyRef = useRef<{ userId: string; key: string } | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      profileKeyRef.current = null;
      return;
    }
    const key = [user.fullName, user.imageUrl, user.onboardingPending].join("|");
    const previous = profileKeyRef.current;
    profileKeyRef.current = { userId: user.id, key };
    if (previous && previous.userId === user.id && previous.key !== key) {
      void queryClient.invalidateQueries({ queryKey: ["comments"] });
      void queryClient.invalidateQueries({ queryKey: ["comment-replies"] });
      router.refresh();
      announceNotificationsChanged();
    }
  }, [isLoaded, user, router, queryClient]);

  // A different person signing in during the same page session must get their own saved language
  // applied (and not have the previous user's language written to their row).
  const userId = user?.id ?? null;
  useEffect(() => {
    setSyncedOnce(false);
    setPersistedLanguage(null);
  }, [userId]);

  // Saved preference -> UI, once per login.
  useEffect(() => {
    if (isLoaded && user && isInitialized && !syncedOnce) {
      if (user.language !== language) setLanguage(user.language);
      setPersistedLanguage(user.language);
      setSyncedOnce(true);
    }
  }, [user, isLoaded, isInitialized, language, setLanguage, syncedOnce]);

  // UI -> saved preference, only when the language actually changes after the first sync. This is
  // the one place a signed-in viewer's choice is saved, whichever control changed it (navbar,
  // sign-in or first-sign-in dialog, account window). The session is re-read afterwards: its
  // cookie cache would otherwise hand the old language back to the sync above on the next load.
  useEffect(() => {
    if (!isLoaded || !user || !isInitialized || !syncedOnce) return;
    if (language === persistedLanguage) return;
    fetch("/api/user/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setPersistedLanguage(language);
        await refreshSession();
      })
      .catch((err) => logger.warn("[AuthLifecycleProvider] Failed to persist language choice:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, syncedOnce]);

  return (
    <>
      {children}
      <UnsubscribedEmailConsentPrompt />
    </>
  );
}
