/** Admin account management: deleting another user and changing the ADMIN role (fail closed). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { changeUserRoleAsAdmin, changeUserRoleFromPanel, deleteUserAsAdmin, deleteUserFromPanel } from '@/lib/modules/users/application/admin-manage-user.use-case';
import { sendAccountDeletedEmail } from '@/lib/modules/email';

vi.mock('@/lib/modules/email/application/send-transactional-email.use-case', () => ({
  sendAccountDeletedEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailLanguage: (language: string | null | undefined) => (language === 'pl' ? 'pl' : 'en'),
}));

const ADMIN = 'admin-1';
const TARGET = 'user-1';

let prisma: any;
let users: Record<string, any>;

function ctx() {
  return createAppContext({ actor: { type: 'admin', userId: ADMIN }, prisma, now: () => new Date('2026-10-04T10:00:00.000Z') });
}

function auditActions() {
  return prisma.auditLog.create.mock.calls.map((call: any[]) => call[0].data);
}

beforeEach(() => {
  vi.clearAllMocks();
  users = {
    [ADMIN]: { id: ADMIN, email: 'admin@example.com', role: 'ADMIN', isDeleted: false, emailVerified: true, language: 'pl' },
    [TARGET]: { id: TARGET, email: 'Jan.Kowalski@Example.com', role: 'USER', isDeleted: false, emailVerified: true, language: 'pl' },
  };
  prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => users[where.id] ?? null),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn(async ({ where }: any) =>
        Object.values(users).filter((u: any) => u.role === where.role && !u.isDeleted && u.id !== where.id.not).length),
    },
    patronGrant: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    subscription: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn() },
    creator: { updateMany: vi.fn() },
    emailPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
    comment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    broadcastEmailRecipient: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    emailEvent: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    account: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    twoFactor: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    passkey: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    userAvatar: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn((fn: any) => fn(prisma)),
  };
});

describe('deleteUserAsAdmin', () => {
  it('runs the self-service cleanup and writes one ADMIN_USER_DELETED audit row with ids only', async () => {
    const result = await deleteUserAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, confirmEmail: '  jan.kowalski@example.COM ' });

    expect(result).toEqual({ ok: true, data: { deleted: true } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET } });
    expect(prisma.account.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET } });
    expect(prisma.twoFactor.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET } });
    const update = prisma.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: TARGET });
    expect(update.data).toMatchObject({ isDeleted: true, name: 'Usunięty Użytkownik', imageUrl: null });
    expect(update.data.email).toMatch(/^deleted_.*@deleted\.invalid$/);

    const audits = auditActions();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'ADMIN_USER_DELETED', actorUserId: ADMIN, actorType: 'admin', targetType: 'User', targetId: TARGET });
    expect(JSON.stringify(audits[0].metadata)).not.toContain('example.com');
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith('Jan.Kowalski@Example.com', 'pl');
  });

  it.each([
    ['yourself', { userId: ADMIN, confirmEmail: 'admin@example.com' }, 'SELF_ACTION_FORBIDDEN', 403],
    ['a missing user', { userId: 'nope', confirmEmail: 'x@example.com' }, 'USER_NOT_FOUND', 404],
    ['a wrong confirmation e-mail', { userId: TARGET, confirmEmail: 'someone@example.com' }, 'CONFIRM_EMAIL_MISMATCH', 400],
    ['no confirmation e-mail', { userId: TARGET, confirmEmail: undefined }, 'CONFIRM_EMAIL_MISMATCH', 400],
  ])('refuses %s without touching data', async (_label, input, code, status) => {
    const result = await deleteUserAsAdmin(ctx(), { adminUserId: ADMIN, ...input });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code, statusCode: status });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses an administrator (demote first), so the last admin can never be deleted either', async () => {
    users[TARGET].role = 'ADMIN';
    const result = await deleteUserAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, confirmEmail: users[TARGET].email });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'TARGET_IS_ADMIN', statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('answers 409 for an already deleted account', async () => {
    users[TARGET] = { ...users[TARGET], isDeleted: true, email: 'deleted_abc@deleted.com' };
    const result = await deleteUserAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, confirmEmail: 'deleted_abc@deleted.com' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'USER_ALREADY_DELETED', statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('changeUserRoleAsAdmin', () => {
  it('promotes a verified user under the admin-roster lock and audits old and new role only', async () => {
    const result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, role: 'ADMIN' });

    expect(result).toEqual({ ok: true, data: { changed: true, role: 'ADMIN' } });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: TARGET }, data: { role: 'ADMIN' } });
    expect(auditActions()).toEqual([
      expect.objectContaining({
        action: 'ADMIN_USER_ROLE_CHANGED',
        actorUserId: ADMIN,
        targetId: TARGET,
        metadata: { previousRole: 'USER', newRole: 'ADMIN' },
      }),
    ]);
  });

  it('demotes an admin while another admin remains', async () => {
    users[TARGET].role = 'ADMIN';
    const result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, role: 'USER' });

    expect(result).toEqual({ ok: true, data: { changed: true, role: 'USER' } });
    expect(auditActions()[0].metadata).toEqual({ previousRole: 'ADMIN', newRole: 'USER' });
  });

  it('refuses to change your own role before opening a transaction', async () => {
    const result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: ADMIN, role: 'USER' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'SELF_ACTION_FORBIDDEN', statusCode: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to remove the last administrator (checked under the lock)', async () => {
    users[TARGET].role = 'ADMIN';
    // No other active admin besides the target (defensive: the caller check above normally keeps one).
    prisma.user.count.mockResolvedValueOnce(0);

    const result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, role: 'USER' });

    expect(prisma.user.count).toHaveBeenCalledWith({ where: { role: 'ADMIN', isDeleted: false, id: { not: TARGET } } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'LAST_ADMIN', statusCode: 409 });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses when the caller lost the ADMIN role in the meantime', async () => {
    users[ADMIN].role = 'USER';
    const result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, role: 'ADMIN' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a deleted account and an unverified e-mail', async () => {
    users[TARGET].isDeleted = true;
    let result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, role: 'ADMIN' });
    if (!result.ok) expect(result.error).toMatchObject({ code: 'USER_ALREADY_DELETED', statusCode: 409 });
    expect(result.ok).toBe(false);

    users[TARGET].isDeleted = false;
    users[TARGET].emailVerified = false;
    result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, role: 'ADMIN' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'EMAIL_NOT_VERIFIED', statusCode: 409 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('is a no-op (no write, no audit) when the role is already set', async () => {
    const result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: TARGET, role: 'USER' });

    expect(result).toEqual({ ok: true, data: { changed: false, role: 'USER' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing user', async () => {
    const result = await changeUserRoleAsAdmin(ctx(), { adminUserId: ADMIN, userId: 'nope', role: 'ADMIN' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });
});

describe('from the admin panel (apps/admin): the actor is a panel account, not a site user', () => {
  function panelCtx() {
    return createAppContext({ actor: { type: 'admin', userId: 'panel-account-1' }, prisma, now: () => new Date('2026-10-04T10:00:00.000Z') });
  }

  it('changes a role without a site-admin row for the actor, with the same lock and audit', async () => {
    const result = await changeUserRoleFromPanel(panelCtx(), { userId: TARGET, role: 'ADMIN', panelEmail: 'owner@panel.example' });
    expect(result).toEqual({ ok: true, data: { changed: true, role: 'ADMIN' } });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(auditActions()).toEqual([expect.objectContaining({ action: 'ADMIN_USER_ROLE_CHANGED', targetId: TARGET })]);
  });

  it('never acts on the account with the panel owner e-mail (yourself)', async () => {
    const role = await changeUserRoleFromPanel(panelCtx(), { userId: TARGET, role: 'ADMIN', panelEmail: 'jan.kowalski@example.com' });
    const del = await deleteUserFromPanel(panelCtx(), { userId: TARGET, confirmEmail: 'jan.kowalski@example.com', panelEmail: 'JAN.KOWALSKI@example.com' });
    expect(role.ok).toBe(false);
    expect(del.ok).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps the last-admin rule', async () => {
    const result = await changeUserRoleFromPanel(panelCtx(), { userId: ADMIN, role: 'USER', panelEmail: 'owner@panel.example' });
    expect(result.ok).toBe(false);
  });

  it('deletes with the typed e-mail and refuses a mismatch', async () => {
    expect((await deleteUserFromPanel(panelCtx(), { userId: TARGET, confirmEmail: 'x@example.com', panelEmail: 'owner@panel.example' })).ok).toBe(false);
    expect(await deleteUserFromPanel(panelCtx(), { userId: TARGET, confirmEmail: 'jan.kowalski@example.com', panelEmail: 'owner@panel.example' })).toEqual({ ok: true, data: { deleted: true } });
  });
});
