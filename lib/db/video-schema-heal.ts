import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type PrismaWithRaw = Pick<PrismaClient, '$executeRawUnsafe' | '$queryRaw'>;

type ColumnRow = {
  column_name: string;
};

let videoPresentationColumnsPromise: Promise<void> | null = null;

async function getExistingVideoPresentationColumns(db: PrismaWithRaw) {
  const rows = await db.$queryRaw<ColumnRow[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Video'
      AND column_name IN ('showInSidebar', 'sidebarOrder')
  `;

  return new Set(rows.map((row) => row.column_name));
}

async function addVideoPresentationColumns(db: PrismaWithRaw) {
  const existingColumns = await getExistingVideoPresentationColumns(db);

  if (!existingColumns.has('showInSidebar')) {
    await db.$executeRawUnsafe(
      'ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "showInSidebar" BOOLEAN NOT NULL DEFAULT true'
    );
  }

  if (!existingColumns.has('sidebarOrder')) {
    await db.$executeRawUnsafe(
      'ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "sidebarOrder" INTEGER NOT NULL DEFAULT 0'
    );
  }
}

/**
 * Makes the app resilient when a deployment reaches production before the latest
 * Prisma migration has been applied. The homepage and admin video list both rely
 * on these presentation columns, so adding them idempotently prevents Prisma
 * P2022 failures from replacing the public homepage with an error screen.
 */
export async function ensureVideoPresentationColumns(db: PrismaWithRaw = prisma) {
  if (!videoPresentationColumnsPromise) {
    videoPresentationColumnsPromise = addVideoPresentationColumns(db).catch((error) => {
      videoPresentationColumnsPromise = null;
      throw error;
    });
  }

  return videoPresentationColumnsPromise;
}

export function resetVideoPresentationColumnsEnsureForTests() {
  videoPresentationColumnsPromise = null;
}
