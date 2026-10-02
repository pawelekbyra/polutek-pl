import type { PublicAuthConfig } from "./public-config";

/** Reads the public auth settings from the runtime environment (server only). */
export function readPublicAuthConfig(env: Record<string, string | undefined> = process.env): PublicAuthConfig {
  return {
    googleClientId: env.GOOGLE_CLIENT_ID?.trim() || null,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY?.trim() || env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
  };
}
