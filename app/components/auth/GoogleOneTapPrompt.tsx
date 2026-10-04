"use client";

import { useEffect, useRef } from "react";
import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";
import { useAuthPublicConfig } from "@/lib/auth/public-config";
import { refreshSession, useAuth } from "@/lib/auth/react";

type OneTapCapableClient = { oneTap: (options: unknown) => Promise<unknown> };
type GoogleIdentityWindow = { google?: { accounts?: { id?: { cancel?: () => void } } } };

interface GoogleOneTapPromptProps {
  /** Element (inside the sign-in window) that holds the prompt where the browser has no FedCM. */
  containerId: string;
  /** Called after a successful tap, once the Better Auth session exists. */
  onSignedIn: () => void;
}

/**
 * Google's One Tap prompt, offered only inside the open sign-in window. A visitor who just browses
 * never loads Google's script and never gets its `g_state` cookie: both happen only after they asked
 * to sign in (privacy policy § 6). Mounted by AuthModal while the sign-in or sign-up view is shown;
 * unmounting (window closed, view changed) cancels the prompt. The One Tap client is built at runtime
 * because it needs the Google client id the server hands over; a successful tap ends in the same
 * Better Auth session as the redirect flow (the "Continue with Google" button, unchanged).
 */
export default function GoogleOneTapPrompt({ containerId, onSignedIn }: GoogleOneTapPromptProps) {
  const { googleClientId } = useAuthPublicConfig();
  const { isLoaded, isSignedIn } = useAuth();
  const onSignedInRef = useRef(onSignedIn);
  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  useEffect(() => {
    if (!googleClientId || !isLoaded || isSignedIn) return;
    let active = true;
    const client = createAuthClient({
      plugins: [
        oneTapClient({
          clientId: googleClientId,
          autoSelect: false,
          cancelOnTapOutside: true,
          context: "signin",
          // Without FedCM (Firefox, Safari) Google draws the prompt into this element, inside the
          // dialog, so it stays clickable above the dialog's backdrop.
          additionalOptions: { prompt_parent_id: containerId },
        }),
      ],
    }) as unknown as OneTapCapableClient;

    void client
      .oneTap({
        fetchOptions: {
          onSuccess: () => {
            if (!active) return;
            void refreshSession();
            onSignedInRef.current();
          },
        },
      })
      .catch(() => undefined);

    return () => {
      active = false;
      (window as unknown as GoogleIdentityWindow).google?.accounts?.id?.cancel?.();
    };
  }, [googleClientId, isLoaded, isSignedIn, containerId]);

  return null;
}
