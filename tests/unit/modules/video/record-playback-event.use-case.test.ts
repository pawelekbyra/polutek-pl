import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordPlaybackEventUseCase } from '@/lib/modules/video/application/record-playback-event.use-case';
import { VideoPlaybackRepository } from '@/lib/modules/video/infrastructure/video-playback.repository';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { WriteTx } from '@/lib/modules/shared/db';
import { checkVideoAccess } from '@/lib/modules/access';
import { setNxEx } from '@/lib/rate-limit';
import { PlaybackAccessDeniedError } from '@/lib/modules/video/domain/video.errors';

// These tests intentionally exercise duplicate view claims through repository-shaped mocks.
vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  setNxEx: vi.fn().mockResolvedValue(true),
}));

describe('VideoPlaybackRepository.recordView', () => {
  it('claims the playback session before creating VideoView and incrementing Video.views', async () => {
    const updateSessionClaim = vi.fn().mockResolvedValue({ count: 1 });
    const createVideoView = vi.fn().mockResolvedValue({});
    const updateVideo = vi.fn().mockResolvedValue({});
    const db = {
      videoPlaybackSession: { updateMany: updateSessionClaim },
      videoView: { create: createVideoView },
      video: { update: updateVideo },
    };

    const result = await new VideoPlaybackRepository(db as never).recordView('v1', 's1', null, 'ip1');

    expect(result).toEqual({ counted: true });
    expect(updateSessionClaim).toHaveBeenCalledWith({
      where: { id: 's1', countedAsView: false },
      data: { countedAsView: true },
    });
    expect(createVideoView).toHaveBeenCalledTimes(1);
    expect(updateVideo).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when a duplicate playback session claim has already been counted', async () => {
    const updateSessionClaim = vi.fn().mockResolvedValue({ count: 0 });
    const createVideoView = vi.fn();
    const updateVideo = vi.fn();
    const db = {
      videoPlaybackSession: { updateMany: updateSessionClaim },
      videoView: { create: createVideoView },
      video: { update: updateVideo },
    };

    const result = await new VideoPlaybackRepository(db as never).recordView('v1', 's1', null, 'ip1');

    expect(result).toEqual({ counted: false, skippedReason: 'SESSION_ALREADY_COUNTED' });
    expect(createVideoView).not.toHaveBeenCalled();
    expect(updateVideo).not.toHaveBeenCalled();
  });
});

