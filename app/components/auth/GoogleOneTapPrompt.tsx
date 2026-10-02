"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";
import { useAuthPublicConfig } from "@/lib/auth/public-config";
import { refreshSession, useAuth } from "@/lib/auth/react";

const SKIP_PATHS = ["/sso-callback", "/reset-password"];

/**
 * Google's One Tap prompt for signed-out visitors (Google's own UI, no site branding). The One
 * Tap client is built here, at runtime, because it needs the Google client id the server hands
 * over; a successful tap ends in the same Better Auth session as the redirect flow.
 */
export default function GoogleOneTapPrompt() {
  const { googleClientId } = useAuthPublicConfig();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!googleClientId || !isLoaded || isSignedIn) return;
    if (SKIP_PATHS.some((path) => window.location.pathname.startsWith(path))) return;
    const client = createAuthClient({
      plugins: [oneTapClient({ clientId: googleClientId, autoSelect: false, cancelOnTapOutside: true, context: "signin" })],
    });
    void client
      .oneTap({
        fetchOptions: {
          onSuccess: () => {
            void refreshSession();
            router.refresh();
          },
        },
      })
      .catch(() => undefined);
  }, [googleClientId, isLoaded, isSignedIn, router]);

  return null;
}
