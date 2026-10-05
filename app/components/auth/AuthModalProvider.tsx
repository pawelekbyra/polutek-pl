"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AuthModal from "./AuthModal";
import OnboardingDialog from "./OnboardingDialog";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "@/lib/auth/react";
import { clearReturnPath, rememberReturnPath } from "@/lib/auth/sso-return";

export type AuthView = "sign-in" | "sign-up";

/** What the modal should explain when it opens (set from the URL after an e-mail link was clicked). */
export type AuthNotice = "link-expired" | "verified";

/** Better Auth redirects a bad verification link to `<callbackURL>?error=<one of these>`. */
const LINK_ERROR_CODES = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND", "INVALID_USER"]);
const NOTICE_SKIP_PATHS = ["/reset-password", "/sso-callback"];

interface AuthModalContextValue {
  /** Open the custom auth modal on the given view (defaults to sign-in). */
  open: (view?: AuthView) => void;
  close: () => void;
  isOpen: boolean;
}

const AuthModalContext = createContext<AuthModalContextValue | undefined>(undefined);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView>("sign-in");
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [verifiedBanner, setVerifiedBanner] = useState(false);
  const { language, tx } = useLanguage();
  const { isLoaded, isSignedIn } = useAuth();

  const open = useCallback((nextView: AuthView = "sign-in") => {
    setNotice(null);
    setView(nextView);
    setIsOpen(true);
  }, []);

  // Closing the modal without signing in drops a remembered `next` path, so it cannot send a later,
  // unrelated sign-in somewhere unexpected.
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      clearReturnPath();
      setNotice(null);
    }
    setIsOpen(nextOpen);
  }, []);

  const close = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  // Two kinds of URL hints are handled once, on load, and then tidied away:
  //  - `?signin=1&next=/path`: the proxy sends visitors without a session here instead of a bare
  //    404/401: open the sign-in modal and remember where to return to.
  //  - `?error=TOKEN_EXPIRED|INVALID_TOKEN` / `?verified=1`: where Better Auth sends the browser after
  //    an e-mail verification link was clicked (bad link / success).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const onNoticePage = !NOTICE_SKIP_PATHS.some((path) => window.location.pathname.startsWith(path));
    const wantsSignIn = params.get("signin") === "1";
    const linkError = onNoticePage && LINK_ERROR_CODES.has((params.get("error") ?? "").toUpperCase());
    const verified = onNoticePage && params.get("verified") === "1";
    if (!wantsSignIn && !linkError && !verified) return;

    const next = params.get("next");
    if (wantsSignIn && next) rememberReturnPath(next);
    for (const key of ["signin", "next", ...(linkError ? ["error"] : []), ...(verified ? ["verified"] : [])]) params.delete(key);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
    if (linkError) {
      setNotice("link-expired");
      setView("sign-in");
      setIsOpen(true);
    } else if (verified) {
      setNotice("verified");
    } else {
      setView("sign-in");
      setIsOpen(true);
    }
  }, []);

  // After a verified click: signed in (autoSignInAfterVerification) -> a short confirmation;
  // otherwise (e.g. the link opened in a browser without the session) -> the sign-in modal says what happened.
  useEffect(() => {
    if (notice !== "verified" || !isLoaded) return;
    if (isSignedIn) {
      setNotice(null);
      setVerifiedBanner(true);
      return;
    }
    setView("sign-in");
    setIsOpen(true);
  }, [notice, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!verifiedBanner) return;
    const timer = window.setTimeout(() => setVerifiedBanner(false), 6000);
    return () => window.clearTimeout(timer);
  }, [verifiedBanner]);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal open={isOpen} initialView={view} notice={notice} onOpenChange={handleOpenChange} />
      {verifiedBanner && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-xl bg-[var(--chan-ink)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg"
        >
          {tx("Adres e-mail potwierdzony. Jesteś zalogowany.", "Email confirmed. You're signed in.")}
        </div>
      )}
      <OnboardingDialog />
    </AuthModalContext.Provider>
  );
}

/**
 * Opens our own PAWELPERFECT-styled auth modal (Better Auth underneath). Use this everywhere
 * instead of building sign-in UI elsewhere.
 */
export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within an AuthModalProvider");
  return ctx;
}
