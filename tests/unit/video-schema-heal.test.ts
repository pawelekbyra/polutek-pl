import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureVideoPresentationColumns, resetVideoPresentationColumnsEnsureForTests } from '@/lib/db/video-schema-heal';

describe('ensureVideoPresentationColumns', () => {
  beforeEach(() => {
    resetVideoPresentationColumnsEnsureForTests();
  });

  it('adds missing homepage video presentation columns idempotently', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    };

    await ensureVideoPresentationColumns(db as never);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "showInSidebar" BOOLEAN NOT NULL DEFAULT true'
    );
    expect(db.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "sidebarOrder" INTEGER NOT NULL DEFAULT 0'
    );
  });

  it('does not alter the table when both columns already exist', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([{ column_name: 'showInSidebar' }, { column_name: 'sidebarOrder' }]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    };

    await ensureVideoPresentationColumns(db as never);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('caches the successful heal attempt per server instance', async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    };

    await ensureVideoPresentationColumns(db as never);
    await ensureVideoPresentationColumns(db as never);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
