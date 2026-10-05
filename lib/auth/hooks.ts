import crypto from "crypto";
import { APIError, createAuthMiddleware, getIP, getSessionFromCtx } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DEFAULT_AVATAR_URL } from "@/lib/auth/avatar";
import { validateNickname } from "@/lib/auth/nickname";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import { recordAuthAudit } from "./audit";
import { checkSensitiveReauth } from "./reauth";
import {
  CHANGE_EMAIL_LIMIT_PER_USER,
  CHANGE_EMAIL_WINDOW_SECONDS,
  MAIL_TO_ADDRESS_LIMIT,
  MAIL_TO_ADDRESS_WINDOW_SECONDS,
  SIGN_IN_FAILURE_LIMIT_PER_EMAIL,
  SIGN_IN_FAILURE_LIMIT_PER_IP,
  SIGN_IN_FAILURE_WINDOW_SECONDS,
} from "./config";
import { hitAuthCounter, peekAuthCounter } from "./rate-limit-storage";
import { queuePasswordChangedEmail } from "./emails";
import {
  PASSKEY_PATHS,
  assertFreshSessionIfSignedIn,
  auditPasskeyEvent,
  sanitizePasskeyRegistrationBody,
  stripPasskeyOptionsName,
} from "./passkey";

type HookCtx = {
  path?: string;
  headers?: Headers | null;
  request?: Request | null;
} | null | undefined;

function readLanguageCookie(ctx: HookCtx): Locale {
  const cookie = ctx?.headers?.get("cookie") ?? ctx?.request?.headers.get("cookie") ?? "";
  const value = /(?:^|;\s*)app-language=([a-z]+)(?:;|$)/.exec(cookie)?.[1];
  return isLocale(value) ? value : "en";
}

type NewUser = Record<string, unknown> & { name?: string | null; email: string };

/** Neutral stand-in name for accounts that have not picked a nickname yet (never shown as final). */
export function placeholderNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/[^\p{L}\p{N}._ -]/gu, "").trim() ?? "";
  return (local || "user").slice(0, 30);
}

/**
 * databaseHooks.user.create.before: default avatar, onboarding flag, language, Terms acceptance.
 * Nobody (e-mail or Google) picks a nickname at sign-up: every new account gets a placeholder name and
 * `onboardingPending`, and chooses the nickname (checked for uniqueness in completeOnboarding) in the
 * first-sign-in dialog. Every way to create an account (e-mail form, Google button, One Tap) lives in
 * the sign-in window, which states that creating an account accepts the Terms (with links to the Terms
 * and the Privacy Policy), so the acceptance is recorded with the current documents' version.
 */
export async function beforeUserCreate(user: NewUser, ctx: HookCtx) {
  const data: Record<string, unknown> = {
    ...user,
    image: DEFAULT_AVATAR_URL,
    onboardingPending: true,
    termsAcceptedAt: new Date(),
    termsVersion: LEGAL_DOCUMENTS_VERSION,
  };

  if (ctx?.path === "/sign-up/email" || ctx?.path === PASSKEY_PATHS.register) {
    // E-mail sign-up and passkey-first sign-up (whose language comes from the sign-up token). The
    // language field is client input, so only a real locale is kept; otherwise the site's cookie.
    data.name = placeholderNameFromEmail(user.email);
    data.language = isLocale(user.language) ? user.language : readLanguageCookie(ctx);
  } else {
    // Google (redirect or One Tap): the provider name is only a placeholder as well.
    data.language = readLanguageCookie(ctx);
  }
  return { data };
}

/** databaseHooks.user.create.after: audit only. The welcome mail goes out after verification / onboarding. */
export async function afterUserCreate(user: { id?: string }, ctx: HookCtx) {
  await recordAuthAudit({ action: "AUTH_SIGN_UP", userId: user.id ?? null, metadata: { path: ctx?.path ?? "unknown" } });
}

/** databaseHooks.session.create.before: a soft-deleted account can never get a session. */
export async function beforeSessionCreate(session: { userId: string }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isDeleted: true } });
  if (!user || user.isDeleted) {
    throw new APIError("FORBIDDEN", { message: "ACCOUNT_DELETED", code: "ACCOUNT_DELETED" });
  }
}

