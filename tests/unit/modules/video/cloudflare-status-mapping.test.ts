import { describe, it, expect } from 'vitest';
import { mapCloudflareStateToProcessingState, VIDEO_ASSET_PROCESSING_STATE } from '@/lib/modules/video/domain/video-asset.constants';

describe('mapCloudflareStateToProcessingState', () => {
  it('maps pendingupload to UPLOADING', () => {
    expect(mapCloudflareStateToProcessingState('pendingupload')).toBe(VIDEO_ASSET_PROCESSING_STATE.UPLOADING);
  });

  it('maps downloading to UPLOADING', () => {
    expect(mapCloudflareStateToProcessingState('downloading')).toBe(VIDEO_ASSET_PROCESSING_STATE.UPLOADING);
  });

  it('maps queued to PROCESSING', () => {
    expect(mapCloudflareStateToProcessingState('queued')).toBe(VIDEO_ASSET_PROCESSING_STATE.PROCESSING);
  });

  it('maps processing to PROCESSING', () => {
    expect(mapCloudflareStateToProcessingState('processing')).toBe(VIDEO_ASSET_PROCESSING_STATE.PROCESSING);
  });

  it('maps ready to READY', () => {
    expect(mapCloudflareStateToProcessingState('ready')).toBe(VIDEO_ASSET_PROCESSING_STATE.READY);
  });

  it('maps error to FAILED', () => {
    expect(mapCloudflareStateToProcessingState('error')).toBe(VIDEO_ASSET_PROCESSING_STATE.FAILED);
  });

  it('maps failed to FAILED', () => {
    expect(mapCloudflareStateToProcessingState('failed')).toBe(VIDEO_ASSET_PROCESSING_STATE.FAILED);
  });

  it('maps unknown states to PROCESSING', () => {
    expect(mapCloudflareStateToProcessingState('some-future-state')).toBe(VIDEO_ASSET_PROCESSING_STATE.PROCESSING);
  });
});
