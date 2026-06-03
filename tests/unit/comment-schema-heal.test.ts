import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureCommentPinningColumns, resetCommentPinningColumnsEnsureForTests } from '@/lib/db/comment-schema-heal';

describe('ensureCommentPinningColumns', () => {
  beforeEach(() => {
    resetCommentPinningColumnsEnsureForTests();
  });

  it('adds missing comment pinning columns and indexes idempotently', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    };

    await ensureCommentPinningColumns(db as never);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(4);
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3)'
    );
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "pinnedById" TEXT'
    );
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      3,
      'CREATE INDEX IF NOT EXISTS "Comment_videoId_pinnedAt_createdAt_idx" ON "Comment"("videoId", "pinnedAt", "createdAt")'
    );
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      4,
      'CREATE UNIQUE INDEX IF NOT EXISTS "Comment_one_pinned_per_video_idx" ON "Comment"("videoId") WHERE "pinnedAt" IS NOT NULL AND "parentId" IS NULL AND "deletedAt" IS NULL'
    );
  });

  it('does not add columns when they already exist but still ensures indexes', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([{ column_name: 'pinnedAt' }, { column_name: 'pinnedById' }]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    };

    await ensureCommentPinningColumns(db as never);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'CREATE INDEX IF NOT EXISTS "Comment_videoId_pinnedAt_createdAt_idx" ON "Comment"("videoId", "pinnedAt", "createdAt")'
    );
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'CREATE UNIQUE INDEX IF NOT EXISTS "Comment_one_pinned_per_video_idx" ON "Comment"("videoId") WHERE "pinnedAt" IS NOT NULL AND "parentId" IS NULL AND "deletedAt" IS NULL'
    );
  });

  it('caches the successful heal attempt per server instance', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    };

    await ensureCommentPinningColumns(db as never);
    await ensureCommentPinningColumns(db as never);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(4);
  });
});
