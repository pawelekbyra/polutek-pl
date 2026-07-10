import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/videos/[id]/thumbnail/route';
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { ThumbnailResponseService, resolveVideoThumbnailUrl } from '@/lib/modules/media';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/shared/app-context', () => ({
  createAppContext: vi.fn(),
}));

vi.mock('@/lib/modules/media', () => ({
  ThumbnailResponseService: {
    getThumbnailResponse: vi.fn(),
  },
  PUBLIC_THUMBNAIL_CACHE_CONTROL: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  PRIVATE_THUMBNAIL_CACHE_CONTROL: 'private, max-age=300',
  resolveVideoThumbnailUrl: vi.fn((url: string | null | undefined) => Promise.resolve(url ?? null)),
}));

describe('GET /api/videos/[videoId]/thumbnail', () => {
  const mockPrisma = {
    video: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAppContext).mockReturnValue({
        prisma: mockPrisma,
    } as any);
  });

  it('allows public access to published video thumbnail', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    mockPrisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      thumbnailUrl: 'https://images.unsplash.com/photo-123',
      status: 'PUBLISHED',
    });

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    await GET(req, { params: Promise.resolve({ id: 'v1' }) });

    expect(ThumbnailResponseService.getThumbnailResponse).toHaveBeenCalledWith(
      'v1',
      'https://images.unsplash.com/photo-123',
      expect.stringContaining('s-maxage')
    );
  });

  it('restricts access to draft video thumbnail for guests', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    mockPrisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      thumbnailUrl: 'https://images.unsplash.com/photo-123',
      status: 'DRAFT',
    });

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    const res = await GET(req, { params: Promise.resolve({ id: 'v1' }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Forbidden/);
  });

  it('allows admin access to draft video thumbnail', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'admin', userId: 'a1' } as any);
    mockPrisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      thumbnailUrl: 'https://images.unsplash.com/photo-123',
      status: 'DRAFT',
    });

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    await GET(req, { params: Promise.resolve({ id: 'v1' }) });

    expect(ThumbnailResponseService.getThumbnailResponse).toHaveBeenCalledWith(
      'v1',
      'https://images.unsplash.com/photo-123',
      expect.stringContaining('private')
    );
  });

  it('returns 404 if video or thumbnail missing', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    mockPrisma.video.findUnique.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    const res = await GET(req, { params: Promise.resolve({ id: 'v1' }) });

    expect(res.status).toBe(404);
  });

  it('treats a self-referential stored thumbnailUrl as absent instead of redirect-looping', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    mockPrisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      thumbnailUrl: '/api/videos/v1/thumbnail',
      status: 'PUBLISHED',
    });

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    await GET(req, { params: Promise.resolve({ id: 'v1' }) });

    expect(resolveVideoThumbnailUrl).toHaveBeenCalledWith(null);
  });
});
