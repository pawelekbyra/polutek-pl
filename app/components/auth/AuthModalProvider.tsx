"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AuthModal from "./AuthModal";
import GoogleOneTapPrompt from "./GoogleOneTapPrompt";
import OnboardingDialog from "./OnboardingDialog";
import { clearReturnPath, rememberReturnPath } from "@/lib/auth/sso-return";

export type AuthView = "sign-in" | "sign-up";

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

  const open = useCallback((nextView: AuthView = "sign-in") => {
    setView(nextView);
    setIsOpen(true);
  }, []);

  // Closing the modal without signing in drops a remembered `next` path, so it cannot send a later,
  // unrelated sign-in somewhere unexpected.
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) clearReturnPath();
    setIsOpen(nextOpen);
  }, []);

  const close = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  // The proxy sends visitors without a session here (`/?signin=1&next=/path`) instead of a bare
  // 404/401: open the sign-in modal and tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") !== "1") return;
    const next = params.get("next");
    if (next) rememberReturnPath(next);
    params.delete("signin");
    params.delete("next");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
    setView("sign-in");
    setIsOpen(true);
  }, []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal open={isOpen} initialView={view} onOpenChange={handleOpenChange} />
      <OnboardingDialog />
      {/* Google's native One Tap prompt for logged-out visitors (hidden when signed in). */}
      <GoogleOneTapPrompt />
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
