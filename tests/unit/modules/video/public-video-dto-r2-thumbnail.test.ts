import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccessTier, VideoStatus } from '@prisma/client';
import { toPublicVideoDto } from '@/lib/modules/video/domain/video.dto';

const ENV = {
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: 'priv',
  NEXT_PUBLIC_R2_PUBLIC_HOST: 'cdn.example.com',
};

const base = {
  id: 'v1',
  slug: 'video-1',
  title: 'Video 1',
  tier: AccessTier.PUBLIC,
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  thumbnailUrl: 'https://acct.r2.cloudflarestorage.com/priv/videos/v1/covers/abc.webp',
  thumbnailPublicUrl: 'https://cdn.example.com/videos/v1/covers/abc.webp',
};

describe('toPublicVideoDto thumbnail source', () => {
  const saved = { ...process.env };
  beforeEach(() => { Object.assign(process.env, ENV); });
  afterEach(() => { process.env = { ...saved }; });

  it('points a published video straight at the public R2 copy', () => {
    const dto = toPublicVideoDto({ ...base, status: VideoStatus.PUBLISHED } as any);
    expect(dto.thumbnailUrl).toBe('https://cdn.example.com/videos/v1/covers/abc.webp');
  });

  it('keeps drafts on the admin-gated proxy and never leaks the private storage URL', () => {
    const dto = toPublicVideoDto({ ...base, status: VideoStatus.DRAFT } as any);
    expect(dto.thumbnailUrl).toBe('/api/videos/v1/thumbnail');
    expect(JSON.stringify(dto)).not.toContain('r2.cloudflarestorage.com');
  });
});
