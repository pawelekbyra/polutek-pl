"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * TEMPORARY logo bake-off plumbing. Lets the /logoN pages override the wordmark
 * font and toggle a leading egg icon without prop-drilling through Navbar.
 * When no provider is present (the whole production app), BrandName renders its
 * normal Bowlby One SC wordmark. Delete with the rest of the experiment.
 */
export interface LogoBrandConfig {
  /** CSS font-family applied to the wordmark (overrides --font-brand-logo). */
  fontFamily?: string;
  /** Show a leading lucide Egg icon before the wordmark. */
  showEgg?: boolean;
}

const LogoBrandContext = createContext<LogoBrandConfig | null>(null);

export function LogoBrandProvider({
  value,
  children,
}: {
  value: LogoBrandConfig;
  children: ReactNode;
}) {
  return (
    <LogoBrandContext.Provider value={value}>
      {children}
    </LogoBrandContext.Provider>
  );
}

export function useLogoBrand(): LogoBrandConfig | null {
  return useContext(LogoBrandContext);
}
