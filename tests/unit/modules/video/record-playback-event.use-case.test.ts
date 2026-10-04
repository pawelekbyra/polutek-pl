import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordPlaybackEventUseCase } from '@/lib/modules/video/application/record-playback-event.use-case';
import { VideoPlaybackRepository } from '@/lib/modules/video/infrastructure/video-playback.repository';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { WriteTx } from '@/lib/modules/shared/db';
import { checkVideoAccess } from '@/lib/modules/access';
import { setNxEx } from '@/lib/rate-limit';
import { PlaybackAccessDeniedError } from '@/lib/modules/video/domain/video.errors';
import type { PlaybackEventType } from '@/lib/modules/video/domain/video.dto';

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
      data: { hasAccess: false, reason: 'LOGIN_REQUIRED' as const }
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
      expect(result.error.message).toBe('LOGIN_REQUIRED');
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
      data: { hasAccess: false, reason: 'LOGIN_REQUIRED' as const }
    });

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'ACCESS_ERROR',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
      errorCode: 'LOGIN_REQUIRED',
      errorMessage: 'locked'
    }, ctx);

    expect(result.ok).toBe(true);
    expect(createPlaybackEvent).toHaveBeenCalledTimes(1);
    expect(createPlaybackEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'ACCESS_ERROR',
        errorCode: 'LOGIN_REQUIRED',
        errorMessage: 'locked'
      })
    });
    expect(ctx.db.writeTransaction).not.toHaveBeenCalled();
  });

  it('returns PlaybackAccessDeniedError for PLAY_STARTED when access is denied', async () => {
    const { ctx, createPlaybackEvent, createVideoView, updateVideo } = createDb();
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'LOGIN_REQUIRED' as const }
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
      expect(result.error.message).toBe('LOGIN_REQUIRED');
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

describe('recordPlaybackEventUseCase watch time (totalWatchMs)', () => {
  const T0 = new Date('2026-01-01T00:00:00.000Z').getTime();

  /** In-memory session row; updateSession applies the same fields Prisma would. */
  function setup() {
    const session: Record<string, any> = {
      id: 's1',
      videoId: 'v1',
      userId: null,
      ipHash: 'ip1',
      userAgentHash: 'ua1',
      countedAsView: false,
      isAdminPreview: false,
      createdAt: new Date(T0),
      lastHeartbeatAt: null,
      firstPlayAt: null,
      maxProgressMs: 0,
      totalWatchMs: 0,
    };
    let nowMs = T0;
    const prisma = {
      videoPlaybackSession: {
        findUnique: vi.fn(async () => ({ ...session })),
        update: vi.fn(async ({ data }: { data: Record<string, any> }) => {
          if (data.lastHeartbeatAt) session.lastHeartbeatAt = data.lastHeartbeatAt;
          if (data.firstPlayAt) session.firstPlayAt = data.firstPlayAt;
          if (data.totalWatchMs?.increment) session.totalWatchMs += data.totalWatchMs.increment;
          return session;
        }),
      },
      videoPlaybackEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const ctx = createAppContext({ actor: { type: 'guest' }, prisma: prisma as never, now: () => new Date(nowMs) });
    ctx.db.writeTransaction = vi.fn(async (fn: (tx: WriteTx) => Promise<unknown>) => fn({
      videoPlaybackSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      videoView: { create: vi.fn() },
      video: { update: vi.fn() },
    } as never)) as never;

    const send = async (type: PlaybackEventType, atSeconds: number) => {
      nowMs = T0 + atSeconds * 1000;
      const result = await recordPlaybackEventUseCase({
        videoId: 'v1', sessionId: 's1', type, positionMs: 1000, durationMs: 600000,
        ipHash: 'ip1', uaHash: 'ua1', fingerprint: 'f1',
      }, ctx);
      expect(result.ok).toBe(true);
    };
    return { session, send };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } });
    vi.mocked(setNxEx).mockResolvedValue(true);
  });

  it('adds the real time between 60-second heartbeats', async () => {
    const { session, send } = setup();
    await send('PLAY_STARTED', 5);
    await send('WATCHED_10_SECONDS', 15);
    await send('HEARTBEAT', 65);
    await send('HEARTBEAT', 125);
    expect(session.totalWatchMs).toBe(120_000);
  });

  it('does not count paused time, and counts the part played before the pause', async () => {
    const { session, send } = setup();
    await send('PLAY_STARTED', 0);
    await send('PLAY_PAUSED', 40);
    await send('PLAY_RESUMED', 640);
    await send('HEARTBEAT', 700);
    expect(session.totalWatchMs).toBe(100_000);
  });

  it('caps one gap (sleeping tab, missing pause event) at one interval plus slack', async () => {
    const { session, send } = setup();
    await send('PLAY_STARTED', 0);
    await send('HEARTBEAT', 3600);
    expect(session.totalWatchMs).toBe(90_000);
  });

  it('ignores a heartbeat that comes less than 10 s after the previous mark', async () => {
    const { session, send } = setup();
    await send('PLAY_STARTED', 0);
    await send('HEARTBEAT', 5);
    expect(session.totalWatchMs).toBe(0);
    await send('ENDED', 30);
    expect(session.totalWatchMs).toBe(30_000);
  });
});
