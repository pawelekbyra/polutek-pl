import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type PrismaWithRaw = Pick<PrismaClient, '$executeRawUnsafe' | '$queryRaw'>;

type ColumnRow = {
  column_name: string;
};

let commentPinningColumnsPromise: Promise<void> | null = null;

async function getExistingCommentPinningColumns(db: PrismaWithRaw) {
  const rows = await db.$queryRaw<ColumnRow[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Comment'
      AND column_name IN ('pinnedAt', 'pinnedById')
  `;

  return new Set(rows.map((row) => row.column_name));
}

async function addCommentPinningColumns(db: PrismaWithRaw) {
  const existingColumns = await getExistingCommentPinningColumns(db);

  if (!existingColumns.has('pinnedAt')) {
    await db.$executeRawUnsafe(
      'ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3)'
    );
  }

  if (!existingColumns.has('pinnedById')) {
    await db.$executeRawUnsafe(
      'ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "pinnedById" TEXT'
    );
  }

  await db.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Comment_videoId_pinnedAt_createdAt_idx" ON "Comment"("videoId", "pinnedAt", "createdAt")'
  );

  await db.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Comment_one_pinned_per_video_idx" ON "Comment"("videoId") WHERE "pinnedAt" IS NOT NULL AND "parentId" IS NULL AND "deletedAt" IS NULL'
  );
}

/**
 * Keeps the comments API working if a deployment starts serving traffic before
 * the latest comment-pinning migration has been applied. Prisma reads all scalar
 * Comment fields after create/update calls, so missing pinning columns can make
 * even plain comment posting fail with P2022.
 */
export async function ensureCommentPinningColumns(db: PrismaWithRaw = prisma) {
  if (!commentPinningColumnsPromise) {
    commentPinningColumnsPromise = addCommentPinningColumns(db).catch((error) => {
      commentPinningColumnsPromise = null;
      throw error;
    });
  }

  return commentPinningColumnsPromise;
}

export function resetCommentPinningColumnsEnsureForTests() {
  commentPinningColumnsPromise = null;
}
