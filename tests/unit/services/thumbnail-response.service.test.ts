import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ThumbnailResponseService,
  PUBLIC_THUMBNAIL_CACHE_CONTROL,
  PRIVATE_THUMBNAIL_CACHE_CONTROL,
} from '@/lib/modules/media/infrastructure/thumbnail-response.service';
import { MediaPolicy } from '@/lib/modules/media';
import { get } from '@vercel/blob';

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
}));

const r2Get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/modules/media/infrastructure/r2-thumbnail-storage.client', () => ({
  R2ThumbnailStorageClient: class {
    getPrivate = r2Get;
  },
}));

vi.mock('@/lib/modules/media', () => ({
  MediaPolicy: {
    isAllowedThumbnailUrl: vi.fn(),
  },
}));

const originalFetch = global.fetch;

describe('ThumbnailResponseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
    // Default (no cache profile) must be private — never CDN-cacheable.
    expect(res.headers.get('Cache-Control')).toBe(PRIVATE_THUMBNAIL_CACHE_CONTROL);
  });

  it('applies the public CDN cache profile when requested', async () => {
    vi.mocked(MediaPolicy.isAllowedThumbnailUrl).mockReturnValue(true);
    const url = 'https://images.unsplash.com/photo-123';

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      // Origin tries to force its own caching — our policy must win.
      headers: new Headers({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }),
      body: new ReadableStream(),
    } as any);

    const res = await ThumbnailResponseService.getThumbnailResponse('v1', url, PUBLIC_THUMBNAIL_CACHE_CONTROL);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(PUBLIC_THUMBNAIL_CACHE_CONTROL);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage');
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

  describe('private R2 thumbnails', () => {
    const r2Env = {
      CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
      CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: 'priv',
    };
    const r2Url = 'https://acct.r2.cloudflarestorage.com/priv/videos/v1/covers/abc.webp';

    beforeEach(() => {
      Object.assign(process.env, r2Env);
    });

    afterEach(() => {
      delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE;
    });

    it('streams via the authenticated S3 client, never a plain fetch, with the caller cache policy', async () => {
      r2Get.mockResolvedValue({ body: new ReadableStream(), contentType: 'image/webp', contentLength: 42, etag: '"e"' });

      const res = await ThumbnailResponseService.getThumbnailResponse('v1', r2Url, PRIVATE_THUMBNAIL_CACHE_CONTROL);

      expect(res.status).toBe(200);
      expect(r2Get).toHaveBeenCalledWith('videos/v1/covers/abc.webp');
      expect(fetch).not.toHaveBeenCalled();
      expect(MediaPolicy.isAllowedThumbnailUrl).not.toHaveBeenCalled();
      expect(res.headers.get('Content-Type')).toBe('image/webp');
      expect(res.headers.get('Cache-Control')).toBe(PRIVATE_THUMBNAIL_CACHE_CONTROL);
    });

    it('returns 404 when the object is missing and 502 on storage errors', async () => {
      r2Get.mockResolvedValueOnce(null);
      expect((await ThumbnailResponseService.getThumbnailResponse('v1', r2Url)).status).toBe(404);

      r2Get.mockRejectedValueOnce(new Error('R2 down'));
      expect((await ThumbnailResponseService.getThumbnailResponse('v1', r2Url)).status).toBe(502);
    });
  });
});
