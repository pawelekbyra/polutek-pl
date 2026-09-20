import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pruneStalePlaybackSessions,
  STALE_PLAYBACK_SESSION_RETENTION_DAYS,
} from '@/lib/modules/video/application/prune-stale-playback-sessions.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';

describe('pruneStalePlaybackSessions', () => {
  let ctx: AppContext;
  const deleteMany = vi.fn();
  const now = new Date('2026-09-20T00:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    deleteMany.mockResolvedValue({ count: 0 });

    ctx = {
      actor: { type: 'system', reason: 'test' } as Actor,
      db: { read: {} as any },
      prisma: { videoPlaybackSession: { deleteMany } } as any,
      now: () => now,
    } as unknown as AppContext;
  });

  it('deletes only sessions that were never counted as a view and are older than the default 30-day cutoff', async () => {
    deleteMany.mockResolvedValue({ count: 12 });

    const result = await pruneStalePlaybackSessions({}, ctx);

    expect(result.ok).toBe(true);
    const expectedCutoff = new Date(now.getTime() - STALE_PLAYBACK_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        countedAsView: false,
        startedAt: { lt: expectedCutoff },
      },
    });
    if (result.ok) {
      expect(result.data).toEqual({ deletedCount: 12, cutoff: expectedCutoff });
    }
  });

  it('respects a custom olderThanDays override', async () => {
    await pruneStalePlaybackSessions({ olderThanDays: 7 }, ctx);

    const expectedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        countedAsView: false,
        startedAt: { lt: expectedCutoff },
      },
    });
  });

  it('never includes countedAsView: true in the delete filter, regardless of age', async () => {
    await pruneStalePlaybackSessions({}, ctx);

    const call = deleteMany.mock.calls[0][0];
    expect(call.where.countedAsView).toBe(false);
  });
});
