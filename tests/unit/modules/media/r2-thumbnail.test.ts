import { describe, it, expect } from 'vitest';
import {
  buildThumbnailObjectKey,
  buildPrivateThumbnailStorageUrl,
  buildPublicThumbnailUrl,
  parsePrivateThumbnailStorageUrl,
  parsePublicThumbnailUrl,
  resolvePublicThumbnailSrc,
} from '@/lib/modules/media/domain/r2-thumbnail';

const env = {
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct123',
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: 'thumbs-private',
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC: 'thumbs',
  NEXT_PUBLIC_R2_PUBLIC_HOST: 'https://cdn.example.com',
};

const key = 'videos/v1/covers/abc123.webp';
const privateUrl = buildPrivateThumbnailStorageUrl('acct123', 'thumbs-private', key);
const publicUrl = buildPublicThumbnailUrl('cdn.example.com', key);

describe('r2 thumbnail helpers', () => {
  it('builds content-hashed keys and strips unsafe path characters', () => {
    expect(buildThumbnailObjectKey('videos/v1/covers', 'ABC123', 'webp')).toBe(key);
    expect(buildThumbnailObjectKey('videos/../../etc/covers', 'abc', 'png')).toBe('videos/etc/covers/abc.png');
  });

  it('round-trips private storage URLs (absolute, S3 endpoint)', () => {
    expect(privateUrl).toBe('https://acct123.r2.cloudflarestorage.com/thumbs-private/videos/v1/covers/abc123.webp');
    expect(parsePrivateThumbnailStorageUrl(privateUrl, env)).toBe(key);
  });

  it('rejects private URLs for another account/bucket, traversal or query strings', () => {
    expect(parsePrivateThumbnailStorageUrl('https://other.r2.cloudflarestorage.com/thumbs-private/a.webp', env)).toBeNull();
    expect(parsePrivateThumbnailStorageUrl('https://acct123.r2.cloudflarestorage.com/thumbs/a.webp', env)).toBeNull();
    // `..` is resolved by the URL parser, so it can't climb out of the bucket prefix.
    expect(parsePrivateThumbnailStorageUrl('https://acct123.r2.cloudflarestorage.com/thumbs-private/%2E%2E/thumbs/a.webp', env)).toBeNull();
    expect(parsePrivateThumbnailStorageUrl(`${privateUrl}?X-Amz-Signature=x`, env)).toBeNull();
    expect(parsePrivateThumbnailStorageUrl(privateUrl, {})).toBeNull();
  });

  it('parses public URLs only on the configured host', () => {
    expect(parsePublicThumbnailUrl(publicUrl, env)).toBe(key);
    expect(parsePublicThumbnailUrl('https://evil.example.com/videos/v1/covers/abc123.webp', env)).toBeNull();
  });
});

describe('resolvePublicThumbnailSrc', () => {
  const published = { id: 'v1', status: 'PUBLISHED', thumbnailUrl: privateUrl, thumbnailPublicUrl: publicUrl };

  it('serves a published video straight from the public R2 host', () => {
    expect(resolvePublicThumbnailSrc(published, env)).toBe(publicUrl);
  });

  it('never exposes a public URL for a draft, even if the column is stale', () => {
    expect(resolvePublicThumbnailSrc({ ...published, status: 'DRAFT' }, env)).toBe('/api/videos/v1/thumbnail');
    expect(resolvePublicThumbnailSrc({ ...published, status: 'ARCHIVED' }, env)).toBe('/api/videos/v1/thumbnail');
  });

  it('falls back to the proxy when the public copy is out of date or missing', () => {
    const newCover = buildPrivateThumbnailStorageUrl('acct123', 'thumbs-private', 'videos/v1/covers/def456.webp');
    expect(resolvePublicThumbnailSrc({ ...published, thumbnailUrl: newCover }, env)).toBe('/api/videos/v1/thumbnail');
    expect(resolvePublicThumbnailSrc({ ...published, thumbnailPublicUrl: null }, env)).toBe('/api/videos/v1/thumbnail');
  });

  it('keeps legacy Blob thumbnails and unconfigured environments on the proxy', () => {
    expect(resolvePublicThumbnailSrc({ ...published, thumbnailUrl: 'https://x.public.blob.vercel-storage.com/a.webp' }, env)).toBe('/api/videos/v1/thumbnail');
    expect(resolvePublicThumbnailSrc(published, {})).toBe('/api/videos/v1/thumbnail');
  });
});
