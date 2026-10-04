import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { captcha, haveIBeenPwned, oneTap, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/constants";
import { isCfConnectingIpTrusted } from "@/lib/api/client-ip";
import {
  CAPTCHA_ENDPOINTS,
  EMAIL_TOKEN_TTL_SECONDS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SESSION_COOKIE_CACHE_SECONDS,
  SESSION_COOKIE_PREFIX,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_FRESH_AGE_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  TWO_FACTOR_TRUST_DEVICE_SECONDS,
  SIGN_IN_IP_RATE_PER_MINUTE,
  getAuthBaseUrl,
  getPasskeyRelyingParty,
  getTrustedOrigins,
  isCaptchaConfigured,
  isGoogleConfigured,
} from "./config";
import {
  afterSessionCreate,
  afterUserCreate,
  authAfterHook,
  authBeforeHook,
  beforeAccountCreate,
  beforeSessionCreate,
  beforeUserCreate,
  onPasswordReset,
} from "./hooks";
import { onEmailVerified, queueChangeEmailConfirmation, queuePasswordResetEmail, queueVerificationEmail } from "./emails";
import { authRateLimitStorage } from "./rate-limit-storage";
import { PASSKEY_PATHS } from "./passkey";
import {
  PASSKEY_SIGNUP_PATH,
  afterPasskeyAuthentication,
  afterPasskeyRegistration,
  passkeySignup,
  resolvePasskeySignupUser,
} from "./passkey-signup";

const isProduction = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function resolveSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  // `next build` imports every route module; the real secret is only needed at runtime.
  if (isBuildPhase || !isProduction) return "build-or-dev-only-secret-change-me-0123456789abcdef";
  throw new Error("BETTER_AUTH_SECRET is required in production (openssl rand -base64 32).");
}

