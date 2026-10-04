import { createHash } from "node:crypto";
import { z } from "zod";
import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import type { BetterAuthPlugin } from "better-auth";
import { prisma } from "@/lib/prisma";
import { recordAdminAuthEvent } from "./audit";
import { isStepUpFresh } from "./session-rules";

/**
 * Panel-specific auth endpoints and guards on top of Better Auth:
 *  - POST /enrollment/redeem   one-time link from `admin-enroll` -> a short enrollment session
 *  - GET  /enrollment/state    what is still missing (TOTP, passkey)
 *  - POST /enrollment/complete marks the account enrolled once TOTP is verified and a passkey exists
 *  - POST /step-up/totp        re-confirms identity on the current session with an authenticator code
 * Guards: TOTP setup only before enrollment; adding a passkey only before enrollment or right after a
 * step-up; every passkey sign-in and sign-out lands in AdminAuthEvent.
 */
export const PANEL_PATHS = {
  redeem: "/enrollment/redeem",
  state: "/enrollment/state",
  complete: "/enrollment/complete",
  stepUpTotp: "/step-up/totp",
  passkeyRegisterOptions: "/passkey/generate-register-options",
  passkeyRegister: "/passkey/verify-registration",
  passkeySignIn: "/passkey/verify-authentication",
  totpEnable: "/two-factor/enable",
  totpVerify: "/two-factor/verify-totp",
  signOut: "/sign-out",
} as const;

export function hashEnrollmentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type SessionLike = { session: { createdAt: Date | string; stepUpAt?: Date | string | null }; user: { id: string; enrolledAt?: Date | string | null } };

function requestHeaders(ctx: { headers?: Headers; request?: Request }): Headers | null {
  return ctx.headers ?? ctx.request?.headers ?? null;
}

