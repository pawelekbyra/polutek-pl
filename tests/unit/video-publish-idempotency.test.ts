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

const mockPrisma: any = {
  video: {
    findUnique: vi.fn(),
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
