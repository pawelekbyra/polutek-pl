import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_COOKIE_PREFIX,
  ADMIN_SESSION_IDLE_SECONDS,
  ADMIN_SESSION_UPDATE_AGE_SECONDS,
  getAdminAppUrl,
  getAdminOrigin,
  getRelyingPartyId,
  resolveAdminAuthSecret,
} from "@admin/lib/config";
import { panelAuthPlugin, PANEL_PATHS } from "./panel-plugin";

/**
 * Layer 2: the panel's OWN Better Auth instance (never imports lib/auth of the public site).
 * Own secret (ADMIN_AUTH_SECRET), own tables (Admin*), own host-only cookie. No e-mail/password, no
 * sign-up, no e-mail reset, no Google: accounts come only from `admin-enroll` on the server.
 * Sign-in = passkey with user verification; TOTP is set up at enrollment and serves the step-up.
 */
const isProduction = process.env.NODE_ENV === "production";
const sessionCookieName = isProduction ? `__Host-${ADMIN_COOKIE_PREFIX}.session_token` : `${ADMIN_COOKIE_PREFIX}.session_token`;

function assertUserVerified(verified: boolean | undefined) {
  // A passkey replaces every other factor here, so the authenticator must have checked the person
  // (biometrics or device PIN); a bare touch of a security key without a PIN is refused.
  if (!verified) throw new APIError("UNAUTHORIZED", { code: "PASSKEY_USER_VERIFICATION_REQUIRED", message: "PASSKEY_USER_VERIFICATION_REQUIRED" });
}

export const adminAuth = betterAuth({
  appName: "Panel PP",
  baseURL: getAdminAppUrl(),
  basePath: "/api/auth",
  secret: resolveAdminAuthSecret(),
  trustedOrigins: [getAdminOrigin()],
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  user: {
    modelName: "adminUser",
    additionalFields: {
      enrolledAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    modelName: "adminSession",
    expiresIn: ADMIN_SESSION_IDLE_SECONDS, // sliding idle window; the 12 h ceiling is checked in the guard
    updateAge: ADMIN_SESSION_UPDATE_AGE_SECONDS,
    // No cookie cache: every request reads the session row, so a revoked session ends at once.
    cookieCache: { enabled: false },
    additionalFields: {
      stepUpAt: { type: "date", required: false, input: false },
    },
  },
  account: { modelName: "adminAccount" },
  verification: { modelName: "adminVerification" },

  emailAndPassword: { enabled: false },

  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    storage: "memory", // one container, one owner
    window: 60,
    max: 60,
    customRules: {
      "/get-session": false,
      [PANEL_PATHS.redeem]: { window: 15 * 60, max: 5 },
      [PANEL_PATHS.stepUpTotp]: { window: 5 * 60, max: 5 },
      [PANEL_PATHS.passkeySignIn]: { window: 60, max: 10 },
      [PANEL_PATHS.totpVerify]: { window: 5 * 60, max: 10 },
    },
  },

  advanced: {
    cookiePrefix: ADMIN_COOKIE_PREFIX,
    // __Host- is set by hand below: Better Auth would add __Secure- instead, which allows a Domain attribute.
    useSecureCookies: false,
    defaultCookieAttributes: { httpOnly: true, sameSite: "strict", secure: isProduction, path: "/" },
    cookies: { session_token: { name: sessionCookieName } },
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },

  disabledPaths: [
    "/update-user",
    "/delete-user",
    "/change-email",
    "/change-password",
    "/set-password",
    "/list-accounts",
    "/unlink-account",
    "/link-social",
    "/two-factor/disable",
    "/two-factor/send-otp",
    "/two-factor/verify-otp",
    "/two-factor/verify-backup-code",
    "/two-factor/generate-backup-codes",
    "/passkey/delete-passkey",
    "/passkey/update-passkey",
  ],

  plugins: [
    passkey({
      rpID: getRelyingPartyId(),
      rpName: "Panel PP",
      origin: getAdminOrigin(),
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      schema: { passkey: { modelName: "adminPasskey" } },
      advanced: { webAuthnChallengeCookie: `${ADMIN_COOKIE_PREFIX}-passkey` },
      registration: {
        requireSession: true,
        afterVerification: async ({ verification }) => assertUserVerified(verification.registrationInfo?.userVerified),
      },
      authentication: {
        afterVerification: async ({ verification }) => assertUserVerified(verification.authenticationInfo.userVerified),
      },
    }),
    twoFactor({
      issuer: "Panel PP (admin.pawelperfect.com)",
      allowPasswordless: true,
      schema: { twoFactor: { modelName: "adminTwoFactor" } },
    }),
    panelAuthPlugin(),
    nextCookies(), // must stay last
  ],
});

export type AdminAuth = typeof adminAuth;
export const ADMIN_SESSION_COOKIE = sessionCookieName;
