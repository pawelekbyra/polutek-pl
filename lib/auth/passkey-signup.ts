import crypto from "crypto";
import { APIError, createAuthEndpoint, getSessionFromCtx, sendVerificationEmailFn } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { assertMailToAddressAllowed, countMailToAddress, existingAccountCode } from "./hooks";
import { assertPasskeyUserVerified } from "./passkey";
import { sanitizeReturnPath } from "./sso-return";

/**
 * Passkey-first sign-up (owner decision 2026-10-04): "Use a passkey" also creates an account.
 *
 * 1. `POST /api/auth/passkey-signup/start` (Turnstile + per-IP limit): the visitor types an e-mail; an
 *    address that already has an account answers EMAIL_TAKEN / EMAIL_TAKEN_GOOGLE (same decision as the
 *    e-mail sign-up), otherwise the server returns a short-lived signed token. Nothing is stored yet.
 * 2. The browser registers a passkey with that token as the plugin's `context`
 *    (`registration.requireSession: false`). `resolveUser` only accepts a valid token.
 * 3. After the WebAuthn ceremony succeeded (and the device verified the user), `afterVerification`
 *    creates the account (unverified, onboarding pending) and the passkey is stored for it; the
 *    verification e-mail goes out. No session is created: the account signs in only after the e-mail
 *    link is clicked (it signs in, then the first-sign-in dialog asks for nickname/avatar/language).
 *
 * See docs/architecture/auth-better-auth.md ("Passkey-first sign-up") for the threats and mitigations.
 */

export const PASSKEY_SIGNUP_PATH = "/passkey-signup/start";
export const PASSKEY_SIGNUP_TOKEN_TTL_SECONDS = 10 * 60;
/** Placeholder user id between the options request and account creation (never stored). */
const PENDING_USER_PREFIX = "passkey-signup:";
const EMAIL_MAX_LENGTH = 254;

export type PasskeySignupClaims = {
  email: string;
  language: "pl" | "en";
  callbackURL: string;
  nonce: string;
  /** Expiry, unix seconds. */
  exp: number;
};

function hmac(payload: string, secret: string) {
  return crypto.createHmac("sha256", `passkey-signup:${secret}`).update(payload).digest("base64url");
}

