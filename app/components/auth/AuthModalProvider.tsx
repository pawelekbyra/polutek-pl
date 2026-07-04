"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { GoogleOneTap } from "@clerk/nextjs";
import AuthModal from "./AuthModal";

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

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal open={isOpen} initialView={view} onOpenChange={setIsOpen} />
      {/* Google's native One Tap prompt for logged-out visitors (auto-hides when signed in).
          Renders Google's own UI, not Clerk-branded UI. */}
      <GoogleOneTap />
    </AuthModalContext.Provider>
  );
}

/**
 * Opens our own POLUTEK-styled auth modal (Clerk headless underneath). Use this everywhere
 * instead of Clerk's built-in sign-in modal/button. See
 * docs/tickets/active/CLERK-CUSTOM-AUTH-UI-001.md.
 */
export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within an AuthModalProvider");
  return ctx;
}
