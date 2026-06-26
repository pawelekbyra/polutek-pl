import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThumbnailResponseService } from '@/lib/services/storage/thumbnail-response.service';
import { MediaPolicy } from '@/lib/modules/media';
import { get } from '@vercel/blob';

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
}));

vi.mock('@/lib/modules/media', () => ({
  MediaPolicy: {
    isAllowedThumbnailUrl: vi.fn(),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('ThumbnailResponseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks unauthorized hosts', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(false);
    const res = await ThumbnailResponseService.getThumbnailResponse('v1', 'https://evil.com/img.jpg');
    expect(res.status).toBe(403);
  });

  it('streams for allowed external URLs', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const url = 'https://images.unsplash.com/photo-123';

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'image/jpeg', 'Content-Length': '1000' }),
      body: new ReadableStream(),
    } as any);

    const res = await ThumbnailResponseService.getThumbnailResponse('v1', url);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('streams allowed Vercel Blob URLs using private access', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const blobUrl = 'https://my-store.public.blob.vercel-storage.com/img.webp';

    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream(),
      headers: new Headers({ 'Content-Type': 'image/webp', 'Content-Length': '100' }),
    } as any);

    const res = await ThumbnailResponseService.getThumbnailResponse('v1', blobUrl);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(get).toHaveBeenCalledWith(blobUrl, { access: 'private' });
  });

  it('handles Vercel Blob 304 Not Modified', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const blobUrl = 'https://my-store.public.blob.vercel-storage.com/img.webp';

    vi.mocked(get).mockResolvedValue({
      statusCode: 304,
      stream: null,
      headers: new Headers({ 'ETag': '"abc"' }),
    } as any);

    const res = await ThumbnailResponseService.getThumbnailResponse('v1', blobUrl);
    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe('"abc"');
  });

  it('returns 502 if Vercel Blob fetch fails', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const blobUrl = 'https://my-store.public.blob.vercel-storage.com/img.webp';

    vi.mocked(get).mockRejectedValue(new Error('Vercel Blob Error'));

    const res = await ThumbnailResponseService.getThumbnailResponse('v1', blobUrl);
    expect(res.status).toBe(502);
  });
});
