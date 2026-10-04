import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import type { auth } from "./auth";

/**
 * Browser-side Better Auth client. Same origin as the app (relative /api/auth), so the www and
 * apex hosts both work. Google One Tap lives in its own lazily built client (see
 * app/components/auth/GoogleOneTapPrompt.tsx) because its plugin needs the Google client id,
 * which is read at runtime from the server instead of being baked into the bundle.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), passkeyClient(), inferAdditionalFields<typeof auth>()],
});

/** Header Better Auth's captcha plugin reads the Cloudflare Turnstile token from. */
export const CAPTCHA_HEADER = "x-captcha-response";

export function captchaFetchOptions(token: string | null | undefined) {
  return token ? { headers: { [CAPTCHA_HEADER]: token } } : undefined;
}
