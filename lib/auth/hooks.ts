import crypto from "crypto";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DEFAULT_AVATAR_URL } from "@/lib/auth/avatar";
import { validateNickname } from "@/lib/auth/nickname";
import { recordAuthAudit } from "./audit";
import { SIGN_IN_EMAIL_LIMIT, SIGN_IN_EMAIL_WINDOW_SECONDS } from "./config";
import { hitAuthCounter } from "./rate-limit-storage";
import { queuePasswordChangedEmail, queueWelcomeEmail } from "./emails";

type HookCtx = {
  path?: string;
  headers?: Headers | null;
  request?: Request | null;
} | null | undefined;

function readLanguageCookie(ctx: HookCtx): "pl" | "en" {
  const cookie = ctx?.headers?.get("cookie") ?? ctx?.request?.headers.get("cookie") ?? "";
  return /(?:^|;\s*)app-language=pl(?:;|$)/.test(cookie) ? "pl" : "en";
}

export async function isNicknameTaken(name: string, exceptUserId?: string): Promise<boolean> {
  const taken = await prisma.user.findFirst({
    where: {
      isDeleted: false,
      name: { equals: name, mode: "insensitive" },
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(taken);
}

type NewUser = Record<string, unknown> & { name?: string | null; email: string };

/** databaseHooks.user.create.before: nickname rules, default avatar, onboarding flag, language. */
export async function beforeUserCreate(user: NewUser, ctx: HookCtx) {
  const isEmailSignUp = ctx?.path === "/sign-up/email";
  const data: Record<string, unknown> = { ...user, image: DEFAULT_AVATAR_URL };

  if (isEmailSignUp) {
    const nickname = validateNickname(String(user.name ?? ""));
    if (!nickname.ok) {
      throw new APIError("BAD_REQUEST", { message: "INVALID_NICKNAME", code: "INVALID_NICKNAME" });
    }
    if (await isNicknameTaken(nickname.value)) {
      throw new APIError("BAD_REQUEST", { message: "NICKNAME_TAKEN", code: "NICKNAME_TAKEN" });
    }
    data.name = nickname.value;
  } else {
    // Google (redirect or One Tap): the provider name is only a placeholder until the viewer
    // picks a nickname in the first-sign-in dialog.
    data.onboardingPending = true;
    data.language = readLanguageCookie(ctx);
  }
  return { data };
}

/** databaseHooks.user.create.after: audit only. The welcome mail goes out after verification / onboarding. */
export async function afterUserCreate(user: { id?: string }, ctx: HookCtx) {
  await recordAuthAudit({ action: "AUTH_SIGN_UP", userId: user.id ?? null, metadata: { path: ctx?.path ?? "unknown" } });
}

export function sendWelcomeOnce(user: { email: string; name?: string | null; language?: string | null }) {
  queueWelcomeEmail(user);
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

export const authAfterHook = createAuthMiddleware(async (ctx) => {
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
