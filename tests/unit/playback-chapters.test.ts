import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import type { Actor } from '@/lib/modules/shared/actor';

vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));

const VIDEO_ID = 'c52f0407-b0e8-4b5c-b6d3-a9f152653002';
const chapters = [
  { startSeconds: 0, title: 'Wstęp', titleEn: 'Intro' },
  { startSeconds: 30, title: 'Temat' },
  { startSeconds: 120, title: 'Koniec' },
];
const asset = {
  id: 'self',
  videoId: VIDEO_ID,
  provider: 'SELF_HLS',
  objectKey: `videos/${VIDEO_ID}/v/v1`,
  bucket: 'polutek-hls',
  processingState: 'READY',
  isPrimary: true,
  mimeType: null,
  sizeBytes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Chapters travel with the playback plan like subtitles: only a plan that can play carries them.
describe('playback plan: chapters', () => {
  const prisma = { video: { findUnique: vi.fn() }, videoPlaybackSession: { create: vi.fn(), findUnique: vi.fn() } };

  function video(over: Record<string, unknown> = {}) {
    return {
      id: VIDEO_ID,
      title: 'Czesc',
      thumbnailUrl: '/t.jpg',
      tier: 'PUBLIC',
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 86_400_000),
      premiereAt: null,
      chapters,
      activePlaybackRoute: { asset },
      assets: [asset],
      ...over,
    };
  }
  const plan = (actor: Actor = { type: 'user', userId: 'u1' }) => PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, createAppContext({ actor, prisma: prisma as never }));

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HLS_TOKEN_SECRET = 's'.repeat(40);
    prisma.video.findUnique.mockResolvedValue(video());
    prisma.videoPlaybackSession.create.mockResolvedValue({ id: 'sess-1' });
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as never);
  });
  afterEach(() => {
    delete process.env.HLS_TOKEN_SECRET;
  });

  it('a plan that can play carries the chapters', async () => {
    const result = await plan();
    expect(result.status).toBe('READY');
    expect(result.player.chapters).toEqual(chapters);
  });

  it('a video without chapters, or with broken stored chapters, has no chapters field at all', async () => {
    for (const stored of [null, undefined, [], { not: 'a list' }, chapters.slice(0, 2)]) {
      prisma.video.findUnique.mockResolvedValue(video({ chapters: stored }));
      const result = await plan();
      expect(result.status).toBe('READY');
      expect('chapters' in result.player).toBe(false);
    }
  });

  it('a guest on a signed-in video gets LOGIN_REQUIRED and no chapter titles anywhere', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ tier: 'LOGGED_IN' }));
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'LOGIN_REQUIRED' } } as never);
    const result = await plan({ type: 'guest' });
    expect(result.status).toBe('LOGIN_REQUIRED');
    expect(result.player.chapters).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/Wstęp|Temat|Koniec|Intro|chapters/);
  });

  it('a premiere that has not started has no chapters', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ premiereAt: new Date(Date.now() + 86_400_000) }));
    const result = await plan();
    expect(result.status).toBe('COMING_SOON');
    expect(JSON.stringify(result)).not.toMatch(/Wstęp|Temat|Koniec|Intro|chapters/);
  });

  it('no playable asset has no chapters', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ activePlaybackRoute: null, assets: [] }));
    const result = await plan();
    expect(result.status).toBe('NO_PRIMARY_ASSET');
    expect(result.player.chapters).toBeUndefined();
  });

  it('an unavailable video and an access error have no chapters', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: false, error: { code: 'INTERNAL', message: 'boom' } } as never);
    const failed = await plan();
    expect(failed.canPlay).toBe(false);
    expect(failed.player.chapters).toBeUndefined();

    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as never);
    prisma.video.findUnique.mockResolvedValue(null);
    const missing = await plan();
    expect(missing.canPlay).toBe(false);
    expect(missing.player.chapters).toBeUndefined();
  });

  it('a plan that could not be built (no token secret) has no chapters', async () => {
    delete process.env.HLS_TOKEN_SECRET;
    const result = await plan();
    expect(result.canPlay).toBe(false);
    expect(result.player.chapters).toBeUndefined();
  });
});
