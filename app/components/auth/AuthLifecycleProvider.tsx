"use client";

import { logger } from "@/lib/logger";
import { useLanguage } from "../LanguageContext";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import UnsubscribedEmailConsentPrompt from "../subscriptions/UnsubscribedEmailConsentPrompt";
import { refreshSession, useUser } from "@/lib/auth/react";
import { announceNotificationsChanged } from "../notifications/notification-events";
import { useSwitchLanguage } from "../useSwitchLanguage";
import { useOptionalToast } from "@/app/hooks/useToast";
import { createLanguageSaver } from "@/lib/i18n/language-saver";
import { getRouteLocaleFromPathname, isLocale } from "@/lib/i18n/routing";
import { readRealLocation } from "@/lib/i18n/real-location";

const LANGUAGE_SAVE_FAILED_EVENT = "polutek:language-save-failed";

/**
 * App-wide reactions to the session: refresh server-rendered state on a live sign-in/sign-out,
 * and keep the viewer's saved language (stored on the user row) in step with the UI language.
 */
export default function AuthLifecycleProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { language, tx, choice, isInitialized } = useLanguage();
  const switchLanguage = useSwitchLanguage();
  const toast = useOptionalToast();
  const { user, isLoaded } = useUser();
  const [syncedOnce, setSyncedOnce] = useState(false);
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

  // The one writer of a signed-in viewer's language on the account (PATCH /api/user/language): saves one
  // choice at a time, always ends on the latest, retries a failure and reports it (lib/i18n/language-saver.ts).
  // A failure is announced through a window event, so the saver (created once) holds no reference to the
  // toast / texts of a given render.
  useEffect(() => {
    const onFailed = () => toast?.(tx("Nie udało się zapisać języka na koncie.", "Could not save the language to your account."), "error");
    window.addEventListener(LANGUAGE_SAVE_FAILED_EVENT, onFailed);
    return () => window.removeEventListener(LANGUAGE_SAVE_FAILED_EVENT, onFailed);
  }, [toast, tx]);
  const saver = useMemo(
    () =>
      createLanguageSaver({
        save: async (value) => {
          const response = await fetch("/api/user/language", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language: value }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        },
        // The session is re-read afterwards: its cookie cache would otherwise hand the old language back to
        // the sync below on the next load.
        onSaved: () => void refreshSession().catch((err) => logger.warn("[AuthLifecycleProvider] Session refresh failed:", err)),
        onFailed: (value) => {
          logger.warn("[AuthLifecycleProvider] Failed to persist language choice:", value);
          window.dispatchEvent(new Event(LANGUAGE_SAVE_FAILED_EVENT));
        },
      }),
    [],
  );

  // A different person signing in during the same page session must get their own saved language
  // applied (and not have the previous user's language written to their row).
  const userId = user?.id ?? null;
  useEffect(() => {
    setSyncedOnce(false);
    saver.reset(null);
  }, [userId, saver]);

  // A connection that comes back sends a choice that could not be saved.
  useEffect(() => {
    const onOnline = () => saver.flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [saver]);

  // Saved preference -> UI, once per login, and only where the address does not name a language: a page opened
  // as "/de/search" or "/en/channel/x" stays in the language of its address (the same rule the server applies),
  // the account keeps its own. When it does apply, the whole page changes (the same page in that language),
  // never only the client half of it.
  useEffect(() => {
    if (isLoaded && user && isInitialized && !syncedOnce) {
      saver.reset(isLocale(user.language) ? user.language : null);
      const namedByAddress = getRouteLocaleFromPathname(readRealLocation().pathname);
      if (!namedByAddress && isLocale(user.language) && user.language !== language) switchLanguage(user.language);
      setSyncedOnce(true);
    }
  }, [user, isLoaded, isInitialized, language, switchLanguage, syncedOnce, saver]);

  // UI -> saved preference: only a deliberate choice (switcher, sign-in or first-sign-in dialog, account window)
  // is saved, never a language that came from an address or from the sync above.
  useEffect(() => {
    if (!isLoaded || !user || !isInitialized || !syncedOnce || !choice) return;
    saver.request(choice.language);
    // A choice made before the sign-in finished is not the account's: only choices after the sync count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

  return (
    <>
      {children}
      <UnsubscribedEmailConsentPrompt />
    </>
  );
}
