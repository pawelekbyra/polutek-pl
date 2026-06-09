import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/videos/[id]/playback-event/route';
import { NextRequest } from 'next/server';
import { checkVideoAccess } from '@/lib/modules/access';
import { getActorFromAuth } from '@/lib/api/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  setNxEx: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    videoPlaybackSession: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    videoPlaybackEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    videoView: {
      create: vi.fn().mockResolvedValue({}),
    },
    video: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((p) => Promise.all(p)),
  },
}));

describe('Playback-Event Route Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createReq = (body: any) => new NextRequest('http://localhost/api/videos/v1/playback-event', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  it('denies event if access is denied', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (checkVideoAccess as any).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED' },
    });

    const res = await POST(createReq({ type: 'PLAY_STARTED' }), { params: { id: 'v1' } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('ACCESS_DENIED');

    expect(prisma.videoPlaybackEvent.create).not.toHaveBeenCalled();
  });

  it('allows event if access is granted', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (checkVideoAccess as any).mockResolvedValue({
      ok: true,
      data: { hasAccess: true }
    });

    const res = await POST(createReq({ type: 'PLAYER_READY' }), { params: { id: 'v1' } });
    expect(res.status).toBe(200);
    expect(prisma.videoPlaybackEvent.create).toHaveBeenCalled();
  });

  it('records view only on WATCHED_10_SECONDS if access allowed', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'user', userId: 'u1' });
    (checkVideoAccess as any).mockResolvedValue({
      ok: true,
      data: { hasAccess: true }
    });
    (prisma.videoPlaybackSession.findUnique as any).mockResolvedValue({
        id: 's1',
        videoId: 'v1',
        userId: 'u1',
        createdAt: new Date(),
    });

    const res = await POST(createReq({ type: 'WATCHED_10_SECONDS', sessionId: 's1' }), { params: { id: 'v1' } });
    expect(res.status).toBe(200);
    expect(prisma.videoView.create).toHaveBeenCalled();
  });
});