/**
 * Accounts that predate the Better Auth nickname rules (no name, a name that breaks the rules, or one
 * another older account already uses) are sent through the first-sign-in dialog at their next sign-in,
 * so everybody ends up with a valid, unique nickname. The older of two duplicates keeps its name.
 */
export async function flagNicknameOnboardingIfNeeded(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, onboardingPending: true, isDeleted: true, createdAt: true },
  });
  if (!user || user.isDeleted || user.onboardingPending) return;
  const name = user.name?.trim() ?? "";
  let needsNickname = name.length === 0 || !validateNickname(name).ok;
  if (!needsNickname) {
    const olderOwner = await prisma.user.findFirst({
      where: { isDeleted: false, onboardingPending: false, id: { not: userId }, createdAt: { lte: user.createdAt }, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    needsNickname = Boolean(olderOwner);
  }
  if (needsNickname) await prisma.user.update({ where: { id: userId }, data: { onboardingPending: true } });
}

export async function afterSessionCreate(session: { userId: string; ipAddress?: string | null; userAgent?: string | null }) {
  await recordAuthAudit({
    action: "AUTH_SIGN_IN",
    userId: session.userId,
    ip: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
  });
  try {
    await flagNicknameOnboardingIfNeeded(session.userId);
  } catch (error) {
    // Never block a sign-in over the nickname check.
    logger.warn("[auth] nickname onboarding check failed", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Pre-hijack guard: when a verified provider (Google) is linked to an account whose e-mail was
 * never verified, any password someone set at sign-up is dropped, otherwise the person who
 * registered the address first would keep a working password on the real owner's account.
 */
export async function beforeAccountCreate(account: { userId: string; providerId: string }) {
  if (account.providerId === "credential") return;
  const user = await prisma.user.findUnique({ where: { id: account.userId }, select: { emailVerified: true } });
  if (user && !user.emailVerified) {
    await prisma.$transaction([
      prisma.account.deleteMany({ where: { userId: account.userId, providerId: "credential" } }),
      prisma.passkey.deleteMany({ where: { userId: account.userId } }),
      prisma.session.deleteMany({ where: { userId: account.userId } }),
    ]);
    logger.warn("[auth] dropped unverified credential/passkeys while linking a verified provider");
  }
}

function hashKey(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

type SignInCtx = { request?: Request | null; context?: { options?: unknown } };

function clientIpKey(ctx: SignInCtx): string {
  try {
    const ip = ctx.request ? getIP(ctx.request, ctx.context?.options as never) : null;
    return hashKey(ip ?? "unknown");
  } catch {
    return hashKey("unknown");
  }
}

function signInFailureKeys(email: string, ctx: SignInCtx) {
  const emailHash = hashKey(email);
  return { perIp: `signin-fail:${emailHash}:${clientIpKey(ctx)}`, perEmail: `signin-fail:${emailHash}` };
}

/** Throws 429 when this e-mail (from this client, or overall) has had too many failed sign-ins recently. */
export async function assertSignInNotLocked(email: string, ctx: SignInCtx) {
  const keys = signInFailureKeys(email, ctx);
  const [perIp, perEmail] = await Promise.all([peekAuthCounter(keys.perIp), peekAuthCounter(keys.perEmail)]);
  if (perIp >= SIGN_IN_FAILURE_LIMIT_PER_IP || perEmail >= SIGN_IN_FAILURE_LIMIT_PER_EMAIL) {
    throw new APIError("TOO_MANY_REQUESTS", { message: "TOO_MANY_ATTEMPTS", code: "TOO_MANY_ATTEMPTS" });
  }
}

/** Counts a sign-in towards the lockout only when it failed because of a wrong e-mail/password. */
export async function recordSignInOutcome(email: string, returned: unknown, ctx: SignInCtx) {
  const code = (returned as { body?: { code?: string } } | undefined)?.body?.code;
  if (code !== "INVALID_EMAIL_OR_PASSWORD") return;
  const keys = signInFailureKeys(email, ctx);
  await Promise.all([
    hitAuthCounter(keys.perIp, SIGN_IN_FAILURE_WINDOW_SECONDS),
    hitAuthCounter(keys.perEmail, SIGN_IN_FAILURE_WINDOW_SECONDS),
  ]);
}

type ChangeEmailCtx = Parameters<typeof getSessionFromCtx>[0] & {
  body?: unknown;
  context: { password: { verify: (input: { hash: string; password: string }) => Promise<boolean> } };
};

/**
 * `/change-email` needs more than a valid session (audit AUTH-02/SEC-04): the password (or, for a
 * Google-only account, a sign-in from the last few minutes), at most CHANGE_EMAIL_LIMIT_PER_USER requests
 * per user per hour (each one sends an e-mail, AUTH-03), and the change itself must be approved from
 * the current address (`sendChangeEmailConfirmation` in auth.ts) before the new one is verified.
 */
export async function guardChangeEmail(ctx: ChangeEmailCtx) {
  const session = await getSessionFromCtx(ctx);
  if (!session) return; // the endpoint answers 401 itself
  const userId = session.user.id;
  const attempts = await hitAuthCounter(`change-email:${userId}`, CHANGE_EMAIL_WINDOW_SECONDS);
  if (attempts > CHANGE_EMAIL_LIMIT_PER_USER) {
    throw new APIError("TOO_MANY_REQUESTS", { message: "TOO_MANY_ATTEMPTS", code: "TOO_MANY_ATTEMPTS" });
  }
  const body = ctx.body as { password?: unknown } | undefined;
  const result = await checkSensitiveReauth({
    userId,
    sessionId: session.session.id,
    password: typeof body?.password === "string" ? body.password : null,
    verifyPassword: (input) => ctx.context.password.verify(input),
  });
  if (result !== "ok") {
    throw new APIError(result === "PASSWORD_REQUIRED" ? "UNAUTHORIZED" : "FORBIDDEN", { message: result, code: result });
  }
}

/** Paths that send a mail to an address typed into a public form; also limited per target address (AUTH-30). */
const MAIL_TO_ADDRESS_PATHS = new Set(["/request-password-reset", "/send-verification-email"]);

function mailToAddressKey(email: string) {
  return `mail-to:${hashKey(email)}`;
}

/** Throws 429 once an address got MAIL_TO_ADDRESS_LIMIT mails from these forms within the window. */
export async function assertMailToAddressAllowed(email: string) {
  if ((await peekAuthCounter(mailToAddressKey(email))) >= MAIL_TO_ADDRESS_LIMIT) {
    throw new APIError("TOO_MANY_REQUESTS", { message: "TOO_MANY_ATTEMPTS", code: "TOO_MANY_ATTEMPTS" });
  }
}

/**
 * Counted in the AFTER hook, i.e. only for requests that passed Turnstile and the endpoint, so a bot
 * without a solved check cannot burn the budget of somebody else's address.
 */
export async function countMailToAddress(email: string, returned: unknown) {
  if (returned instanceof Error || (returned as { status?: unknown } | undefined)?.status === false) return;
  await hitAuthCounter(mailToAddressKey(email), MAIL_TO_ADDRESS_WINDOW_SECONDS);
}

function bodyEmail(ctx: { body?: unknown }) {
  const email = (ctx.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email : "";
}

export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  // A password change always signs the other devices out, whatever the client asked for.
  if (ctx.path === "/change-password") {
    return { context: { ...ctx, body: { ...(ctx.body as object), revokeOtherSessions: true } } };
  }
  if (ctx.path === "/change-email") {
    await guardChangeEmail(ctx as unknown as ChangeEmailCtx);
    return;
  }
  // Adding a key to a signed-in account needs a fresh session (registration without a session is the
  // passkey-first sign-up, gated by its signed token in lib/auth/passkey-signup.ts).
  if (ctx.path === PASSKEY_PATHS.registerOptions) {
    await assertFreshSessionIfSignedIn(ctx);
    // The plugin would use `?name=` as the WebAuthn user name; the password manager must show the e-mail.
    return { context: { ...ctx, query: stripPasskeyOptionsName(ctx.query) } };
  }
  if (ctx.path === PASSKEY_PATHS.register) {
    await assertFreshSessionIfSignedIn(ctx);
    return { context: { ...ctx, body: sanitizePasskeyRegistrationBody(ctx.body) } };
  }
  if (ctx.path === PASSKEY_PATHS.remove) {
    await assertFreshSessionIfSignedIn(ctx);
    return;
  }
  if (MAIL_TO_ADDRESS_PATHS.has(ctx.path)) {
    const email = bodyEmail(ctx);
    if (email) await assertMailToAddressAllowed(email);
    return;
  }
  // Lockout after repeated FAILED sign-ins (see config.ts): checked here, counted in the after hook.
  if (ctx.path === "/sign-in/email") {
    const body = ctx.body as { email?: unknown } | undefined;
    const email = typeof body?.email === "string" ? body.email : "";
    if (email) await assertSignInNotLocked(email, ctx as SignInCtx);
  }
});

/**
 * Owner decision 2026-10-02: sign-up with an address that already has an account says so
 * (EMAIL_TAKEN) instead of the generic response. Runs as an AFTER hook on purpose: Better Auth runs
 * `options.hooks.before` ahead of the captcha plugin, so a before hook would let this oracle answer
 * without Turnstile; the endpoint itself runs after the rate limiter and the captcha. For an existing
 * address the endpoint returns a synthetic user whose id differs from the stored one.
 */
export async function rejectExistingEmailSignUp(ctx: { context: { returned?: unknown }; body?: unknown }) {
  const returned = ctx.context.returned as { user?: { id?: string } } | undefined;
  const body = ctx.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !returned?.user?.id || returned instanceof Error) return;
  const code = await existingAccountCode(email, returned.user.id);
  if (code) throw new APIError("UNPROCESSABLE_ENTITY", { message: code, code });
}

/**
 * EMAIL_TAKEN_GOOGLE when the address has an account signed in only through Google, EMAIL_TAKEN for any
 * other existing account, null when it is free (`exceptUserId`: the synthetic sign-up user).
 */
export async function existingAccountCode(email: string, exceptUserId?: string): Promise<"EMAIL_TAKEN" | "EMAIL_TAKEN_GOOGLE" | null> {
  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!existing || existing.id === exceptUserId) return null;
  const providers = await prisma.account.findMany({ where: { userId: existing.id }, select: { providerId: true } });
  const ids = providers.map((p) => p.providerId);
  return ids.includes("google") && !ids.includes("credential") ? "EMAIL_TAKEN_GOOGLE" : "EMAIL_TAKEN";
}

export const authAfterHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-up/email") {
    await rejectExistingEmailSignUp(ctx);
  }
  // Count a wrong password (and only that) towards the sign-in lockout.
  if (ctx.path === "/sign-in/email") {
    const body = ctx.body as { email?: unknown } | undefined;
    if (typeof body?.email === "string") await recordSignInOutcome(body.email, ctx.context.returned, ctx as SignInCtx);
  }
  if (MAIL_TO_ADDRESS_PATHS.has(ctx.path)) {
    const email = bodyEmail(ctx);
    if (email) await countMailToAddress(email, ctx.context.returned);
  }
  if (ctx.path === "/change-password") {
    const user = ctx.context.session?.user;
    if (user) {
      queuePasswordChangedEmail({ email: user.email, name: user.name });
      await recordAuthAudit({ action: "AUTH_PASSWORD_CHANGED", userId: user.id, metadata: { via: "change" } });
    }
  }
  if (ctx.path === "/sign-out") {
    await recordAuthAudit({ action: "AUTH_SIGN_OUT", userId: ctx.context.session?.user?.id ?? null });
  }
  if (ctx.path.startsWith("/passkey/")) {
    await auditPasskeyEvent(ctx);
  }
});

export async function onPasswordReset(user: { id: string; email: string; name?: string | null }) {
  // The reset link proves the mailbox. Passkeys on an account whose address was never verified were
  // added by whoever started a passkey sign-up with it, not necessarily the owner: drop them.
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } });
  if (row && !row.emailVerified) await prisma.passkey.deleteMany({ where: { userId: user.id } });
  queuePasswordChangedEmail({ email: user.email, name: user.name });
  await recordAuthAudit({ action: "AUTH_PASSWORD_CHANGED", userId: user.id, metadata: { via: "reset" } });
}
