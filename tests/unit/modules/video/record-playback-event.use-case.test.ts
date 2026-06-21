import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordPlaybackEventUseCase } from '@/lib/modules/video/application/record-playback-event.use-case';
import { VideoPlaybackRepository } from '@/lib/modules/video/infrastructure/video-playback.repository';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { setNxEx } from '@/lib/rate-limit';
import { PlaybackAccessDeniedError } from '@/lib/modules/video/domain/video.errors';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  setNxEx: vi.fn().mockResolvedValue(true),
}));

describe('VideoPlaybackRepository.recordView', () => {
  it('claims the playback session before creating VideoView and incrementing Video.views', async () => {
    const db = {
      videoPlaybackSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      videoView: { create: vi.fn().mockResolvedValue({}) },
      video: { update: vi.fn().mockResolvedValue({}) },
    } as any;

    const result = await new VideoPlaybackRepository(db).recordView('v1', 's1', null, 'ip1');

    expect(result).toEqual({ counted: true });
    expect(db.videoPlaybackSession.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', countedAsView: false },
      data: { countedAsView: true },
    });
    expect(db.videoView.create).toHaveBeenCalledTimes(1);
    expect(db.video.update).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when a duplicate playback session claim has already been counted', async () => {
    const db = {
      videoPlaybackSession: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      videoView: { create: vi.fn() },
      video: { update: vi.fn() },
    } as any;

    const result = await new VideoPlaybackRepository(db).recordView('v1', 's1', null, 'ip1');

    expect(result).toEqual({ counted: false, skippedReason: 'SESSION_ALREADY_COUNTED' });
    expect(db.videoView.create).not.toHaveBeenCalled();
    expect(db.video.update).not.toHaveBeenCalled();
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
    const tx = {
      videoPlaybackSession: {
        updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
      },
      videoView: { create: vi.fn().mockResolvedValue({}) },
      video: { update: vi.fn().mockResolvedValue({}) },
    } as any;

    const prisma = {
      videoPlaybackSession: {
        findUnique: vi.fn().mockResolvedValue(session),
        update: vi.fn().mockResolvedValue({}),
      },
      videoPlaybackEvent: { create: vi.fn().mockResolvedValue({}) },
    } as any;

    const ctx = createAppContext({
      actor: { type: 'guest' },
      prisma,
      now: () => new Date('2026-01-01T00:00:11.000Z'),
    });
    ctx.db.writeTransaction = vi.fn(async (fn) => fn(tx));

    return { ctx, prisma, tx };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
    (setNxEx as any).mockResolvedValue(true);
  });

  it('counts one view for WATCHED_10_SECONDS with a valid session', async () => {
    const { ctx, tx } = createDb();

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
    }, ctx);

    expect(result.ok).toBe(true);
    expect(ctx.db.writeTransaction).toHaveBeenCalledTimes(1);
    expect(tx.videoPlaybackSession.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', countedAsView: false },
      data: { countedAsView: true },
    });
    expect(tx.videoView.create).toHaveBeenCalledTimes(1);
    expect(tx.video.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { views: { increment: 1 } },
    });
  });

  it('does not increment twice when a duplicate WATCHED_10_SECONDS cannot claim the same session', async () => {
    const { ctx, tx } = createDb(createSession(), 0);

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'WATCHED_10_SECONDS',
      sessionId: 's1',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1',
    }, ctx);

    expect(result.ok).toBe(true);
    expect(tx.videoPlaybackSession.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.videoView.create).not.toHaveBeenCalled();
    expect(tx.video.update).not.toHaveBeenCalled();
  });

  it('does not count admin preview sessions', async () => {
    const { ctx, tx } = createDb(createSession({ isAdminPreview: true }));

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
    expect(tx.videoView.create).not.toHaveBeenCalled();
    expect(tx.video.update).not.toHaveBeenCalled();
  });

  it('returns PlaybackAccessDeniedError and does not count when access is denied', async () => {
    const { ctx, tx, prisma } = createDb();
    (checkVideoAccess as any).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED' }
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
    expect(prisma.videoPlaybackEvent.create).not.toHaveBeenCalled();
    expect(ctx.db.writeTransaction).not.toHaveBeenCalled();
    expect(tx.videoView.create).not.toHaveBeenCalled();
    expect(tx.video.update).not.toHaveBeenCalled();
  });

  it('does not leak sensitive Cloudflare playback metadata into stored events', async () => {
    const { ctx, prisma } = createDb();

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
    const createArg = prisma.videoPlaybackEvent.create.mock.calls[0][0];
    expect(createArg.data.metadata).toEqual({
      eventName: 'timeupdate',
      nested: { quality: 'auto' },
    });
    expect(JSON.stringify(createArg.data.metadata)).not.toContain('cloudflarestream.com');
    expect(JSON.stringify(createArg.data.metadata)).not.toContain('token');
    expect(JSON.stringify(createArg.data.metadata)).not.toContain('cookie');
  });
});
