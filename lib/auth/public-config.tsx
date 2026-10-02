"use client";

import React, { createContext, useContext } from "react";

/**
 * Public (non-secret) auth settings the server reads from its runtime environment and hands to
 * the client, so changing a key does not need a rebuild of the image.
 */
export type PublicAuthConfig = {
  googleClientId: string | null;
  turnstileSiteKey: string | null;
};

const AuthPublicConfigContext = createContext<PublicAuthConfig>({ googleClientId: null, turnstileSiteKey: null });

export function AuthPublicConfigProvider({ value, children }: { value: PublicAuthConfig; children: React.ReactNode }) {
  return <AuthPublicConfigContext.Provider value={value}>{children}</AuthPublicConfigContext.Provider>;
}

export function useAuthPublicConfig(): PublicAuthConfig {
  return useContext(AuthPublicConfigContext);
}
