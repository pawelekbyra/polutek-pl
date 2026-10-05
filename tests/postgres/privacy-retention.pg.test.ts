/**
 * Account deletion and the retention jobs on a real Postgres (CI job "integration-postgres", after
 * `prisma migrate deploy`): real rows, real foreign keys, the new ResendContactRemoval table and the
 * User Terms columns. RESEND_AUDIENCE_ID is not set in CI, so contact removals settle as NOT_CONFIGURED.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts
 */
import { BroadcastRecipientStatus, CommentDeletedReason, CommentStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/modules/email', () => ({
  sendAccountDeletedEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailLanguage: () => 'en',
}));

import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccountDeletionCleanupUseCase } from '@/lib/modules/users/application/account-deletion-cleanup.use-case';
import { recordTermsAcceptance } from '@/lib/modules/users/application/record-terms-acceptance.use-case';
import { anonymizeOldTechnicalData } from '@/lib/modules/privacy';
import { pruneExpiredAuthRecords } from '@/lib/auth/prune-expired';
import { LEGAL_DOCUMENTS_VERSION } from '@/lib/legal/version';

const prisma = new PrismaClient();
const RUN = `pg-priv-${Date.now().toString(36)}`;
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ctx = () => createAppContext({ actor: { type: 'system', reason: 'pg-test' }, prisma });

const ids = { deleter: `${RUN}-deleter`, other: `${RUN}-other`, video: '', creator: '', broadcast: '' };
const email = { deleter: `${RUN}-deleter@example.test`, other: `${RUN}-other@example.test` };

beforeAll(async () => {
  await prisma.user.create({ data: { id: ids.deleter, email: email.deleter, name: `${RUN} deleter` } });
  await prisma.user.create({ data: { id: ids.other, email: email.other, name: `${RUN} other` } });
  const creator = await prisma.creator.create({ data: { userId: ids.other, slug: `${RUN}-creator`, name: 'PG privacy' } });
  const video = await prisma.video.create({ data: { creatorId: creator.id, title: 'PG privacy', slug: `${RUN}-video`, thumbnailUrl: '/logo.png', views: 7 } });
  ids.creator = creator.id;
  ids.video = video.id;
  const broadcast = await prisma.broadcastEmail.create({ data: { subjectPl: 's', htmlPl: 'h', subjectEn: 's', htmlEn: 'h' } });
  ids.broadcast = broadcast.id;
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { userId: { in: [ids.deleter, ids.other] } } });
  await prisma.comment.deleteMany({ where: { videoId: ids.video, parentId: { not: null } } });
  await prisma.comment.deleteMany({ where: { videoId: ids.video } });
  await prisma.videoView.deleteMany({ where: { videoId: ids.video } });
  await prisma.videoPlaybackSession.deleteMany({ where: { videoId: ids.video } });
  await prisma.emailEvent.deleteMany({ where: { providerEventId: { startsWith: RUN } } });
  await prisma.broadcastEmail.deleteMany({ where: { id: ids.broadcast } });
  // AuditLog rows are tamper-resistant (migration 20261005200000: no DELETE of rows younger than 400 days), so the
  // test's audit rows stay in the throwaway CI database; they are unique per run (action starts with RUN).
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: RUN } } });
  await prisma.resendContactRemoval.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.video.deleteMany({ where: { id: ids.video } });
  await prisma.creator.deleteMany({ where: { id: ids.creator } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.deleter, ids.other] } } });
  await prisma.$disconnect();
});

describe('account deletion on Postgres', () => {
  it('erases comment content, anonymizes e-mail history, drops consent, keeps payments and thread structure', async () => {
    const mine = await prisma.comment.create({ data: { authorId: ids.deleter, videoId: ids.video, text: 'my words', imageUrl: 'https://img.example/x.png' } });
    const hidden = await prisma.comment.create({ data: { authorId: ids.deleter, videoId: ids.video, text: 'hidden words', status: CommentStatus.HIDDEN } });
    const reply = await prisma.comment.create({ data: { authorId: ids.other, videoId: ids.video, text: 'a reply', parentId: mine.id } });
    await prisma.emailPreference.create({ data: { userId: ids.deleter, email: email.deleter, marketingEmails: true } });
    await prisma.broadcastEmailRecipient.createMany({
      data: [
        { broadcastEmailId: ids.broadcast, userId: ids.deleter, email: email.deleter, status: BroadcastRecipientStatus.SENT },
        { broadcastEmailId: ids.broadcast, userId: ids.deleter, email: email.deleter, status: BroadcastRecipientStatus.PENDING },
      ],
    });
    await prisma.emailEvent.create({ data: { type: 'email.delivered', providerEventId: `${RUN}-ev1`, email: email.deleter, payload: { to: [email.deleter] } } });
    const payment = await prisma.payment.create({ data: { userId: ids.deleter, amountMinor: 1000, currency: 'PLN', status: 'SUCCEEDED' } });

    const result = await AccountDeletionCleanupUseCase.execute(ctx(), { userId: ids.deleter, source: 'APP_ACCOUNT_DELETION' });
    expect(result).toMatchObject({ cleaned: true, originalEmail: email.deleter });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.deleter } });
    expect(user.isDeleted).toBe(true);
    expect(user.email).toMatch(/^deleted_.*@deleted\.invalid$/);

    const comments = await prisma.comment.findMany({ where: { id: { in: [mine.id, hidden.id, reply.id] } } });
    const byId = Object.fromEntries(comments.map((c) => [c.id, c]));
    for (const id of [mine.id, hidden.id]) {
      expect(byId[id]).toMatchObject({ text: '', imageUrl: null, status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.AUTHOR_DELETED });
    }
    // Someone else's reply keeps its text and its place in the thread.
    expect(byId[reply.id]).toMatchObject({ text: 'a reply', status: CommentStatus.VISIBLE, parentId: mine.id });

    const recipients = await prisma.broadcastEmailRecipient.findMany({ where: { broadcastEmailId: ids.broadcast, userId: ids.deleter } });
    expect(recipients.every((r) => r.email === user.email)).toBe(true);
    expect(recipients.map((r) => r.status).sort()).toEqual([BroadcastRecipientStatus.SENT, BroadcastRecipientStatus.SKIPPED]);

    const event = await prisma.emailEvent.findUniqueOrThrow({ where: { providerEventId: `${RUN}-ev1` } });
    expect(event.email).toBeNull();
    expect(JSON.stringify(event.payload)).not.toContain(email.deleter);

    expect(await prisma.emailPreference.count({ where: { email: email.deleter } })).toBe(0);
    // No audience configured in CI: the queued removal settles right away and leaves nothing behind.
    expect(await prisma.resendContactRemoval.count({ where: { email: email.deleter } })).toBe(0);
    // Payments stay (tax records).
    expect(await prisma.payment.findUnique({ where: { id: payment.id } })).toMatchObject({ amountMinor: 1000, userId: ids.deleter });
  });
});

