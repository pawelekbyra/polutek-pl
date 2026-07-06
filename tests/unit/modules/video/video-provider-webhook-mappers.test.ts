import { describe, expect, it } from 'vitest';
import { StorageProvider } from '@prisma/client';
import { normalizeCloudflareStreamWebhook, normalizeMuxWebhook } from '@/lib/modules/video/infrastructure/provider-webhook-mappers';

describe('provider webhook mappers', () => {
  it('maps Cloudflare ready, failed and unknown-with-uid events', () => {
    expect(normalizeCloudflareStreamWebhook({ id: 'evt-1', type: 'ready', uid: 'cf-asset' })).toMatchObject({
      provider: StorageProvider.CLOUDFLARE_STREAM,
      externalEventId: 'evt-1',
      providerAssetId: 'cf-asset',
      state: 'READY',
    });
    expect(normalizeCloudflareStreamWebhook({ id: 'evt-2', status: { state: 'failed' }, result: { uid: 'cf-asset' }, error: 'boom' })).toMatchObject({
      state: 'FAILED',
      failureReason: 'boom',
    });
    expect(normalizeCloudflareStreamWebhook({ name: 'mystery', uid: 'cf-asset' })).toMatchObject({ state: 'PROCESSING', providerAssetId: 'cf-asset' });
  });

  it('maps Mux asset and upload events defensively', () => {
    expect(normalizeMuxWebhook({ id: 'evt-1', type: 'video.asset.ready', data: { id: 'mux-asset' } })).toMatchObject({
      provider: StorageProvider.MUX,
      externalEventId: 'evt-1',
      providerAssetId: 'mux-asset',
      state: 'READY',
    });
    expect(normalizeMuxWebhook({ id: 'evt-2', type: 'video.asset.errored', data: { id: 'mux-asset', errors: { messages: ['bad input'] } } })).toMatchObject({
      state: 'FAILED',
      failureReason: 'bad input',
    });
    expect(normalizeMuxWebhook({ id: 'evt-3', type: 'video.upload.asset_created', data: { id: 'upload-1', asset_id: 'mux-asset' } })).toMatchObject({
      providerUploadId: 'upload-1',
      providerAssetId: 'mux-asset',
      state: 'PROCESSING',
    });
  });

  it('ignores unknown provider events without provider ids', () => {
    expect(normalizeCloudflareStreamWebhook({ type: 'surprise' })).toMatchObject({ state: 'IGNORED' });
    expect(normalizeMuxWebhook({ type: 'surprise', data: {} })).toMatchObject({ state: 'IGNORED' });
  });
});
