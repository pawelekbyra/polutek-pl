/** Bulk moderation, undo, creator reply and heart: atomicity, idempotency, audit, authorization. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { BULK_MODERATION_LIMIT, createCreatorReply, moderateCommentsBulk, setAdminCommentHeart, undoCommentModeration } from '@/lib/modules/comments';

type Row = { id: string; status: string; isHearted?: boolean };
let comments: Row[];
let reports: { id: string; commentId: string; status: string; resolvedById: string | null }[];
let prisma: any;
let audits: any[];
const NOW = new Date('2026-10-05T10:00:00.000Z');

function ctx(actor: any = { type: 'admin', userId: 'panel-1' }) {
  return createAppContext({ actor, prisma, now: () => NOW });
}

beforeEach(() => {
  comments = [
    { id: 'c1', status: 'VISIBLE' },
    { id: 'c2', status: 'HELD_FOR_REVIEW' },
    { id: 'c3', status: 'HIDDEN' },
    { id: 'c4', status: 'DELETED' },
  ];
  reports = [
    { id: 'r1', commentId: 'c1', status: 'PENDING', resolvedById: null },
    { id: 'r2', commentId: 'c1', status: 'PENDING', resolvedById: null },
  ];
  audits = [];
  prisma = {
    comment: {
      findMany: vi.fn(async ({ where }: any) => comments.filter((c) => where.id.in.includes(c.id))),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const hit = comments.filter((c) => where.id.in.includes(c.id) && c.status === where.status);
        hit.forEach((c) => Object.assign(c, data));
        return { count: hit.length };
      }),
      update: vi.fn(async () => ({})),
    },
    commentReport: {
      findMany: vi.fn(async ({ where }: any) => reports.filter((r) => (where.commentId ? where.commentId.in.includes(r.commentId) && r.status === where.status : where.id.in.includes(r.id) && r.status !== 'PENDING' && r.resolvedById === where.resolvedById))),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const hit = reports.filter((r) => where.id.in.includes(r.id) && (where.status === 'PENDING' ? r.status === 'PENDING' : true));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
      count: vi.fn(async ({ where }: any) => reports.filter((r) => r.commentId === where.commentId && r.status === where.status).length),
    },
    auditLog: { create: vi.fn(async ({ data }: any) => audits.push(data)) },
    $transaction: vi.fn(async (fn: any) => {
      const snapshot = JSON.stringify({ comments, reports });
      try {
        return await fn(prisma);
      } catch (e) {
        ({ comments, reports } = JSON.parse(snapshot));
        throw e;
      }
    }),
  };
});

describe('moderateCommentsBulk', () => {
  it('hides several comments in one transaction and writes one audit row each', async () => {
    const r = await moderateCommentsBulk(ctx(), { ids: ['c1', 'c2', 'c3'], action: 'hide' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.changed.map((c) => [c.commentId, c.from, c.to])).toEqual([['c1', 'VISIBLE', 'HIDDEN'], ['c2', 'HELD_FOR_REVIEW', 'HIDDEN']]);
    expect(r.data.unchanged).toEqual(['c3']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audits.filter((a) => a.action === 'COMMENT_HIDE').map((a) => a.targetId)).toEqual(['c1', 'c2']);
    expect(audits[0]).toMatchObject({ actorUserId: 'panel-1', actorType: 'admin', targetType: 'COMMENT' });
    expect(audits[0].metadata).toMatchObject({ from: 'VISIBLE', to: 'HIDDEN', bulk: true, batchId: r.data.batchId });
  });

  it('is all or nothing: one deleted comment in the selection rejects the whole batch and changes nothing', async () => {
    const r = await moderateCommentsBulk(ctx(), { ids: ['c1', 'c4'], action: 'hide' });
    expect(r).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
    expect(comments.find((c) => c.id === 'c1')!.status).toBe('VISIBLE');
    expect(audits).toHaveLength(0);
  });

  it('rolls back when a concurrent change makes an update match fewer rows than expected', async () => {
    prisma.comment.updateMany.mockImplementationOnce(async () => ({ count: 0 }));
    const r = await moderateCommentsBulk(ctx(), { ids: ['c1'], action: 'hide' });
    expect(r).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
    expect(audits).toHaveLength(0);
  });

  it('rejects a missing comment, an empty or oversized selection, and non-admins; duplicates count once', async () => {
    expect(await moderateCommentsBulk(ctx(), { ids: ['c1', 'nope'], action: 'hide' })).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
    expect(await moderateCommentsBulk(ctx(), { ids: [], action: 'hide' })).toMatchObject({ ok: false, error: { type: 'VALIDATION_ERROR' } });
    const many = Array.from({ length: BULK_MODERATION_LIMIT + 1 }, (_, i) => `x${i}`);
    expect(await moderateCommentsBulk(ctx(), { ids: many, action: 'hide' })).toMatchObject({ ok: false, error: { type: 'VALIDATION_ERROR' } });
    expect(await moderateCommentsBulk(ctx({ type: 'user', userId: 'u' }), { ids: ['c1'], action: 'hide' })).toMatchObject({ ok: false, error: { type: 'UNAUTHORIZED' } });
    const dup = await moderateCommentsBulk(ctx(), { ids: ['c1', 'c1'], action: 'hide' });
    expect(dup.ok && dup.data.changed).toHaveLength(1);
  });

  it('is idempotent: repeating the same request changes nothing and writes no audit', async () => {
    await moderateCommentsBulk(ctx(), { ids: ['c1'], action: 'hide', reports: 'action' });
    audits.length = 0;
    const again = await moderateCommentsBulk(ctx(), { ids: ['c1'], action: 'hide', reports: 'action' });
    expect(again.ok && again.data).toMatchObject({ changed: [], unchanged: ['c1'], resolvedReports: [] });
    expect(audits).toHaveLength(0);
  });

  it('closes the pending reports in the same transaction (upheld on hide, dismissed on keep) and zeroes the counter', async () => {
    const r = await moderateCommentsBulk(ctx(), { ids: ['c1'], action: 'hide', reports: 'action' });
    expect(r.ok && r.data.resolvedReports.map((x) => x.id).sort()).toEqual(['r1', 'r2']);
    expect(reports.every((x) => x.status === 'ACTION_TAKEN' && x.resolvedById === 'panel-1')).toBe(true);
    expect(prisma.comment.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['c1'] } }, data: { reportsCount: 0 } });
    expect(audits.find((a) => a.action === 'REPORT_ACTION_TAKEN')!.metadata.reportIds.sort()).toEqual(['r1', 'r2']);
  });

  it('"keep" approves a held comment, leaves others alone, and dismisses reports', async () => {
    const r = await moderateCommentsBulk(ctx(), { ids: ['c1', 'c2'], action: 'keep', reports: 'dismiss' });
    expect(r.ok && r.data.changed).toEqual([{ commentId: 'c2', from: 'HELD_FOR_REVIEW', to: 'VISIBLE' }]);
    expect(r.ok && r.data.unchanged).toEqual(['c1']);
    expect(reports.every((x) => x.status === 'DISMISSED')).toBe(true);
    expect(audits.map((a) => a.action).sort()).toEqual(['COMMENT_APPROVE', 'REPORT_DISMISSED']);
  });

  it('delete is final: sets MODERATOR_DELETED and audits the reason', async () => {
    const r = await moderateCommentsBulk(ctx(), { ids: ['c1', 'c3'], action: 'delete' });
    expect(r.ok).toBe(true);
    expect(comments.filter((c) => c.status === 'DELETED').map((c) => c.id)).toEqual(['c1', 'c3', 'c4']);
    expect(audits.filter((a) => a.action === 'COMMENT_DELETE')).toHaveLength(2);
    expect(audits[0].metadata.reason).toBe('MODERATOR_DELETED');
  });
});

describe('undoCommentModeration', () => {
  it('restores statuses and reopens the reports the decision closed', async () => {
    const done = await moderateCommentsBulk(ctx(), { ids: ['c1'], action: 'hide', reports: 'action' });
    if (!done.ok) throw new Error('setup');
    audits.length = 0;
    const u = await undoCommentModeration(ctx(), { changes: done.data.changed, reports: done.data.resolvedReports });
    expect(u).toEqual({ ok: true, data: { restored: 1, reopened: 2 } });
    expect(comments[0].status).toBe('VISIBLE');
    expect(reports.every((r) => r.status === 'PENDING' && r.resolvedById === null)).toBe(true);
    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { reportsCount: 2 } });
    expect(audits[0]).toMatchObject({ action: 'COMMENT_MODERATION_UNDONE', targetId: 'c1' });
  });

  it('refuses (and changes nothing) when the comment was moderated again in the meantime', async () => {
    const done = await moderateCommentsBulk(ctx(), { ids: ['c1'], action: 'hide' });
    if (!done.ok) throw new Error('setup');
    comments[0].status = 'DELETED';
    const u = await undoCommentModeration(ctx(), { changes: done.data.changed, reports: [] });
    expect(u).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
    expect(comments[0].status).toBe('DELETED');
  });

  it('never undoes into or out of DELETED and rejects malformed input', async () => {
    expect(await undoCommentModeration(ctx(), { changes: [{ commentId: 'c1', from: 'DELETED' as any, to: 'HIDDEN' }], reports: [] })).toMatchObject({ ok: false, error: { type: 'VALIDATION_ERROR' } });
    expect(await undoCommentModeration(ctx(), { changes: [{ commentId: 'c1', from: 'VISIBLE', to: 'DELETED' as any }], reports: [] })).toMatchObject({ ok: false, error: { type: 'VALIDATION_ERROR' } });
    expect(await undoCommentModeration(ctx(), { changes: [{ commentId: 'c1', from: 'VISIBLE', to: 'VISIBLE' }], reports: [] })).toMatchObject({ ok: false });
    expect(await undoCommentModeration(ctx({ type: 'guest' }), { changes: [], reports: [] })).toMatchObject({ ok: false, error: { type: 'UNAUTHORIZED' } });
  });

  it('does not reopen reports closed by someone else', async () => {
    reports[0] = { ...reports[0], status: 'DISMISSED', resolvedById: 'other' };
    const u = await undoCommentModeration(ctx(), { changes: [], reports: [{ id: 'r1', commentId: 'c1' }] });
    expect(u).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
    expect(reports[0].status).toBe('DISMISSED');
  });
});

describe('createCreatorReply', () => {
  const target = { id: 'c1', status: 'VISIBLE', parentId: null, videoId: 'v1', isHearted: false, author: { isDeleted: false }, video: { creatorId: 'ch1', creator: { userId: 'owner' } } };
  let created: any[];
  beforeEach(() => {
    created = [];
    prisma.comment.findUnique = vi.fn(async ({ where }: any) => (where.id === 'c1' ? target : where.id === 'root' ? { id: 'root', status: 'VISIBLE' } : null));
    prisma.comment.findFirst = vi.fn(async () => null);
    prisma.comment.create = vi.fn(async ({ data }: any) => (created.push(data), { id: 'new1' }));
  });

  it('writes the reply as the channel owner, optionally hearts the comment, audits in the same transaction', async () => {
    const r = await createCreatorReply(ctx(), { commentId: 'c1', text: '  Dzięki!  ', heart: true });
    expect(r).toEqual({ ok: true, data: { id: 'new1', parentId: 'c1', duplicate: false } });
    expect(created[0]).toMatchObject({ authorId: 'owner', creatorId: 'ch1', parentId: 'c1', text: 'Dzięki!', status: 'VISIBLE' });
    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { isHearted: true } });
    expect(audits[0]).toMatchObject({ action: 'COMMENT_CREATOR_REPLY', targetId: 'new1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: the same text in the same thread within a minute returns the existing reply', async () => {
    prisma.comment.findFirst = vi.fn(async () => ({ id: 'old1' }));
    const r = await createCreatorReply(ctx(), { commentId: 'c1', text: 'Dzięki!' });
    expect(r).toEqual({ ok: true, data: { id: 'old1', parentId: 'c1', duplicate: true } });
    expect(prisma.comment.create).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);
  });

  it('answers a reply inside the thread of its root, refuses hidden targets, empty or too long text, non-admins', async () => {
    prisma.comment.findUnique = vi.fn(async ({ where }: any) => (where.id === 'c1' ? { ...target, parentId: 'root' } : where.id === 'root' ? { id: 'root', status: 'VISIBLE' } : null));
    const nested = await createCreatorReply(ctx(), { commentId: 'c1', text: 'ok' });
    expect(nested.ok && nested.data.parentId).toBe('root');
    prisma.comment.findUnique = vi.fn(async () => ({ ...target, status: 'HIDDEN' }));
    expect(await createCreatorReply(ctx(), { commentId: 'c1', text: 'ok' })).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
    expect(await createCreatorReply(ctx(), { commentId: 'c1', text: '   ' })).toMatchObject({ ok: false, error: { type: 'VALIDATION_ERROR' } });
    expect(await createCreatorReply(ctx(), { commentId: 'c1', text: 'x'.repeat(2001) })).toMatchObject({ ok: false, error: { type: 'VALIDATION_ERROR' } });
    expect(await createCreatorReply(ctx({ type: 'user', userId: 'u' }), { commentId: 'c1', text: 'ok' })).toMatchObject({ ok: false, error: { type: 'UNAUTHORIZED' } });
  });

  it('refuses when the film has no channel owner account', async () => {
    prisma.comment.findUnique = vi.fn(async () => ({ ...target, video: { creatorId: 'ch1', creator: null } }));
    expect(await createCreatorReply(ctx(), { commentId: 'c1', text: 'ok' })).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
  });
});

describe('setAdminCommentHeart', () => {
  beforeEach(() => {
    prisma.comment.findUnique = vi.fn(async ({ where }: any) => comments.find((c) => c.id === where.id) ?? null);
  });
  it('sets an explicit state and is a no-op when already there', async () => {
    comments[0].isHearted = false;
    expect(await setAdminCommentHeart(ctx(), { commentId: 'c1', hearted: true })).toEqual({ ok: true, data: { isHearted: true, changed: true } });
    expect(audits[0]).toMatchObject({ action: 'COMMENT_HEART' });
    comments[0].isHearted = true;
    audits.length = 0;
    expect(await setAdminCommentHeart(ctx(), { commentId: 'c1', hearted: true })).toEqual({ ok: true, data: { isHearted: true, changed: false } });
    expect(audits).toHaveLength(0);
  });
  it('refuses a deleted comment and non-admins', async () => {
    expect(await setAdminCommentHeart(ctx(), { commentId: 'c4', hearted: true })).toMatchObject({ ok: false, error: { type: 'CONFLICT' } });
    expect(await setAdminCommentHeart(ctx({ type: 'guest' }), { commentId: 'c1', hearted: true })).toMatchObject({ ok: false, error: { type: 'UNAUTHORIZED' } });
  });
});