describe('recordPlaybackEventUseCase', () => {
  const createSession = (overrides: Record<string, unknown> = {}) => ({
    id: 's1',
    videoId: 'v1',
    userId: null,
    ipHash: 'ip1',
    userAgentHash: 'ua1',
    countedAsView: false,
    isAdminPreview: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastHeartbeatAt: new Date('2026-01-01T00:00:00.000Z'),
    firstPlayAt: null,
    maxProgressMs: 0,
    ...overrides,
  });

  const createDb = (session = createSession(), claimCount = 1) => {
    const updateSessionClaim = vi.fn().mockResolvedValue({ count: claimCount });
    const createVideoView = vi.fn().mockResolvedValue({});
    const updateVideo = vi.fn().mockResolvedValue({});
    const findSession = vi.fn().mockResolvedValue(session);
    const updateSession = vi.fn().mockResolvedValue({});
    const createPlaybackEvent = vi.fn().mockResolvedValue({});

    const tx = {
      videoPlaybackSession: {
        updateMany: updateSessionClaim,
      },
      videoView: { create: createVideoView },
      video: { update: updateVideo },
    };

    const prisma = {
      videoPlaybackSession: {
        findUnique: findSession,
        update: updateSession,
      },
      videoPlaybackEvent: { create: createPlaybackEvent },
    };

    const ctx = createAppContext({
      actor: { type: 'guest' },
      prisma: prisma as never,
      now: () => new Date('2026-01-01T00:00:11.000Z'),
    });
    ctx.db.writeTransaction = vi.fn(async (fn: (tx: WriteTx) => Promise<unknown>) => fn(tx as never)) as never;

    return {
      ctx,
      updateSessionClaim,
      createVideoView,
      updateVideo,
      createPlaybackEvent,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } });
    vi.mocked(setNxEx).mockResolvedValue(true);
  });

  it('does not count WATCHED_10_SECONDS without credible playback progress', async () => {
    const { ctx, createVideoView, updateVideo } = createDb();

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      positionMs: 10000,
      durationMs: 60000,
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
    }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.data.viewCounted).toBe(false);
    expect(ctx.db.writeTransaction).not.toHaveBeenCalled();
    expect(createVideoView).not.toHaveBeenCalled();
    expect(updateVideo).not.toHaveBeenCalled();
  });

  it('counts one view for WATCHED_10_SECONDS with valid controlled-player progress', async () => {
    const { ctx, updateSessionClaim, createVideoView, updateVideo } = createDb(createSession({
      firstPlayAt: new Date('2026-01-01T00:00:01.000Z'),
      maxProgressMs: 9000,
      durationMs: 60000,
    }));

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      positionMs: 10000,
      durationMs: 60000,
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
    }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.data.viewCounted).toBe(true);
    expect(ctx.db.writeTransaction).toHaveBeenCalledTimes(1);
    expect(updateSessionClaim).toHaveBeenCalledWith({
      where: { id: 's1', countedAsView: false },
      data: { countedAsView: true },
    });
    expect(createVideoView).toHaveBeenCalledTimes(1);
    expect(updateVideo).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { views: { increment: 1 } },
    });
  });

  it('does not increment twice when a duplicate WATCHED_10_SECONDS cannot claim the same session', async () => {
    const { ctx, updateSessionClaim, createVideoView, updateVideo } = createDb(createSession({
      firstPlayAt: new Date('2026-01-01T00:00:01.000Z'),
      maxProgressMs: 10000,
      durationMs: 60000,
    }), 0);

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      positionMs: 10000,
      durationMs: 60000,
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
    }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.data.viewCounted).toBe(false);
    expect(updateSessionClaim).toHaveBeenCalledTimes(1);
    expect(createVideoView).not.toHaveBeenCalled();
    expect(updateVideo).not.toHaveBeenCalled();
  });

  it('does not count admin preview sessions', async () => {
    const { ctx, createVideoView, updateVideo } = createDb(createSession({ isAdminPreview: true }));

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
    }, ctx);

    expect(result.ok).toBe(true);
    expect(ctx.db.writeTransaction).not.toHaveBeenCalled();
    expect(createVideoView).not.toHaveBeenCalled();
    expect(updateVideo).not.toHaveBeenCalled();
  });

  it('returns PlaybackAccessDeniedError and does not count when access is denied', async () => {
    const { ctx, createPlaybackEvent, createVideoView, updateVideo } = createDb();
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED' as const }
    });

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1'
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PlaybackAccessDeniedError);
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('ACCESS_DENIED');
      expect(result.error.message).toBe('PATRON_REQUIRED');
    }
    expect(createPlaybackEvent).not.toHaveBeenCalled();
    expect(ctx.db.writeTransaction).not.toHaveBeenCalled();
    expect(createVideoView).not.toHaveBeenCalled();
    expect(updateVideo).not.toHaveBeenCalled();
  });

  it('stores ACCESS_ERROR events even when playback access is denied', async () => {
    const { ctx, createPlaybackEvent } = createDb();
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED' as const }
    });

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'ACCESS_ERROR',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
      errorCode: 'PATRON_REQUIRED',
      errorMessage: 'locked'
    }, ctx);

    expect(result.ok).toBe(true);
    expect(createPlaybackEvent).toHaveBeenCalledTimes(1);
    expect(createPlaybackEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'ACCESS_ERROR',
        errorCode: 'PATRON_REQUIRED',
        errorMessage: 'locked'
      })
    });
    expect(ctx.db.writeTransaction).not.toHaveBeenCalled();
  });

  it('returns PlaybackAccessDeniedError for PLAY_STARTED when access is denied', async () => {
    const { ctx, createPlaybackEvent, createVideoView, updateVideo } = createDb();
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED' as const }
    });

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'PLAY_STARTED',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1'
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PlaybackAccessDeniedError);
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('ACCESS_DENIED');
      expect(result.error.message).toBe('PATRON_REQUIRED');
    }
    expect(createPlaybackEvent).not.toHaveBeenCalled();
    expect(ctx.db.writeTransaction).not.toHaveBeenCalled();
    expect(createVideoView).not.toHaveBeenCalled();
    expect(updateVideo).not.toHaveBeenCalled();
  });

  it('does not leak sensitive Cloudflare playback metadata into stored events', async () => {
    const { ctx, createPlaybackEvent } = createDb();

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
      provider: 'cloudflare',
      metadata: {
        playbackUrl: 'https://customer.cloudflarestream.com/signed-url',
        token: 'secret-token',
        cookie: 'cf-cookie',
        eventName: 'timeupdate',
        nested: {
          signedUrl: 'https://customer.cloudflarestream.com/signed-nested',
          playbackToken: 'nested-token',
          quality: 'auto',
        },
      },
    }, ctx);

    expect(result.ok).toBe(true);
    expect(createPlaybackEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          eventName: 'timeupdate',
          nested: { quality: 'auto' },
        },
      }),
    });
    expect(JSON.stringify(createPlaybackEvent.mock.calls)).not.toContain('cloudflarestream.com');
    expect(JSON.stringify(createPlaybackEvent.mock.calls)).not.toContain('token');
    expect(JSON.stringify(createPlaybackEvent.mock.calls)).not.toContain('cookie');
  });
});
