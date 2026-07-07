import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attemptPublishAfterAssetReady } from '../../lib/modules/video/application/publish-after-asset-ready.use-case';
import { publishAdminVideo } from '../../lib/modules/video/application/publish-admin-video.use-case';
import { recordAuditEvent } from '../../lib/modules/audit';

vi.mock('../../lib/modules/video/application/publish-admin-video.use-case', () => ({
  publishAdminVideo: vi.fn()
}));

vi.mock('../../lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({})
}));

vi.mock('../../lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: 'main-channel-id' }),
  },
}));

const readyRouteVideo = {
  id: 'placeholder',
  title: 'Placeholder',
  slug: 'placeholder',
  tier: 'PUBLIC',
  status: 'DRAFT',
  activePlaybackRoute: {
    asset: { provider: 'CLOUDFLARE_STREAM', processingState: 'READY', providerAssetId: 'cf-uid' },
  },
};

const noRouteVideo = {
  id: 'placeholder',
  title: 'Placeholder',
  slug: 'placeholder',
  tier: 'PUBLIC',
  status: 'DRAFT',
  activePlaybackRoute: null,
};

const mockPrisma: any = {
  video: {
    findUnique: vi.fn(),
    // Backs VideoRepository.findByIdForMainChannel(), consulted by
    // VideoPolicy.getPublicationBlockers() to decide readiness. Default: a ready active
    // playback route exists, so publication is allowed to proceed.
    findFirst: vi.fn().mockResolvedValue(readyRouteVideo),
    update: vi.fn()
  },
  $transaction: vi.fn((cb) => cb(mockPrisma))
};

const mockCtx: any = {
  prisma: mockPrisma,
  actor: { type: 'admin', userId: 'admin-id' }
};

describe('attemptPublishAfterAssetReady Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.video.findFirst.mockResolvedValue(readyRouteVideo);
  });

  it('should not record redundant audit logs for the same failure', async () => {
    const videoId = 'video-123';
    const errorMessage = 'Podaj tytuł przed publikacją filmu.';

    // First call: fail with error
    mockPrisma.video.findUnique.mockResolvedValueOnce({
      id: videoId,
      status: 'DRAFT',
      publishAfterAssetReady: true,
      publishAfterAssetReadyCompletedAt: null
    });

    vi.mocked(publishAdminVideo).mockResolvedValueOnce({
      ok: false,
      error: { message: errorMessage, code: 'VIDEO_NOT_READY_FOR_PUBLICATION' }
    });

    // Mock current status check in attemptPublishAfterAssetReady (it calls findUnique again after publishAdminVideo fails)
    mockPrisma.video.findUnique.mockResolvedValueOnce({
      publishAfterAssetReadyError: null
    });

    await attemptPublishAfterAssetReady(videoId, mockCtx);

    expect(mockPrisma.video.update).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'VIDEO_PUBLISH_AFTER_ASSET_READY_FAILED',
      metadata: expect.objectContaining({ error: errorMessage })
    }), expect.anything());

    // Second call: same error
    vi.clearAllMocks();
    mockPrisma.video.findFirst.mockResolvedValue(readyRouteVideo);

    mockPrisma.video.findUnique.mockResolvedValueOnce({
      id: videoId,
      status: 'DRAFT',
      publishAfterAssetReady: true,
      publishAfterAssetReadyCompletedAt: null
    });

    vi.mocked(publishAdminVideo).mockResolvedValueOnce({
      ok: false,
      error: { message: errorMessage, code: 'VIDEO_NOT_READY_FOR_PUBLICATION' }
    });

    // Mock current status check: it already has the same error
    mockPrisma.video.findUnique.mockResolvedValueOnce({
      publishAfterAssetReadyError: errorMessage
    });

    await attemptPublishAfterAssetReady(videoId, mockCtx);

    // Should NOT update and NOT record audit event
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('should record audit log if error message changes', async () => {
    const videoId = 'video-123';
    const oldError = 'Old error';
    const newError = 'New error';

    mockPrisma.video.findUnique.mockResolvedValueOnce({
      id: videoId,
      status: 'DRAFT',
      publishAfterAssetReady: true,
      publishAfterAssetReadyCompletedAt: null
    });

    vi.mocked(publishAdminVideo).mockResolvedValueOnce({
      ok: false,
      error: { message: newError, code: 'VIDEO_NOT_READY_FOR_PUBLICATION' }
    });

    mockPrisma.video.findUnique.mockResolvedValueOnce({
      publishAfterAssetReadyError: oldError
    });

    await attemptPublishAfterAssetReady(videoId, mockCtx);

    expect(mockPrisma.video.update).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'VIDEO_PUBLISH_AFTER_ASSET_READY_FAILED',
      metadata: expect.objectContaining({ error: newError })
    }), expect.anything());
  });
});

describe('attemptPublishAfterAssetReady is provider-agnostic (readiness-driven)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.video.findFirst.mockResolvedValue(readyRouteVideo);
  });

  it('publishes as soon as a READY active playback route exists, regardless of which provider triggered', async () => {
    const videoId = 'video-xyz';
    mockPrisma.video.findUnique.mockResolvedValue({
      id: videoId,
      status: 'DRAFT',
      publishAfterAssetReady: true,
      publishAfterAssetReadyCompletedAt: null,
    });
    vi.mocked(publishAdminVideo).mockResolvedValue({ ok: true } as any);

    // A Cloudflare webhook triggers publication even though (historically) Mux may have been
    // the "preferred" provider — a broken Mux webhook must no longer block a ready Cloudflare asset.
    await attemptPublishAfterAssetReady(videoId, mockCtx, 'cloudflare_stream');

    expect(publishAdminVideo).toHaveBeenCalledWith(videoId, mockCtx);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'VIDEO_PUBLISH_AFTER_ASSET_READY_COMPLETED',
      metadata: expect.objectContaining({ triggeredByProvider: 'cloudflare_stream' }),
    }));
  });

  it('does NOT publish while no active playback route is ready yet', async () => {
    const videoId = 'video-not-ready';
    mockPrisma.video.findUnique.mockResolvedValue({
      id: videoId,
      status: 'DRAFT',
      publishAfterAssetReady: true,
      publishAfterAssetReadyCompletedAt: null,
    });
    mockPrisma.video.findFirst.mockResolvedValue(noRouteVideo); // nothing playable yet

    await attemptPublishAfterAssetReady(videoId, mockCtx, 'mux');

    expect(publishAdminVideo).not.toHaveBeenCalled();
  });
});