export function signPasskeySignupToken(claims: PasskeySignupClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

/** The claims of a valid, unexpired token, or null (wrong signature, malformed, expired). */
export function verifyPasskeySignupToken(token: unknown, secret: string, now: number = Date.now()): PasskeySignupClaims | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmac(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PasskeySignupClaims;
    if (typeof claims.email !== "string" || typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Lower-cased address if it looks like one (the real proof is the verification link). */
export function normalizeSignupEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isPendingPasskeySignupUser(userId: string | undefined | null): boolean {
  return typeof userId === "string" && userId.startsWith(PENDING_USER_PREFIX);
}

function expired(): APIError {
  return new APIError("BAD_REQUEST", { message: "PASSKEY_SIGNUP_EXPIRED", code: "PASSKEY_SIGNUP_EXPIRED" });
}

type SecretCtx = { context: { secret: string } };

/** `registration.resolveUser`: only a valid sign-up token may start a registration without a session. */
export async function resolvePasskeySignupUser({ ctx, context }: { ctx: SecretCtx; context?: string | null }) {
  const claims = verifyPasskeySignupToken(context, ctx.context.secret);
  if (!claims) throw expired();
  return { id: `${PENDING_USER_PREFIX}${claims.nonce}`, name: claims.email, displayName: claims.email };
}

type RegistrationCtx = Parameters<typeof getSessionFromCtx>[0] &
  SecretCtx & {
    context: {
      secret: string;
      internalAdapter: { createUser: (user: Record<string, unknown>) => Promise<{ id: string; email: string; name: string }> };
    };
  };

/**
 * `registration.afterVerification`: the device must have verified the user; a signed-in user adds a key
 * to their own account (fresh session checked in the before hook); a sign-up token creates the account.
 */
export async function afterPasskeyRegistration(input: {
  ctx: RegistrationCtx;
  verification: { registrationInfo?: { userVerified?: boolean } };
  user: { id: string };
  context?: string | null;
}): Promise<{ userId: string } | void> {
  assertPasskeyUserVerified(input.verification.registrationInfo?.userVerified);
  if (!isPendingPasskeySignupUser(input.user.id)) {
    // The challenge was issued to a signed-in user; that same session must still be there.
    const session = await getSessionFromCtx(input.ctx);
    if (!session) throw new APIError("UNAUTHORIZED", { message: "SESSION_REQUIRED", code: "SESSION_REQUIRED" });
    return;
  }
  const claims = verifyPasskeySignupToken(input.context, input.ctx.context.secret);
  if (!claims) throw expired();
  const taken = await existingAccountCode(claims.email);
  if (taken) throw new APIError("UNPROCESSABLE_ENTITY", { message: taken, code: taken });

  // beforeUserCreate fills the placeholder name, default avatar, onboarding flag and terms stamp.
  const user = await input.ctx.context.internalAdapter.createUser({
    email: claims.email,
    name: claims.email.split("@")[0] || "user",
    emailVerified: false,
    language: claims.language,
  });
  try {
    await sendVerificationEmailFn({ ...input.ctx, body: { callbackURL: claims.callbackURL } } as never, user as never);
    await countMailToAddress(claims.email, undefined);
  } catch (error) {
    // The account and key stay; "Resend the link" in the inbox step (or the next passkey sign-in) retries.
    logger.error("[auth] passkey sign-up verification e-mail failed", error instanceof Error ? error.message : String(error));
  }
  return { userId: user.id };
}

type AuthenticationCtx = SecretCtx & { body?: unknown };

/**
 * `authentication.afterVerification`: the device must have verified the user, and an account created by
 * a passkey signs in only once its e-mail is verified (like a password sign-up). An unverified account
 * gets a new link (limited per address) and EMAIL_NOT_VERIFIED.
 */
export async function afterPasskeyAuthentication(input: {
  ctx: AuthenticationCtx;
  verification: { authenticationInfo: { userVerified?: boolean } };
  clientData?: { id?: unknown };
}) {
  assertPasskeyUserVerified(input.verification.authenticationInfo.userVerified);
  const credentialID = typeof input.clientData?.id === "string" ? input.clientData.id : null;
  if (!credentialID) return;
  const passkey = await prisma.passkey.findUnique({
    where: { credentialID },
    select: { user: { select: { id: true, email: true, name: true, emailVerified: true, isDeleted: true } } },
  });
  const user = passkey?.user;
  if (!user || user.emailVerified || user.isDeleted) return;
  try {
    await assertMailToAddressAllowed(user.email);
    await sendVerificationEmailFn({ ...input.ctx, body: { callbackURL: "/?verified=1" } } as never, user as never);
    await countMailToAddress(user.email, undefined);
  } catch {
    // Over the per-address mail limit (or the mail failed): still refuse the sign-in below.
  }
  throw new APIError("FORBIDDEN", { message: "EMAIL_NOT_VERIFIED", code: "EMAIL_NOT_VERIFIED" });
}

/** Endpoint that checks the address and issues the sign-up token (Turnstile and rate limit in auth.ts). */
export function passkeySignup(): BetterAuthPlugin {
  return {
    id: "passkey-signup",
    endpoints: {
      startPasskeySignup: createAuthEndpoint(PASSKEY_SIGNUP_PATH, { method: "POST" }, async (ctx) => {
        const body = (ctx.body ?? {}) as { email?: unknown; language?: unknown; callbackURL?: unknown };
        const email = normalizeSignupEmail(body.email);
        if (!email) throw new APIError("BAD_REQUEST", { message: "INVALID_EMAIL", code: "INVALID_EMAIL" });
        const taken = await existingAccountCode(email);
        if (taken) throw new APIError("UNPROCESSABLE_ENTITY", { message: taken, code: taken });
        const claims: PasskeySignupClaims = {
          email,
          language: body.language === "pl" ? "pl" : "en",
          callbackURL: sanitizeReturnPath(typeof body.callbackURL === "string" ? body.callbackURL : "/"),
          nonce: crypto.randomUUID(),
          exp: Math.floor(Date.now() / 1000) + PASSKEY_SIGNUP_TOKEN_TTL_SECONDS,
        };
        return ctx.json({ token: signPasskeySignupToken(claims, ctx.context.secret) });
      }),
    },
  };
}
