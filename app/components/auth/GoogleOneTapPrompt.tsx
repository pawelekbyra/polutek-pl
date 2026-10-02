"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";
import { useAuthPublicConfig } from "@/lib/auth/public-config";
import { refreshSession, useAuth } from "@/lib/auth/react";

const SKIP_PATHS = ["/sso-callback", "/reset-password"];
/** One Tap is offered to a signed-out visitor at most once per day (per browser), not on every page load. */
export const ONE_TAP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const ONE_TAP_STORAGE_KEY = "pp:one-tap-last";
/** Quiet time after the page is usable (or the entry gate was passed) before the prompt appears. */
const PROMPT_DELAY_MS = 2500;

function readLastPrompt(): number {
  for (const storage of ["localStorage", "sessionStorage"] as const) {
    try {
      const value = Number(window[storage].getItem(ONE_TAP_STORAGE_KEY));
      if (value) return value;
    } catch {
      // storage unavailable: try the next one
    }
  }
  return 0;
}

function rememberPrompt() {
  const now = String(Date.now());
  for (const storage of ["localStorage", "sessionStorage"] as const) {
    try {
      window[storage].setItem(ONE_TAP_STORAGE_KEY, now);
      return;
    } catch {
      // storage unavailable: try the next one
    }
  }
}

type OneTapCapableClient = { oneTap: (options: unknown) => Promise<unknown> };

/** The home page's entry gate (matrix preloader) is still covering the page. */
function entryGateIsUp(): boolean {
  return document.querySelector('[data-testid="site-preloader"]') !== null;
}

/**
 * Google's One Tap prompt for signed-out visitors (Google's own UI, no site branding). The One
 * Tap client is built here, at runtime, because it needs the Google client id the server hands
 * over; a successful tap ends in the same Better Auth session as the redirect flow.
 * Shown once per day per browser, never underneath the home entry gate.
 */
export default function GoogleOneTapPrompt() {
  const { googleClientId } = useAuthPublicConfig();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const clientRef = useRef<OneTapCapableClient | null>(null);

  useEffect(() => {
    if (!googleClientId || !isLoaded || isSignedIn) return;
    if (SKIP_PATHS.some((path) => window.location.pathname.startsWith(path))) return;
    if (Date.now() - readLastPrompt() < ONE_TAP_COOLDOWN_MS) return;

    let timer: number | undefined;
    const prompt = () => {
      if (Date.now() - readLastPrompt() < ONE_TAP_COOLDOWN_MS) return;
      rememberPrompt();
      clientRef.current ??= createAuthClient({
        plugins: [oneTapClient({ clientId: googleClientId, autoSelect: false, cancelOnTapOutside: true, context: "signin" })],
      }) as unknown as OneTapCapableClient;
      void clientRef.current
        .oneTap({
          fetchOptions: {
            onSuccess: () => {
              void refreshSession();
              router.refresh();
            },
          },
        })
        .catch(() => undefined);
    };
    const schedule = () => {
      timer = window.setTimeout(prompt, PROMPT_DELAY_MS);
    };

    if (entryGateIsUp()) {
      window.addEventListener("polutek:gate-enter", schedule, { once: true });
      return () => {
        window.removeEventListener("polutek:gate-enter", schedule);
        window.clearTimeout(timer);
      };
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, [googleClientId, isLoaded, isSignedIn, router]);

  return null;
}
