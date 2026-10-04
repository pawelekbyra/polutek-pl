import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { CommentDeletedReason, CommentStatus } from '@prisma/client';
import { GET } from '@/app/api/cron/purge-deleted-comments/route';
import { purgeAuthorDeletedComments, AUTHOR_DELETED_COMMENT_RETENTION_DAYS } from '@/lib/modules/comments';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';
import { createAppContext } from '@/lib/modules/shared/app-context';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-04T05:15:00Z');

type Row = { id: string; status: CommentStatus; deletedReason: CommentDeletedReason | null; deletedAt: Date | null; text: string; imageUrl: string | null };

/** In-memory `comment.updateMany` that understands the filter the purge uses. */
function fakeDb(rows: Row[]) {
  return {
    comment: {
      updateMany: async ({ where, data }: any) => {
        const hit = rows.filter((row) =>
          row.status === where.status &&
          row.deletedReason === where.deletedReason &&
          row.deletedAt !== null && row.deletedAt < where.deletedAt.lt &&
          (row.text !== '' || row.imageUrl !== null));
        hit.forEach((row) => Object.assign(row, data));
        return { count: hit.length };
      },
    },
  } as any;
}

const row = (id: string, overrides: Partial<Row>): Row => ({
  id, status: CommentStatus.VISIBLE, deletedReason: null, deletedAt: null, text: `text ${id}`, imageUrl: null, ...overrides,
});

describe('purge of author-deleted comment text (30-day retention)', () => {
  let rows: Row[];

  beforeEach(() => {
    rows = [
      row('old-author', { status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.AUTHOR_DELETED, deletedAt: new Date(NOW.getTime() - 31 * DAY) }),
      row('fresh-author', { status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.AUTHOR_DELETED, deletedAt: new Date(NOW.getTime() - 5 * DAY) }),
      row('old-moderator', { status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.MODERATOR_DELETED, deletedAt: new Date(NOW.getTime() - 90 * DAY) }),
      row('hidden', { status: CommentStatus.HIDDEN }),
      row('visible', {}),
    ];
  });

  it('erases only text its author deleted more than 30 days ago; everything else stays', async () => {
    const repo = new CommentRepository(fakeDb(rows));
    const purged = await repo.purgeAuthorDeletedContent(new Date(NOW.getTime() - AUTHOR_DELETED_COMMENT_RETENTION_DAYS * DAY));

    expect(purged).toBe(1);
    const text = Object.fromEntries(rows.map((r) => [r.id, r.text]));
    expect(text).toEqual({
      'old-author': '',
      'fresh-author': 'text fresh-author',
      'old-moderator': 'text old-moderator',
      hidden: 'text hidden',
      visible: 'text visible',
    });
    // The row itself stays (thread links, author), only its content is gone.
    expect(rows.find((r) => r.id === 'old-author')?.status).toBe(CommentStatus.DELETED);
  });

  it('is idempotent: a second run erases nothing new', async () => {
    const repo = new CommentRepository(fakeDb(rows));
    const cutoff = new Date(NOW.getTime() - 30 * DAY);
    await repo.purgeAuthorDeletedContent(cutoff);
    expect(await repo.purgeAuthorDeletedContent(cutoff)).toBe(0);
  });

  it('the use case runs only as a system job and uses a 30-day cutoff', async () => {
    const spy = vi.spyOn(CommentRepository.prototype, 'purgeAuthorDeletedContent').mockResolvedValue(2);
    const result = await purgeAuthorDeletedComments(createAppContext({ actor: { type: 'system', reason: 't' }, prisma: {} as any, now: () => NOW }));
    expect(result).toEqual({ ok: true, data: { purged: 2, deletedBefore: new Date(NOW.getTime() - 30 * DAY).toISOString() } });

    const denied = await purgeAuthorDeletedComments(createAppContext({ actor: { type: 'admin', userId: 'a' }, prisma: {} as any }));
    expect(denied.ok).toBe(false);
    spy.mockRestore();
  });

  it('the cron route rejects calls without the cron secret', async () => {
    process.env.CRON_SECRET = 'test_cron_secret';
    const spy = vi.spyOn(CommentRepository.prototype, 'purgeAuthorDeletedContent').mockResolvedValue(0);
    const res = await GET(new NextRequest('http://localhost/api/cron/purge-deleted-comments', { headers: { Authorization: 'Bearer nope' } }));
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();

    const ok = await GET(new NextRequest('http://localhost/api/cron/purge-deleted-comments', { headers: { Authorization: 'Bearer test_cron_secret' } }));
    expect(ok.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
