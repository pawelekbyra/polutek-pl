import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/media/[...path]/route';
import { NextRequest } from 'next/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { getActorFromAuth } from '@/lib/api/auth';
import { getGatedMedia } from '@/lib/modules/media';
import { prisma } from '@/lib/prisma';
import { ok, fail } from '@/lib/modules/shared/result';
import { MediaSourceNotFoundError } from '@/lib/modules/media/domain/media.errors';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/blob', () => ({
  getGatedBlobResponse: vi.fn().mockResolvedValue({ status: 200 }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/modules/media', () => ({
    getGatedMedia: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Media Proxy Route Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_LEGACY_PRIVATE_FALLBACK;
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ tier: 'PUBLIC', asset: null } as any);
  });

  const createReq = () => new NextRequest('http://localhost/api/media/v1');

  it('calls getGatedBlobResponse with userId if found', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'u1' });
    (getGatedMedia as any).mockResolvedValue(ok({
      id: 'v1',
      videoUrl: 'https://blob.com/v1.mp4'
    }));

    await GET(createReq(), { params: { path: ['v1'] } });
    expect(prisma.video.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      select: {
        tier: true,
        asset: {
          select: {
            provider: true,
            processingState: true,
            isPrimary: true,
          },
        },
      },
    });
    expect(getGatedBlobResponse).toHaveBeenCalledWith('u1', 'v1', 'https://blob.com/v1.mp4', expect.anything());
  });

  it('blocks direct media proxy access for patron legacy fallback without a READY provider asset', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'patron-user' });
    (getGatedMedia as any).mockResolvedValue(ok({
      id: 'patron-video',
      videoUrl: 'https://blob.com/private.mp4'
    }));
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ tier: 'PATRON', asset: null } as any);

    const res = await GET(createReq(), { params: { path: ['patron-video'] } });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('NO_PRIMARY_ASSET');
    expect(getGatedBlobResponse).not.toHaveBeenCalled();
  });

  it('keeps direct media proxy behavior unchanged for public legacy videos', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (getGatedMedia as any).mockResolvedValue(ok({
      id: 'public-video',
      videoUrl: 'https://blob.com/public.mp4'
    }));
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ tier: 'PUBLIC', asset: null } as any);

    await GET(createReq(), { params: { path: ['public-video'] } });

    expect(getGatedBlobResponse).toHaveBeenCalledWith(null, 'public-video', 'https://blob.com/public.mp4', expect.anything());
  });

  it('handles missing video correctly', async () => {
      (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
      (getGatedMedia as any).mockResolvedValue(fail(new MediaSourceNotFoundError('missing')));

      const res = await GET(createReq(), { params: { path: ['missing'] } });
      expect(res.status).toBe(404);
  });
});
