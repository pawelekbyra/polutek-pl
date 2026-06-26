import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/videos/[videoId]/thumbnail/route';
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromAuth } from '@/lib/api/auth';
import { getGatedBlobResponse } from '@/lib/blob';
import { createAppContext } from '@/lib/modules/shared/app-context';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/blob', () => ({
  getGatedBlobResponse: vi.fn(),
}));

vi.mock('@/lib/modules/shared/app-context', () => ({
  createAppContext: vi.fn(),
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
    await GET(req, { params: Promise.resolve({ videoId: 'v1' }) });

    expect(getGatedBlobResponse).toHaveBeenCalled();
  });

  it('restricts access to draft video thumbnail for guests', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    mockPrisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      thumbnailUrl: 'https://images.unsplash.com/photo-123',
      status: 'DRAFT',
    });

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    const res = await GET(req, { params: Promise.resolve({ videoId: 'v1' }) });

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
    await GET(req, { params: Promise.resolve({ videoId: 'v1' }) });

    expect(getGatedBlobResponse).toHaveBeenCalled();
  });

  it('returns 404 if video or thumbnail missing', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    mockPrisma.video.findUnique.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    const res = await GET(req, { params: Promise.resolve({ videoId: 'v1' }) });

    expect(res.status).toBe(404);
  });

  it('blocks unauthorized hosts', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    mockPrisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      thumbnailUrl: 'https://malicious.com/thumb.jpg',
      status: 'PUBLISHED',
    });

    const req = new NextRequest('http://localhost/api/videos/v1/thumbnail');
    const res = await GET(req, { params: Promise.resolve({ videoId: 'v1' }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized Thumbnail Host/);
  });
});
