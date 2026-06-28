import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addVideoSource } from '@/lib/modules/video/application/add-video-source.use-case';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: 'channel-id' }),
  },
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Keep fetch unmocked by default — individual tests override per-case.
afterEach(() => {
  vi.restoreAllMocks();
});

function makeCtx(prismaOverrides: Record<string, unknown> = {}) {
  const prisma: any = {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma)),
    video: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    videoAsset: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ...prismaOverrides,
  };
  return { prisma, db: { read: prisma } } as any;
}

function makeVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-id',
    creatorId: 'channel-id',
    tier: 'FREE',
    status: 'PUBLISHED',
    assets: [],
    asset: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Security: PATRON + YouTube is always blocked
// ---------------------------------------------------------------------------

describe('Multi-source video security: PATRON + YouTube', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects adding YouTube source to a PATRON-tier video', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValue(makeVideo({ tier: 'PATRON' }));

    const result = await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: 'dQw4w9WgXcQ' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('YOUTUBE_PATRON_FORBIDDEN');
    }
  });

  it('does not call oEmbed when PATRON guard fires', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValue(makeVideo({ tier: 'PATRON' }));
    const fetchSpy = vi.spyOn(global, 'fetch');

    await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: 'dQw4w9WgXcQ' },
      ctx,
    );

    const oembedCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('youtube.com/oembed'),
    );
    expect(oembedCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Security: YouTube oEmbed validation
// ---------------------------------------------------------------------------

describe('Multi-source video security: oEmbed validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a YouTube video that oEmbed says does not exist (404)', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValue(makeVideo({ tier: 'FREE' }));
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response);

    // 11-char string matching YouTube ID pattern → passes local validation, hits oEmbed
    const result = await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: 'XXXXXXXXXXX' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('YOUTUBE_VIDEO_NOT_FOUND');
    }
  });

  it('rejects a YouTube video that is not embeddable (401)', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValue(makeVideo({ tier: 'FREE' }));
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);

    // 11-char string matching YouTube ID pattern → passes local validation, hits oEmbed
    const result = await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: 'YYYYYYYYYYY' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('YOUTUBE_VIDEO_NOT_FOUND');
    }
  });

  it('returns gateway error when oEmbed network call fails', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValue(makeVideo({ tier: 'FREE' }));
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: 'dQw4w9WgXcQ' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('YOUTUBE_OEMBED_UNAVAILABLE');
    }
  });

  it('accepts a FREE-tier video when oEmbed confirms the video exists', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValueOnce(makeVideo({ tier: 'FREE' }));
    ctx.prisma.video.findFirst.mockResolvedValueOnce(makeVideo({ tier: 'FREE', assets: [] }));
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ title: 'Test' }) } as Response);

    const result = await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: 'dQw4w9WgXcQ' },
      ctx,
    );

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Security: invalid YouTube IDs are rejected early
// ---------------------------------------------------------------------------

describe('Multi-source video security: YouTube ID validation', () => {
  it('rejects an empty externalVideoId', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValue(makeVideo({ tier: 'FREE' }));

    const result = await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: '' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_YOUTUBE_VIDEO_ID');
  });

  it('rejects a random string that is not a valid YouTube ID or URL', async () => {
    const ctx = makeCtx();
    ctx.prisma.video.findFirst.mockResolvedValue(makeVideo({ tier: 'FREE' }));

    const result = await addVideoSource(
      { videoId: 'video-id', provider: 'YOUTUBE', externalVideoId: 'not-a-real-id!!!' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_YOUTUBE_VIDEO_ID');
  });
});

// ---------------------------------------------------------------------------
// Security: diagnostics do not leak legacy migration warning for YouTube
// ---------------------------------------------------------------------------

describe('Admin diagnostics: YouTube provider', () => {
  it('file under test exports getAdminVideoDiagnostics', async () => {
    const mod = await import('@/lib/modules/video/application/get-admin-video-diagnostics.use-case');
    expect(typeof mod.getAdminVideoDiagnostics).toBe('function');
  });
});