describe('retention jobs on Postgres', () => {
  it('clears old IP/user-agent data without touching rows or view counts', async () => {
    const oldAudit = await prisma.auditLog.create({ data: { action: `${RUN}-old`, ip: '203.0.113.7', userAgent: 'UA', createdAt: ago(91) } });
    const newAudit = await prisma.auditLog.create({ data: { action: `${RUN}-new`, ip: '203.0.113.8', userAgent: 'UA', createdAt: ago(5) } });
    const oldSession = await prisma.session.create({
      data: { id: `${RUN}-s-old`, token: `${RUN}-t-old`, userId: ids.other, ipAddress: '203.0.113.7', userAgent: 'UA', createdAt: ago(120), expiresAt: new Date(Date.now() + DAY) },
    });
    const playback = await prisma.videoPlaybackSession.create({
      data: { videoId: ids.video, ipHash: 'h', userAgentHash: 'u', accessTier: 'PUBLIC', countedAsView: true, startedAt: ago(95) },
    });
    const view = await prisma.videoView.create({ data: { videoId: ids.video, ipHash: 'h', createdAt: ago(100) } });
    const viewsBefore = await prisma.videoView.count({ where: { videoId: ids.video } });

    const result = await anonymizeOldTechnicalData(ctx());
    expect(result.ok).toBe(true);

    expect(await prisma.auditLog.findUnique({ where: { id: oldAudit.id } })).toMatchObject({ ip: null, userAgent: null, action: `${RUN}-old` });
    expect(await prisma.auditLog.findUnique({ where: { id: newAudit.id } })).toMatchObject({ ip: '203.0.113.8' });
    expect(await prisma.session.findUnique({ where: { id: oldSession.id } })).toMatchObject({ ipAddress: null, userAgent: null, token: `${RUN}-t-old` });
    expect(await prisma.videoPlaybackSession.findUnique({ where: { id: playback.id } })).toMatchObject({ ipHash: null, userAgentHash: null, countedAsView: true });
    expect(await prisma.videoView.findUnique({ where: { id: view.id } })).toMatchObject({ ipHash: null });
    expect(await prisma.videoView.count({ where: { videoId: ids.video } })).toBe(viewsBefore);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: ids.video } })).views).toBe(7);
  });

  it('deletes expired sessions and e-mail tokens, keeps live ones', async () => {
    await prisma.session.create({ data: { id: `${RUN}-s-exp`, token: `${RUN}-t-exp`, userId: ids.other, expiresAt: ago(1) } });
    await prisma.session.create({ data: { id: `${RUN}-s-live`, token: `${RUN}-t-live`, userId: ids.other, expiresAt: new Date(Date.now() + DAY) } });
    await prisma.verification.createMany({
      data: [
        { id: `${RUN}-v-exp`, identifier: `${RUN}-exp`, value: 'x', expiresAt: ago(1) },
        { id: `${RUN}-v-live`, identifier: `${RUN}-live`, value: 'x', expiresAt: new Date(Date.now() + DAY) },
      ],
    });

    await pruneExpiredAuthRecords({ db: prisma });

    expect(await prisma.session.findUnique({ where: { id: `${RUN}-s-exp` } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: `${RUN}-s-live` } })).not.toBeNull();
    expect(await prisma.verification.findUnique({ where: { id: `${RUN}-v-exp` } })).toBeNull();
    expect(await prisma.verification.findUnique({ where: { id: `${RUN}-v-live` } })).not.toBeNull();
  });
});

describe('Terms acceptance columns on Postgres', () => {
  it('records the accepted version once', async () => {
    const userCtx = createAppContext({ actor: { type: 'user', userId: ids.other }, prisma });
    expect(await recordTermsAcceptance(userCtx, ids.other, LEGAL_DOCUMENTS_VERSION)).toBe(true);
    const first = await prisma.user.findUniqueOrThrow({ where: { id: ids.other } });
    expect(first.termsVersion).toBe(LEGAL_DOCUMENTS_VERSION);
    expect(first.termsAcceptedAt).toBeInstanceOf(Date);
    expect(await recordTermsAcceptance(userCtx, ids.other, LEGAL_DOCUMENTS_VERSION)).toBe(false);
  });
});
