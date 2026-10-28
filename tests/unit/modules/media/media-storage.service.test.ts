import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaStorageService } from '@/lib/modules/media/infrastructure/media-storage.service';

const deletePrivate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/modules/media/infrastructure/r2-thumbnail-storage.client', () => ({
  R2ThumbnailStorageClient: class {
    deletePrivate = deletePrivate;
  },
}));

describe('MediaStorageService.deleteOwnedThumbnail', () => {
  const ownUrl = 'https://acct.r2.cloudflarestorage.com/priv/videos/v1/covers/uuid.webp';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CLOUDFLARE_R2_ACCOUNT_ID', 'acct');
    vi.stubEnv('CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE', 'priv');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('deletes a thumbnail from the private R2 bucket', async () => {
    deletePrivate.mockResolvedValue(undefined);
    expect(await MediaStorageService.deleteOwnedThumbnail(ownUrl)).toBe(true);
    expect(deletePrivate).toHaveBeenCalledWith('videos/v1/covers/uuid.webp');
  });

  it('leaves external hosts (including legacy Blob URLs) alone', async () => {
    expect(await MediaStorageService.deleteOwnedThumbnail('https://x.public.blob.vercel-storage.com/a.jpg')).toBe(false);
    expect(await MediaStorageService.deleteOwnedThumbnail('https://external-host.com/image.jpg')).toBe(false);
    expect(deletePrivate).not.toHaveBeenCalled();
  });

  it('returns false for an empty url', async () => {
    expect(await MediaStorageService.deleteOwnedThumbnail('')).toBe(false);
    expect(deletePrivate).not.toHaveBeenCalled();
  });

  it('returns false and logs on deletion failure', async () => {
    deletePrivate.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await MediaStorageService.deleteOwnedThumbnail(ownUrl)).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
