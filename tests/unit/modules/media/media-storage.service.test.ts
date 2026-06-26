import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaStorageService } from '@/lib/modules/media/infrastructure/media-storage.service';
import { del } from '@vercel/blob';

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
}));

describe('MediaStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST = 'test-blob.public';
  });

  it('deletes blob if it matches owned host', async () => {
    const url = 'https://test-blob.public/videos/v1/covers/uuid.webp';
    const result = await MediaStorageService.deleteOwnedBlob(url);

    expect(result).toBe(true);
    expect(del).toHaveBeenCalledWith(url);
  });

  it('returns false and does not delete if host does not match', async () => {
    const url = 'https://external-host.com/image.jpg';
    const result = await MediaStorageService.deleteOwnedBlob(url);

    expect(result).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns false for empty url', async () => {
    const result = await MediaStorageService.deleteOwnedBlob('');
    expect(result).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns false and logs error on deletion failure', async () => {
    const url = 'https://test-blob.public/videos/v1/covers/uuid.webp';
    vi.mocked(del).mockRejectedValue(new Error('Deletion failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await MediaStorageService.deleteOwnedBlob(url);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
