import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { captcha, haveIBeenPwned, oneTap, twoFactor } from "better-auth/plugins";
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
  getAuthBaseUrl,
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
import { queuePasswordResetEmail, queueVerificationEmail } from "./emails";
import { authRateLimitStorage } from "./rate-limit-storage";

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
    },
    changeEmail: { enabled: true },
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
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
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
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
      "/change-password": { window: 3600, max: 10 },
    },
  },

  advanced: {
    cookiePrefix: SESSION_COOKIE_PREFIX,
    useSecureCookies: isProduction,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProduction },
    ipAddress: { ipAddressHeaders: isCfConnectingIpTrusted() ? ["cf-connecting-ip"] : ["x-real-ip"] },
  },

  // Profile edits go through our own routes (nickname rules, avatar validation, language).
  disabledPaths: ["/update-user"],

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
    twoFactor({ issuer: APP_NAME }),
    nextCookies(), // must stay last
  ],
});

export type Auth = typeof auth;