const googleEnabled = isGoogleConfigured();

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: getAuthBaseUrl(),
  secret: resolveSecret(),
  trustedOrigins: getTrustedOrigins(),
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  user: {
    fields: { image: "imageUrl" },
    additionalFields: {
      language: { type: "string", required: false, defaultValue: "en", input: true },
      onboardingPending: { type: "boolean", required: false, defaultValue: false, input: false },
      // Set only by beforeUserCreate (the sign-up window shows the Terms next to every way in).
      termsAcceptedAt: { type: "date", required: false, input: false, returned: false },
      termsVersion: { type: "string", required: false, input: false, returned: false },
    },
    // Changing the address (audit AUTH-02/SEC-04): the before hook wants the password or a fresh Google
    // sign-in and limits requests per user; the CURRENT address must approve the change first, then the
    // new address is verified, then the old address gets a notice (onEmailVerified).
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => queueChangeEmailConfirmation(user, newEmail, url),
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    requireEmailVerification: true,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: EMAIL_TOKEN_TTL_SECONDS,
    sendResetPassword: async ({ user, url }) => queuePasswordResetEmail(user, url),
    onPasswordReset: async ({ user }) => onPasswordReset(user),
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: EMAIL_TOKEN_TTL_SECONDS,
    sendVerificationEmail: async ({ user, url }) => queueVerificationEmail(user, url),
    afterEmailVerification: async (user, request) => onEmailVerified(user, request),
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          // Always show the account chooser: on a shared computer a repeat sign-in must not silently
          // reuse the Google account that is already signed in in the browser.
          prompt: "select_account",
        },
      }
    : {},

  account: {
    // requireLocalEmailVerified: false lets Google claim an address that only has a never-verified
    // password sign-up (otherwise Google sign-in fails for ever with "account not linked").
    // That is safe because beforeAccountCreate drops the squatter's password and sessions on
    // link; unverified rows are also pruned by /api/cron/prune-unverified-accounts.
    accountLinking: { enabled: true, trustedProviders: ["google"], requireLocalEmailVerified: false },
  },

  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
    freshAge: SESSION_FRESH_AGE_SECONDS,
    cookieCache: { enabled: true, maxAge: SESSION_COOKIE_CACHE_SECONDS },
  },

  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    window: 60,
    max: 120,
    customStorage: authRateLimitStorage,
    customRules: {
      "/get-session": false,
      "/sign-in/email": { window: 60, max: SIGN_IN_IP_RATE_PER_MINUTE },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
      "/change-password": { window: 3600, max: 10 },
      // Each request mails an address the caller typed (also limited per user, see guardChangeEmail).
      "/change-email": { window: 3600, max: 10 },
      // Passkeys: the options request runs whenever the sign-in form opens (autofill), and every
      // call stores a one-time challenge, so it gets its own per-IP budget.
      [PASSKEY_PATHS.signInOptions]: { window: 60, max: 20 },
      [PASSKEY_PATHS.signIn]: { window: 60, max: SIGN_IN_IP_RATE_PER_MINUTE },
      [PASSKEY_PATHS.registerOptions]: { window: 3600, max: 20 },
      [PASSKEY_PATHS.register]: { window: 3600, max: 20 },
      [PASSKEY_PATHS.remove]: { window: 3600, max: 20 },
      // Passkey-first sign-up: same budget as the e-mail sign-up (each answer can say "address taken").
      [PASSKEY_SIGNUP_PATH]: { window: 3600, max: 10 },
    },
  },

  advanced: {
    cookiePrefix: SESSION_COOKIE_PREFIX,
    useSecureCookies: isProduction,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProduction },
    ipAddress: { ipAddressHeaders: isCfConnectingIpTrusted() ? ["cf-connecting-ip"] : ["x-real-ip"] },
  },

  // Profile edits go through our own routes (nickname rules, avatar validation, language).
  // Passkeys are named once, when added; renaming is not offered.
  disabledPaths: ["/update-user", PASSKEY_PATHS.rename],

  hooks: { before: authBeforeHook, after: authAfterHook },

  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => beforeUserCreate(user as never, ctx as never),
        after: async (user, ctx) => afterUserCreate(user as never, ctx as never),
      },
    },
    session: {
      create: {
        before: async (session) => {
          await beforeSessionCreate(session);
        },
        after: async (session) => afterSessionCreate(session),
      },
    },
    account: {
      create: {
        before: async (account) => {
          await beforeAccountCreate(account);
        },
      },
    },
  },

  plugins: [
    haveIBeenPwned({ enabled: isProduction }),
    ...(isCaptchaConfigured()
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: process.env.TURNSTILE_SECRET_KEY as string,
            endpoints: [...CAPTCHA_ENDPOINTS],
          }),
        ]
      : []),
    ...(googleEnabled ? [oneTap({ clientId: process.env.GOOGLE_CLIENT_ID as string })] : []),
    // Decision (audit F-07): the TOTP step applies to e-mail + password sign-in only. Google and
    // One Tap sign-in count as strong on their own (Google's own 2-step verification and device
    // checks), which is also Better Auth's behaviour; the app never forces a second factor on top.
    twoFactor({ issuer: APP_NAME, trustDeviceMaxAge: TWO_FACTOR_TRUST_DEVICE_SECONDS }),
    // Passkeys (WebAuthn). Added from the account panel (fresh session, checked in the before hook) or
    // used to create an account ("Use a passkey", lib/auth/passkey-signup.ts: signed token,
    // account created only after a successful ceremony, signs in after the e-mail is verified).
    // A passkey sign-in is strong on its own (device key + biometrics/PIN, user verification enforced),
    // so like Google it never gets the TOTP step (the twoFactor hook only runs on /sign-in/email).
    passkey({
      ...getPasskeyRelyingParty(),
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "preferred" },
      registration: {
        requireSession: false,
        resolveUser: async ({ ctx, context }) => resolvePasskeySignupUser({ ctx: ctx as never, context }),
        afterVerification: async ({ ctx, verification, user, context }) =>
          afterPasskeyRegistration({ ctx: ctx as never, verification, user, context }),
      },
      authentication: {
        afterVerification: async ({ ctx, verification, clientData }) =>
          afterPasskeyAuthentication({ ctx: ctx as never, verification, clientData: clientData as never }),
      },
    }),
    passkeySignup(),
    nextCookies(), // must stay last
  ],
});

export type Auth = typeof auth;