export const panelAuthPlugin = () =>
  ({
    id: "pp-admin-panel",
    endpoints: {
      redeemEnrollment: createAuthEndpoint(
        PANEL_PATHS.redeem,
        { method: "POST", body: z.object({ token: z.string().min(20).max(200) }) },
        async (ctx) => {
          const headers = requestHeaders(ctx);
          const now = new Date();
          const tokenHash = hashEnrollmentToken(ctx.body.token);
          const row = await prisma.adminEnrollment.findUnique({ where: { tokenHash }, select: { id: true, userId: true } });
          // Single use, atomically: only the first request that flips usedAt wins.
          const claimed = row
            ? await prisma.adminEnrollment.updateMany({
                where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
                data: { usedAt: now },
              })
            : { count: 0 };
          if (!row || claimed.count !== 1) {
            await recordAdminAuthEvent({ action: "ADMIN_ENROLL_REDEEMED", outcome: "failure", reason: row ? "expired_or_used" : "unknown_token", headers });
            throw new APIError("BAD_REQUEST", { code: "ENROLLMENT_LINK_INVALID", message: "ENROLLMENT_LINK_INVALID" });
          }
          const user = await ctx.context.internalAdapter.findUserById(row.userId);
          if (!user) throw new APIError("BAD_REQUEST", { code: "ENROLLMENT_LINK_INVALID", message: "ENROLLMENT_LINK_INVALID" });
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          await recordAdminAuthEvent({ action: "ADMIN_ENROLL_REDEEMED", outcome: "success", adminUserId: user.id, email: user.email, headers });
          return ctx.json({ ok: true });
        },
      ),

      enrollmentState: createAuthEndpoint(PANEL_PATHS.state, { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
        const userId = ctx.context.session.user.id;
        const [twoFactor, passkeys, user] = await Promise.all([
          prisma.adminTwoFactor.findFirst({ where: { userId }, select: { verified: true } }),
          prisma.adminPasskey.count({ where: { userId } }),
          prisma.adminUser.findUnique({ where: { id: userId }, select: { email: true, enrolledAt: true } }),
        ]);
        return ctx.json({
          email: user?.email ?? null,
          totp: twoFactor?.verified === true,
          passkeys,
          enrolled: !!user?.enrolledAt,
        });
      }),

      completeEnrollment: createAuthEndpoint(PANEL_PATHS.complete, { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const userId = ctx.context.session.user.id;
        const headers = requestHeaders(ctx);
        const [twoFactor, passkeys] = await Promise.all([
          prisma.adminTwoFactor.findFirst({ where: { userId, verified: true }, select: { id: true } }),
          prisma.adminPasskey.count({ where: { userId } }),
        ]);
        if (!twoFactor || passkeys < 1) {
          throw new APIError("BAD_REQUEST", { code: "ENROLLMENT_INCOMPLETE", message: "ENROLLMENT_INCOMPLETE" });
        }
        await prisma.adminUser.updateMany({ where: { id: userId, enrolledAt: null }, data: { enrolledAt: new Date() } });
        await recordAdminAuthEvent({ action: "ADMIN_ENROLLED", outcome: "success", adminUserId: userId, email: ctx.context.session.user.email, headers });
        return ctx.json({ ok: true });
      }),

      stepUpTotp: createAuthEndpoint(
        PANEL_PATHS.stepUpTotp,
        { method: "POST", use: [sessionMiddleware], body: z.object({ code: z.string().regex(/^\d{6}$/) }) },
        async (ctx) => {
          const { session, user } = ctx.context.session;
          const headers = requestHeaders(ctx);
          const twoFactor = await prisma.adminTwoFactor.findFirst({ where: { userId: user.id, verified: true } });
          if (!twoFactor) throw new APIError("BAD_REQUEST", { code: "TOTP_NOT_ENABLED", message: "TOTP_NOT_ENABLED" });
          if (twoFactor.lockedUntil && twoFactor.lockedUntil > new Date()) {
            throw new APIError("TOO_MANY_REQUESTS", { code: "TOTP_LOCKED", message: "TOTP_LOCKED" });
          }
          const secret = await symmetricDecrypt({ key: ctx.context.secretConfig, data: twoFactor.secret });
          const valid = await createOTP(secret, { digits: 6, period: 30 }).verify(ctx.body.code);
          if (!valid) {
            const failures = twoFactor.failedVerificationCount + 1;
            await prisma.adminTwoFactor.update({
              where: { id: twoFactor.id },
              data: {
                failedVerificationCount: failures >= 5 ? 0 : failures,
                lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
              },
            });
            await recordAdminAuthEvent({ action: "ADMIN_STEP_UP", outcome: "failure", adminUserId: user.id, email: user.email, reason: "totp_invalid", headers });
            throw new APIError("UNAUTHORIZED", { code: "INVALID_CODE", message: "INVALID_CODE" });
          }
          await prisma.adminTwoFactor.update({ where: { id: twoFactor.id }, data: { failedVerificationCount: 0, lockedUntil: null } });
          await ctx.context.internalAdapter.updateSession(session.token, { stepUpAt: new Date() });
          await recordAdminAuthEvent({ action: "ADMIN_STEP_UP", outcome: "success", adminUserId: user.id, email: user.email, reason: "totp", headers });
          return ctx.json({ ok: true });
        },
      ),
    },

    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === PANEL_PATHS.totpEnable || ctx.path === PANEL_PATHS.totpVerify,
          handler: createAuthMiddleware(async (ctx) => {
            const current = (await getSessionFromCtx(ctx)) as SessionLike | null;
            if (current?.user.enrolledAt) {
              // After enrollment TOTP is changed only through `admin-enroll --reset` on the server.
              throw new APIError("FORBIDDEN", { code: "TOTP_LOCKED_AFTER_ENROLLMENT", message: "TOTP_LOCKED_AFTER_ENROLLMENT" });
            }
          }),
        },
        {
          matcher: (ctx) => ctx.path === PANEL_PATHS.passkeyRegisterOptions || ctx.path === PANEL_PATHS.passkeyRegister,
          handler: createAuthMiddleware(async (ctx) => {
            const current = (await getSessionFromCtx(ctx)) as SessionLike | null;
            if (current?.user.enrolledAt && !isStepUpFresh(current.session)) {
              throw new APIError("FORBIDDEN", { code: "STEP_UP_REQUIRED", message: "STEP_UP_REQUIRED" });
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === PANEL_PATHS.passkeySignIn,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            const headers = requestHeaders(ctx);
            const newUser = ctx.context.newSession?.user as { id: string; email: string } | undefined;
            if (!returned || returned instanceof Error || !newUser) {
              await recordAdminAuthEvent({ action: "ADMIN_SIGN_IN", outcome: "failure", reason: "passkey_rejected", headers });
              return;
            }
            // Signing in again while signed in is the passkey step-up; the audit tells the two apart.
            const previous = (await getSessionFromCtx(ctx).catch(() => null)) as SessionLike | null;
            await recordAdminAuthEvent({
              action: previous ? "ADMIN_STEP_UP" : "ADMIN_SIGN_IN",
              outcome: "success",
              adminUserId: newUser.id,
              email: newUser.email,
              reason: "passkey",
              headers,
            });
          }),
        },
        {
          matcher: (ctx) => ctx.path === PANEL_PATHS.passkeyRegister,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as { id?: string; userId?: string } | Error | undefined;
            if (!returned || returned instanceof Error || !returned.userId) return;
            await recordAdminAuthEvent({ action: "ADMIN_PASSKEY_ADDED", outcome: "success", adminUserId: returned.userId, headers: requestHeaders(ctx) });
          }),
        },
        {
          matcher: (ctx) => ctx.path === PANEL_PATHS.totpVerify,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as { status?: boolean } | Error | undefined;
            const current = (await getSessionFromCtx(ctx).catch(() => null)) as SessionLike | null;
            if (!returned || returned instanceof Error || !current) return;
            await recordAdminAuthEvent({ action: "ADMIN_TOTP_ENABLED", outcome: "success", adminUserId: current.user.id, headers: requestHeaders(ctx) });
          }),
        },
        {
          matcher: (ctx) => ctx.path === PANEL_PATHS.signOut,
          handler: createAuthMiddleware(async (ctx) => {
            await recordAdminAuthEvent({ action: "ADMIN_SIGN_OUT", outcome: "success", headers: requestHeaders(ctx) });
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
