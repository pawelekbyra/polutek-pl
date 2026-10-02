import crypto from "crypto";
import { APIError, createAuthMiddleware, getIP } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DEFAULT_AVATAR_URL } from "@/lib/auth/avatar";
import { validateNickname } from "@/lib/auth/nickname";
import { recordAuthAudit } from "./audit";
import {
  SIGN_IN_FAILURE_LIMIT_PER_EMAIL,
  SIGN_IN_FAILURE_LIMIT_PER_IP,
  SIGN_IN_FAILURE_WINDOW_SECONDS,
} from "./config";
import { hitAuthCounter, peekAuthCounter } from "./rate-limit-storage";
import { queuePasswordChangedEmail } from "./emails";

type HookCtx = {
  path?: string;
  headers?: Headers | null;
  request?: Request | null;
} | null | undefined;

function readLanguageCookie(ctx: HookCtx): "pl" | "en" {
  const cookie = ctx?.headers?.get("cookie") ?? ctx?.request?.headers.get("cookie") ?? "";
  return /(?:^|;\s*)app-language=pl(?:;|$)/.test(cookie) ? "pl" : "en";
}

type NewUser = Record<string, unknown> & { name?: string | null; email: string };

/** Neutral stand-in name for accounts that have not picked a nickname yet (never shown as final). */
export function placeholderNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/[^\p{L}\p{N}._ -]/gu, "").trim() ?? "";
  return (local || "user").slice(0, 30);
}

/**
 * databaseHooks.user.create.before: default avatar, onboarding flag, language. Nobody (e-mail or Google)
 * picks a nickname at sign-up: every new account gets a placeholder name and `onboardingPending`, and
 * chooses the nickname (checked for uniqueness in completeOnboarding) in the first-sign-in dialog.
 */
export async function beforeUserCreate(user: NewUser, ctx: HookCtx) {
  const data: Record<string, unknown> = { ...user, image: DEFAULT_AVATAR_URL, onboardingPending: true };

  if (ctx?.path === "/sign-up/email") {
    data.name = placeholderNameFromEmail(user.email);
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
      where: { isDeleted: false, id: { not: userId }, createdAt: { lte: user.createdAt }, name: { equals: name, mode: "insensitive" } },
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
      prisma.session.deleteMany({ where: { userId: account.userId } }),
    ]);
    logger.warn("[auth] dropped unverified credential while linking a verified provider");
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

export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  // A password change always signs the other devices out, whatever the client asked for.
  if (ctx.path === "/change-password") {
    return { context: { ...ctx, body: { ...(ctx.body as object), revokeOtherSessions: true } } };
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
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!existing || existing.id === returned.user.id) return;
  const providers = await prisma.account.findMany({ where: { userId: existing.id }, select: { providerId: true } });
  const ids = providers.map((p) => p.providerId);
  const googleOnly = ids.includes("google") && !ids.includes("credential");
  const code = googleOnly ? "EMAIL_TAKEN_GOOGLE" : "EMAIL_TAKEN";
  throw new APIError("UNPROCESSABLE_ENTITY", { message: code, code });
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
});

export async function onPasswordReset(user: { id: string; email: string; name?: string | null }) {
  queuePasswordChangedEmail({ email: user.email, name: user.name });
  await recordAuthAudit({ action: "AUTH_PASSWORD_CHANGED", userId: user.id, metadata: { via: "reset" } });
}
