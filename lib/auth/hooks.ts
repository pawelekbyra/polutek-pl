import crypto from "crypto";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DEFAULT_AVATAR_URL } from "@/lib/auth/avatar";
import { recordAuthAudit } from "./audit";
import { SIGN_IN_EMAIL_LIMIT, SIGN_IN_EMAIL_WINDOW_SECONDS } from "./config";
import { hitAuthCounter } from "./rate-limit-storage";
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

export async function afterSessionCreate(session: { userId: string; ipAddress?: string | null; userAgent?: string | null }) {
  await recordAuthAudit({
    action: "AUTH_SIGN_IN",
    userId: session.userId,
    ip: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
  });
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

function emailKey(email: string) {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  // A password change always signs the other devices out, whatever the client asked for.
  if (ctx.path === "/change-password") {
    return { context: { ...ctx, body: { ...(ctx.body as object), revokeOtherSessions: true } } };
  }
  // Per-account lockout on top of Better Auth's per-IP rule: a distributed guesser cannot hammer one address.
  if (ctx.path === "/sign-in/email") {
    const body = ctx.body as { email?: unknown } | undefined;
    const email = typeof body?.email === "string" ? body.email : "";
    if (email) {
      const record = await hitAuthCounter(`signin-email:${emailKey(email)}`, SIGN_IN_EMAIL_WINDOW_SECONDS);
      if (record.count > SIGN_IN_EMAIL_LIMIT) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "TOO_MANY_ATTEMPTS", code: "TOO_MANY_ATTEMPTS" });
      }
    }
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
