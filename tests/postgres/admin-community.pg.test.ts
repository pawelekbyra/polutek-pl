/**
 * Panel "Społeczność" on a real Postgres (CI job "integration-postgres", after `prisma migrate deploy`):
 * bulk moderation is atomic in the database (a stale row rolls the whole batch back), reports close and reopen
 * with their comments, undo refuses to overwrite a newer decision, the comment mute column exists, and the
 * users list segments/export run real queries. NOT run in the agent sandbox (no local Postgres).
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts tests/postgres/admin-community.pg.test.ts
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { moderateCommentsBulk, undoCommentModeration } from '@/lib/modules/comments';
import { muteUserCommenting, revokeUserSessions } from '@/lib/modules/users';
import { exportUsersCsv, listPanelUsers } from '@/lib/modules/admin-community';

const prisma = new PrismaClient();
const RUN = `pg-comm-${Date.now().toString(36)}`;
const ctx = () => createAppContext({ actor: { type: 'admin', userId: `${RUN}-panel` }, prisma });
const ids = { owner: `${RUN}-owner`, author: `${RUN}-author`, video: '', creator: '', c1: '', c2: '', c3: '', report: '' };

beforeAll(async () => {
  await prisma.user.create({ data: { id: ids.owner, email: `${RUN}-owner@example.test`, name: `${RUN} owner` } });
  await prisma.user.create({ data: { id: ids.author, email: `${RUN}-author@example.test`, name: `=${RUN} author` } });
  const creator = await prisma.creator.create({ data: { userId: ids.owner, slug: `${RUN}-ch`, name: 'PG community' } });
  const video = await prisma.video.create({ data: { creatorId: creator.id, title: 'PG community', slug: `${RUN}-v`, thumbnailUrl: '/logo.png' } });
  ids.creator = creator.id;
  ids.video = video.id;
  const mk = (text: string, status: 'VISIBLE' | 'HELD_FOR_REVIEW' | 'DELETED') => prisma.comment.create({ data: { authorId: ids.author, videoId: video.id, creatorId: creator.id, text, status } });
  ids.c1 = (await mk('one', 'VISIBLE')).id;
  ids.c2 = (await mk('two', 'HELD_FOR_REVIEW')).id;
  ids.c3 = (await mk('three', 'DELETED')).id;
  const report = await prisma.commentReport.create({ data: { commentId: ids.c1, reporterId: ids.owner, reason: 'SPAM' } });
  ids.report = report.id;
  await prisma.comment.update({ where: { id: ids.c1 }, data: { reportsCount: 1 } });
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId: ids.author } });
  await prisma.comment.deleteMany({ where: { videoId: ids.video } });
  // AuditLog is immutable (rows younger than 400 days cannot be deleted); the rows are scoped by the unique RUN prefix, so leaving them is safe.
  await prisma.video.deleteMany({ where: { id: ids.video } });
  await prisma.creator.deleteMany({ where: { id: ids.creator } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.author] } } });
  await prisma.$disconnect();
});

describe('bulk moderation on Postgres', () => {
  it('rolls the whole batch back when one comment cannot take the action', async () => {
    const r = await moderateCommentsBulk(ctx(), { ids: [ids.c1, ids.c3], action: 'hide' });
    expect(r.ok).toBe(false);
    expect((await prisma.comment.findUnique({ where: { id: ids.c1 } }))!.status).toBe('VISIBLE');
  });

  it('hides, closes the report, then undo restores both; a second undo conflicts', async () => {
    const done = await moderateCommentsBulk(ctx(), { ids: [ids.c1, ids.c2], action: 'hide', reports: 'action' });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect((await prisma.commentReport.findUnique({ where: { id: ids.report } }))!.status).toBe('ACTION_TAKEN');
    expect((await prisma.comment.findUnique({ where: { id: ids.c1 } }))!.reportsCount).toBe(0);
    const undo = await undoCommentModeration(ctx(), { changes: done.data.changed, reports: done.data.resolvedReports });
    expect(undo.ok).toBe(true);
    expect((await prisma.comment.findUnique({ where: { id: ids.c2 } }))!.status).toBe('HELD_FOR_REVIEW');
    expect((await prisma.commentReport.findUnique({ where: { id: ids.report } }))!.status).toBe('PENDING');
    expect((await prisma.comment.findUnique({ where: { id: ids.c1 } }))!.reportsCount).toBe(1);
    expect((await undoCommentModeration(ctx(), { changes: done.data.changed, reports: [] })).ok).toBe(false);
    expect(await prisma.auditLog.count({ where: { actorUserId: `${RUN}-panel`, action: 'COMMENT_MODERATION_UNDONE' } })).toBeGreaterThan(0);
  });
});

describe('people on Postgres', () => {
  it('mutes (new columns exist), signs out and audits', async () => {
    expect((await muteUserCommenting(ctx(), { userId: ids.author, days: 1, reason: 'test' })).ok).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: ids.author } }))!.commentMutedUntil).not.toBeNull();
    await prisma.session.create({ data: { id: `${RUN}-s`, token: `${RUN}-t`, userId: ids.author, expiresAt: new Date(Date.now() + 3600_000) } });
    expect(await revokeUserSessions(ctx(), { userId: ids.author })).toEqual({ ok: true, data: { revoked: 1 } });
  });

  it('lists, filters by segment and exports with hostile nicknames neutralised', async () => {
    const list = await listPanelUsers(ctx(), { q: RUN, seg: 'wyciszeni' });
    expect(list.ok && list.data.items.map((u) => u.id)).toEqual([ids.author]);
    const csv = await exportUsersCsv(ctx(), { q: RUN });
    expect(csv.ok && csv.data.csv).toContain(`"'=${RUN} author"`);
    expect(await prisma.auditLog.count({ where: { actorUserId: `${RUN}-panel`, action: 'USERS_EXPORT' } })).toBe(1);
  });
});
