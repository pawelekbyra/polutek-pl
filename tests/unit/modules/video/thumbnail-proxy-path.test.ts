import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { isThumbnailProxyPath } from '@/lib/modules/video/application/update-admin-video.use-case';

describe('isThumbnailProxyPath', () => {
  it('recognises the proxy path and only that', () => {
    expect(isThumbnailProxyPath('/api/videos/5ab531a4-54ad-4d4e-8c92-870fd42f445e/thumbnail')).toBe(true);
    expect(isThumbnailProxyPath('/api/videos/abc/thumbnail?v=2')).toBe(true);
    expect(isThumbnailProxyPath('https://acc.r2.cloudflarestorage.com/bucket/videos/x/covers/h.webp')).toBe(false);
    expect(isThumbnailProxyPath('https://thumbs.pawelperfect.pl/videos/x/covers/h.webp')).toBe(false);
    expect(isThumbnailProxyPath('/logo.png')).toBe(false);
    expect(isThumbnailProxyPath('')).toBe(false);
    expect(isThumbnailProxyPath(undefined)).toBe(false);
  });
});
