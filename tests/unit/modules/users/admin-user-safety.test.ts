/** Mute commenting, unmute, sign out (one / all sessions): validation, audit before/after, fail closed. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { muteUserCommenting, revokeUserSessions, unmuteUserCommenting } from '@/lib/modules/users';

const NOW = new Date('2026-10-05T10:00:00.000Z');
let user: any;
let sessions: { id: string; userId: string }[];
let audits: any[];
let prisma: any;
const ctx = (actor: any = { type: 'admin', userId: 'panel-1' }) => createAppContext({ actor, prisma, now: () => NOW });

beforeEach(() => {
  user = { id: 'u1', role: 'USER', isDeleted: false, commentMutedUntil: null };
  sessions = [{ id: 's1', userId: 'u1' }, { id: 's2', userId: 'u1' }, { id: 's3', userId: 'other' }];
  audits = [];
  prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === 'u1' ? { ...user } : null)),
      update: vi.fn(async ({ data }: any) => Object.assign(user, data)),
    },
    session: {
      deleteMany: vi.fn(async ({ where }: any) => {
        const hit = sessions.filter((s) => s.userId === where.userId && (!where.id || s.id === where.id));
        sessions = sessions.filter((s) => !hit.includes(s));
        return { count: hit.length };
      }),
    },
    auditLog: { create: vi.fn(async ({ data }: any) => audits.push(data)) },
    $transaction: vi.fn((fn: any) => fn(prisma)),
  };
});

describe('muteUserCommenting', () => {
  it('mutes for N days with the reason and audits before and after', async () => {
    const r = await muteUserCommenting(ctx(), { userId: 'u1', days: 7, reason: '  spam pod filmami ' });
    expect(r.ok && r.data.mutedUntil.toISOString()).toBe('2026-10-12T10:00:00.000Z');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { commentMutedUntil: new Date('2026-10-12T10:00:00.000Z'), commentMuteReason: 'spam pod filmami' } });
    expect(audits[0]).toMatchObject({ action: 'ADMIN_USER_COMMENT_MUTED', targetId: 'u1', actorUserId: 'panel-1', actorType: 'admin' });
    expect(audits[0].metadata).toMatchObject({ reason: 'spam pod filmami', days: 7, before: null, after: '2026-10-12T10:00:00.000Z' });
  });

  it.each([
    ['unknown length', { days: 3, reason: 'powód' }],
    ['short reason', { days: 7, reason: 'x' }],
    ['long reason', { days: 7, reason: 'x'.repeat(301) }],
  ])('rejects %s without touching data', async (_l, input) => {
    expect(await muteUserCommenting(ctx(), { userId: 'u1', ...input })).toMatchObject({ ok: false, error: { code: 'INVALID_MODERATION_INPUT' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses admins, deleted and missing accounts and non-admin actors', async () => {
    user.role = 'ADMIN';
    expect(await muteUserCommenting(ctx(), { userId: 'u1', days: 1, reason: 'powód' })).toMatchObject({ ok: false, error: { code: 'TARGET_IS_ADMIN' } });
    user.role = 'USER';
    user.isDeleted = true;
    expect(await muteUserCommenting(ctx(), { userId: 'u1', days: 1, reason: 'powód' })).toMatchObject({ ok: false, error: { code: 'USER_ALREADY_DELETED' } });
    expect(await muteUserCommenting(ctx(), { userId: 'nope', days: 1, reason: 'powód' })).toMatchObject({ ok: false, error: { code: 'USER_NOT_FOUND' } });
    expect(await muteUserCommenting(ctx({ type: 'user', userId: 'u1' }), { userId: 'u1', days: 1, reason: 'powód' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(audits).toHaveLength(0);
  });
});

describe('unmuteUserCommenting', () => {
  it('lifts the mute once; a second call is a no-op with no audit row', async () => {
    user.commentMutedUntil = new Date('2026-10-09T10:00:00.000Z');
    expect(await unmuteUserCommenting(ctx(), { userId: 'u1' })).toEqual({ ok: true, data: { changed: true } });
    expect(audits[0]).toMatchObject({ action: 'ADMIN_USER_COMMENT_UNMUTED' });
    expect(user.commentMutedUntil).toBeNull();
    audits.length = 0;
    expect(await unmuteUserCommenting(ctx(), { userId: 'u1' })).toEqual({ ok: true, data: { changed: false } });
    expect(audits).toHaveLength(0);
  });
});

describe('revokeUserSessions', () => {
  it('signs the person out of every session, only theirs, with one audit row', async () => {
    expect(await revokeUserSessions(ctx(), { userId: 'u1' })).toEqual({ ok: true, data: { revoked: 2 } });
    expect(sessions.map((s) => s.id)).toEqual(['s3']);
    expect(audits[0]).toMatchObject({ action: 'ADMIN_USER_SESSIONS_REVOKED', metadata: { scope: 'all', count: 2 } });
  });
  it('ends one session; a session of another user is "not found" and untouched', async () => {
    expect(await revokeUserSessions(ctx(), { userId: 'u1', sessionId: 's1' })).toEqual({ ok: true, data: { revoked: 1 } });
    expect(await revokeUserSessions(ctx(), { userId: 'u1', sessionId: 's3' })).toMatchObject({ ok: false, error: { code: 'SESSION_NOT_FOUND' } });
    expect(sessions.some((s) => s.id === 's3')).toBe(true);
  });
  it('zero sessions is a no-op without audit; non-admins are refused', async () => {
    sessions = [];
    expect(await revokeUserSessions(ctx(), { userId: 'u1' })).toEqual({ ok: true, data: { revoked: 0 } });
    expect(audits).toHaveLength(0);
    expect(await revokeUserSessions(ctx({ type: 'guest' }), { userId: 'u1' })).toMatchObject({ ok: false });
  });
});
