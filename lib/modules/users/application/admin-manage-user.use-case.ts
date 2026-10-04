import { AppContext } from '@/lib/modules/shared/app-context';
import { UseCaseResult, ok, fail } from '@/lib/modules/shared/result';
import { AppError } from '@/lib/modules/shared/app-error';
import { recordAuditEvent } from '@/lib/modules/audit';
import { AccountDeletionCleanupUseCase } from './account-deletion-cleanup.use-case';
import {
  AdminActorNotAdminError,
  AdminRequiresVerifiedEmailError,
  AdminSelfActionError,
  ConfirmEmailMismatchError,
  LastAdminError,
  TargetIsAdminError,
  UserAlreadyDeletedError,
  UserNotFoundError,
} from '../domain/user.errors';

export type ManagedRole = 'ADMIN' | 'USER';

/**
 * Every change to who is an admin runs under this transaction-scoped lock, so two admins demoting each
 * other at the same moment cannot both pass the "someone else is still admin" check.
 */
const ADMIN_ROSTER_LOCK = 'admin-roster';

function sameEmail(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * An admin deletes another user's account. Uses exactly the self-service cleanup
 * (AccountDeletionCleanupUseCase): the row stays as an anonymised tombstone, sessions, logins, 2FA, avatar,
 * subscription and e-mail consents go, comments and payments stay with the anonymous owner, and the
 * ADMIN_USER_DELETED audit row (ids only) is written in the same transaction.
 * Fail closed: never yourself, never an ADMIN (demote first, so the last admin can never be deleted),
 * never an already deleted account, and only with the user's e-mail typed back (case-insensitive).
 * Fresh sign-in of the admin is checked by the route (lib/api/admin-recent-sign-in.ts).
 */
export async function deleteUserAsAdmin(
  ctx: AppContext,
  input: { adminUserId: string; userId: string; confirmEmail: string | null | undefined },
): Promise<UseCaseResult<{ deleted: true }, AppError>> {
  if (input.userId === input.adminUserId) return fail(new AdminSelfActionError('delete'));

  const user = await ctx.prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, role: true, isDeleted: true },
  });
  if (!user) return fail(new UserNotFoundError(input.userId));
  if (user.isDeleted) return fail(new UserAlreadyDeletedError());
  if (user.role === 'ADMIN') return fail(new TargetIsAdminError());
  if (!input.confirmEmail || !sameEmail(input.confirmEmail, user.email)) return fail(new ConfirmEmailMismatchError());

  // Known, accepted gap: a promotion committed between this check and the cleanup would leave a deleted
  // tombstone with role ADMIN. It cannot sign in (no sessions, no logins, isDeleted) and never counts as an admin.
  await AccountDeletionCleanupUseCase.execute(ctx, {
    userId: input.userId,
    source: 'ADMIN_USER_DELETION',
    reason: 'Deleted by an administrator',
  });
  return ok({ deleted: true });
}

/**
 * An admin grants or removes the ADMIN role of another account. Never your own role, never on a deleted
 * account, ADMIN only for a verified e-mail, never removing the last admin. Admin status is read from the
 * database on every request (lib/api/auth.ts), so a demotion takes effect on the next request without
 * signing the user out. Caveat: an address listed in ADMIN_EMAILS is promoted again on its next request
 * (bootstrap in lib/api/auth.ts); that list is empty in production.
 */
export async function changeUserRoleAsAdmin(
  ctx: AppContext,
  input: { adminUserId: string; userId: string; role: ManagedRole },
): Promise<UseCaseResult<{ changed: boolean; role: ManagedRole }, AppError>> {
  if (input.userId === input.adminUserId) return fail(new AdminSelfActionError('role'));
  return changeRoleLocked(ctx, { userId: input.userId, role: input.role, siteAdminId: input.adminUserId });
}

/**
 * The same role change from the separate admin panel (apps/admin): the actor is a panel account
 * (AdminUser, passkey + Cloudflare Access + fresh step-up checked by the action), not a site User row, so
 * there is no site-admin check; "never yourself" is the panel account's e-mail matching the target.
 * Same lock, last-admin rule, verified-e-mail rule and ADMIN_USER_ROLE_CHANGED audit.
 */
export async function changeUserRoleFromPanel(
  ctx: AppContext,
  input: { userId: string; role: ManagedRole; panelEmail: string },
): Promise<UseCaseResult<{ changed: boolean; role: ManagedRole }, AppError>> {
  const target = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  if (target && sameEmail(target.email, input.panelEmail)) return fail(new AdminSelfActionError('role'));
  return changeRoleLocked(ctx, { userId: input.userId, role: input.role, siteAdminId: null });
}

/** Account deletion from the admin panel: same rules and cleanup as deleteUserAsAdmin, self = same e-mail. */
export async function deleteUserFromPanel(
  ctx: AppContext,
  input: { userId: string; confirmEmail: string | null | undefined; panelEmail: string },
): Promise<UseCaseResult<{ deleted: true }, AppError>> {
  const target = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  if (target && sameEmail(target.email, input.panelEmail)) return fail(new AdminSelfActionError('delete'));
  return deleteUserAsAdmin(ctx, { adminUserId: '', userId: input.userId, confirmEmail: input.confirmEmail });
}

async function changeRoleLocked(
  ctx: AppContext,
  input: { userId: string; role: ManagedRole; siteAdminId: string | null },
): Promise<UseCaseResult<{ changed: boolean; role: ManagedRole }, AppError>> {
  type Outcome = { error: AppError } | { changed: boolean };
  const outcome = await ctx.db.writeTransaction(async (tx): Promise<Outcome> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ADMIN_ROSTER_LOCK}))`;

    // Re-read under the lock: another admin may have demoted the caller a moment ago.
    if (input.siteAdminId !== null) {
      const actor = await tx.user.findUnique({ where: { id: input.siteAdminId }, select: { role: true, isDeleted: true } });
      if (!actor || actor.isDeleted || actor.role !== 'ADMIN') return { error: new AdminActorNotAdminError() };
    }

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true, isDeleted: true, emailVerified: true },
    });
    if (!user) return { error: new UserNotFoundError(input.userId) };
    if (user.isDeleted) return { error: new UserAlreadyDeletedError() };
    if (user.role === input.role) return { changed: false };

    if (input.role === 'ADMIN' && !user.emailVerified) return { error: new AdminRequiresVerifiedEmailError() };
    if (input.role === 'USER') {
      const otherAdmins = await tx.user.count({ where: { role: 'ADMIN', isDeleted: false, id: { not: input.userId } } });
      if (otherAdmins === 0) return { error: new LastAdminError() };
    }

    await tx.user.update({ where: { id: input.userId }, data: { role: input.role } });
    await recordAuditEvent(ctx, {
      action: 'ADMIN_USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: input.userId,
      metadata: { previousRole: user.role, newRole: input.role },
    }, tx);
    return { changed: true };
  });

  if ('error' in outcome) return fail(outcome.error);
  return ok({ changed: outcome.changed, role: input.role });
}
