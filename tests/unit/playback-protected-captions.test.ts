import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { withDeliveryCaptions } from '@/lib/modules/playback/application/self-hls-plan';
import { verifyToken } from '@/workers/hls-edge/worker.mjs';
import type { Actor } from '@/lib/modules/shared/actor';

vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));

const VIDEO_ID = 'c52f0407-b0e8-4b5c-b6d3-a9f152653002';
const SECRET = 's'.repeat(40);
const HASH_PL = 'a'.repeat(64);
const HASH_EN = 'b'.repeat(64);
const REF_PL = `hlscap:pl-${HASH_PL}.vtt`;
const REF_EN = `hlscap:en-${HASH_EN}.vtt`;
const LEGACY_PL = 'https://thumbs.example.com/videos/x/subtitles/old.vtt';

const selfAsset = {
  id: 'self', videoId: VIDEO_ID, provider: 'SELF_HLS', objectKey: `videos/${VIDEO_ID}/v/v1`, bucket: 'polutek-hls',
  processingState: 'READY', isPrimary: true, mimeType: null, sizeBytes: null, createdAt: new Date(), updatedAt: new Date(),
};

describe('protected captions in the playback plan', () => {
  const prisma = {
    video: { findUnique: vi.fn() },
    videoPlaybackSession: { create: vi.fn(), findUnique: vi.fn() },
  };
  const video = (over: Record<string, unknown> = {}) => ({
    id: VIDEO_ID, title: 'Czesc', thumbnailUrl: '/t.jpg', tier: 'PAID', status: 'PUBLISHED',
    publishedAt: new Date(Date.now() - 86_400_000), premiereAt: null,
    subtitleUrlPl: REF_PL, subtitleUrlEn: REF_EN,
    activePlaybackRoute: { asset: selfAsset }, assets: [selfAsset], ...over,
  });
  const plan = (actor: Actor = { type: 'user', userId: 'u1' }) =>
    PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, createAppContext({ actor, prisma: prisma as never }));

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HLS_TOKEN_SECRET = SECRET;
    delete process.env.HLS_DELIVERY_BASE_URL;
    prisma.video.findUnique.mockResolvedValue(video());
    prisma.videoPlaybackSession.create.mockResolvedValue({ id: 'sess-1' });
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as never);
  });
  afterEach(() => {
    delete process.env.HLS_TOKEN_SECRET;
  });

  it('gives an allowed viewer caption URLs under the SAME token as the video (never the raw reference)', async () => {
    const result = await plan();
    const master = new URL(result.source!.playbackUrl!);
    const [, , token, id, version] = master.pathname.split('/');
    const tracks = result.player.textTracks!;
    expect(tracks.map((t) => t.language)).toEqual(['pl', 'en']);
    expect(tracks[0].src).toBe(`https://video.pawelperfect.com/h/${token}/${id}/${version}/captions/pl-${HASH_PL}.vtt`);
    expect(tracks[1].src).toBe(`https://video.pawelperfect.com/h/${token}/${id}/${version}/captions/en-${HASH_EN}.vtt`);
    // The token on the caption URL is the one the Worker accepts for this video version.
    expect(await verifyToken(SECRET, id, version, token, Math.floor(Date.now() / 1000))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('hlscap:');
    // A paid video's token is protected: no ".pub" marker, so the Worker answers with private cache headers.
    expect(token.endsWith('.pub')).toBe(false);
  });

  it('a public video: captions ride on the ".pub" token (long public cache, no extra exposure)', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ tier: 'PUBLIC' }));
    const result = await plan({ type: 'guest' });
    const token = new URL(result.source!.playbackUrl!).pathname.split('/')[2];
    expect(token.endsWith('.pub')).toBe(true);
    expect(result.player.textTracks![0].src).toContain(`/h/${token}/${VIDEO_ID}/v1/captions/`);
  });

  it('every renewal carries the fresh token in the caption URLs too', async () => {
    const first = await plan();
    await new Promise((r) => setTimeout(r, 1100));
    const second = await plan();
    const tokenOf = (src: string) => new URL(src).pathname.split('/')[2];
    expect(tokenOf(second.player.textTracks![0].src)).toBe(tokenOf(second.source!.playbackUrl!));
    expect(tokenOf(second.player.textTracks![0].src)).not.toBe(tokenOf(first.player.textTracks![0].src));
  });

  it('a denied viewer gets no caption URL, reference or token (draft, paid, patron zone alike)', async () => {
    for (const reason of ['LOGIN_REQUIRED', 'PAYMENT_REQUIRED', 'PASS_REQUIRED']) {
      vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason } } as never);
      const result = await plan({ type: 'guest' });
      expect(result.canPlay).toBe(false);
      expect(result.player.textTracks).toBeUndefined();
      expect(JSON.stringify(result)).not.toMatch(/hlscap|captions\/|\/h\//);
    }
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('a premiere that has not started yet exposes no captions', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ premiereAt: new Date(Date.now() + 86_400_000) }));
    const result = await plan();
    expect(result.status).toBe('COMING_SOON');
    expect(JSON.stringify(result)).not.toMatch(/hlscap|captions\/|\/h\//);
  });

  it('legacy public URLs keep working until they are migrated; a malformed reference is dropped', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ subtitleUrlPl: LEGACY_PL, subtitleUrlEn: 'hlscap:en-nothex.vtt' }));
    const result = await plan();
    expect(result.player.textTracks).toEqual([{ src: LEGACY_PL, label: 'Polski', language: 'pl', kind: 'subtitles' }]);
  });

  it('a video without captions has no text tracks', async () => {
    prisma.video.findUnique.mockResolvedValue(video({ subtitleUrlPl: null, subtitleUrlEn: null }));
    expect((await plan()).player.textTracks).toBeUndefined();
  });
});

describe('withDeliveryCaptions', () => {
  const prefix = 'https://video.pawelperfect.com/h/1800000000.sig/vid-12345678/v1';
  const base = { autoplayAllowed: true, mutedAutoplay: true, controls: true, poster: '', title: 't' };

  it('resolves references, leaves URLs alone and removes the key when nothing is left', () => {
    const mixed = withDeliveryCaptions({ ...base, textTracks: [
      { src: REF_PL, label: 'Polski', language: 'pl', kind: 'subtitles' },
      { src: LEGACY_PL, label: 'English', language: 'en', kind: 'subtitles' },
    ] }, prefix);
    expect(mixed.textTracks!.map((t) => t.src)).toEqual([`${prefix}/captions/pl-${HASH_PL}.vtt`, LEGACY_PL]);
    const none = withDeliveryCaptions({ ...base, textTracks: [{ src: 'hlscap:broken', label: 'Polski', language: 'pl', kind: 'subtitles' }] }, prefix);
    expect('textTracks' in none).toBe(false);
    expect(withDeliveryCaptions(base, prefix)).toBe(base);
  });
});
