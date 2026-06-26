import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThumbnailResponseService } from '@/lib/services/storage/thumbnail-response.service';
import { MediaPolicy } from '@/lib/modules/media';
import { head } from '@vercel/blob';

vi.mock('@vercel/blob', () => ({
  head: vi.fn(),
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

  it('redirects for non-blob allowed external URLs', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const url = 'https://images.unsplash.com/photo-123';
    const res = await ThumbnailResponseService.getThumbnailResponse('v1', url);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(url);
  });

  it('streams allowed Vercel Blob URLs', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const blobUrl = 'https://my-store.public.blob.vercel-storage.com/img.webp';

    vi.mocked(head).mockResolvedValue({ contentType: 'image/webp', size: 100 } as any);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'image/webp', 'Content-Length': '100' }),
      body: new ReadableStream(),
    } as any);

    const res = await ThumbnailResponseService.getThumbnailResponse('v1', blobUrl);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
  });

  it('returns 502 if Vercel Blob fetch fails', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const blobUrl = 'https://my-store.public.blob.vercel-storage.com/img.webp';

    vi.mocked(head).mockResolvedValue({ contentType: 'image/webp' } as any);
    vi.mocked(fetch).mockResolvedValue({ ok: false } as any);

    const res = await ThumbnailResponseService.getThumbnailResponse('v1', blobUrl);
    expect(res.status).toBe(502);
  });
});
