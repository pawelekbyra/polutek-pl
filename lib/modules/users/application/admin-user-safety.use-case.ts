import { AppContext } from '@/lib/modules/shared/app-context';
import { UseCaseResult, ok, fail } from '@/lib/modules/shared/result';
import { AppError } from '@/lib/modules/shared/app-error';
import { recordAuditEvent } from '@/lib/modules/audit';
import { CannotMuteAdminError, InvalidModerationInputError, UserAlreadyDeletedError, UserNotFoundError } from '../domain/user.errors';

/** Allowed mute lengths in days (the panel offers exactly these; there is no permanent mute on purpose). */
export const MUTE_DAYS = [1, 7, 30, 365] as const;
export const MUTE_REASON_MIN = 3;
export const MUTE_REASON_MAX = 300;
const DAY_MS = 86_400_000;

const adminOnly = (ctx: AppContext) => ctx.actor.type === 'admin';
const unauthorized = () => fail(new AppError('Brak uprawnień administratora.', 403, 'FORBIDDEN'));

/**
 * Mutes commenting for one account for N days: it can still read and react, but `createVideoComment` refuses new
 * comments until the date passes. Needs a reason (kept on the user row and in the audit row). Calling it again
 * replaces the date (extends or shortens). Never an ADMIN account, never a deleted one.
 * The change and its audit row (before/after) commit together.
 */
export async function muteUserCommenting(
  ctx: AppContext,
  input: { userId: string; days: number; reason: string },
): Promise<UseCaseResult<{ mutedUntil: Date }, AppError>> {
  if (!adminOnly(ctx)) return unauthorized();
  const reason = input.reason.trim();
  if (!(MUTE_DAYS as readonly number[]).includes(input.days)) return fail(new InvalidModerationInputError('Wybierz czas wyciszenia: 1, 7, 30 albo 365 dni.'));
  if (reason.length < MUTE_REASON_MIN || reason.length > MUTE_REASON_MAX) return fail(new InvalidModerationInputError(`Podaj powód (${MUTE_REASON_MIN}-${MUTE_REASON_MAX} znaków).`));

  const outcome = await ctx.db.writeTransaction(async (tx): Promise<{ error: AppError } | { mutedUntil: Date }> => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { role: true, isDeleted: true, commentMutedUntil: true } });
    if (!user) return { error: new UserNotFoundError(input.userId) };
    if (user.isDeleted) return { error: new UserAlreadyDeletedError() };
    if (user.role === 'ADMIN') return { error: new CannotMuteAdminError() };
    const mutedUntil = new Date(ctx.now().getTime() + input.days * DAY_MS);
    await tx.user.update({ where: { id: input.userId }, data: { commentMutedUntil: mutedUntil, commentMuteReason: reason } });
    await recordAuditEvent(ctx, {
      action: 'ADMIN_USER_COMMENT_MUTED',
      targetType: 'User',
      targetId: input.userId,
      metadata: { reason, days: input.days, before: user.commentMutedUntil?.toISOString() ?? null, after: mutedUntil.toISOString() },
    }, tx);
    return { mutedUntil };
  });
  return 'error' in outcome ? fail(outcome.error) : ok({ mutedUntil: outcome.mutedUntil });
}

/** Lifts the mute. Not muted (or expired) is a no-op without an audit row. */
export async function unmuteUserCommenting(ctx: AppContext, input: { userId: string }): Promise<UseCaseResult<{ changed: boolean }, AppError>> {
  if (!adminOnly(ctx)) return unauthorized();
  const outcome = await ctx.db.writeTransaction(async (tx): Promise<{ error: AppError } | { changed: boolean }> => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { commentMutedUntil: true } });
    if (!user) return { error: new UserNotFoundError(input.userId) };
    if (!user.commentMutedUntil) return { changed: false };
    await tx.user.update({ where: { id: input.userId }, data: { commentMutedUntil: null, commentMuteReason: null } });
    await recordAuditEvent(ctx, { action: 'ADMIN_USER_COMMENT_UNMUTED', targetType: 'User', targetId: input.userId, metadata: { before: user.commentMutedUntil.toISOString(), after: null } }, tx);
    return { changed: true };
  });
  return 'error' in outcome ? fail(outcome.error) : ok({ changed: outcome.changed });
}

/**
 * Signs a person out: every session (`sessionId` absent) or one session of theirs. Deleting the rows ends the
 * sessions at the next check; Better Auth's 60 s cookie cache can keep an already open tab signed in for up to a
 * minute. Zero sessions is a no-op without an audit row. A session id of another user is "not found" (never touched).
 */
export async function revokeUserSessions(ctx: AppContext, input: { userId: string; sessionId?: string }): Promise<UseCaseResult<{ revoked: number }, AppError>> {
  if (!adminOnly(ctx)) return unauthorized();
  const outcome = await ctx.db.writeTransaction(async (tx): Promise<{ error: AppError } | { revoked: number }> => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user) return { error: new UserNotFoundError(input.userId) };
    const { count } = await tx.session.deleteMany({ where: input.sessionId ? { id: input.sessionId, userId: input.userId } : { userId: input.userId } });
    if (input.sessionId && count === 0) return { error: new AppError('Ta sesja już nie istnieje.', 404, 'SESSION_NOT_FOUND') };
    if (count > 0) {
      await recordAuditEvent(ctx, { action: 'ADMIN_USER_SESSIONS_REVOKED', targetType: 'User', targetId: input.userId, metadata: { scope: input.sessionId ? 'one' : 'all', count } }, tx);
    }
    return { revoked: count };
  });
  return 'error' in outcome ? fail(outcome.error) : ok({ revoked: outcome.revoked });
}
