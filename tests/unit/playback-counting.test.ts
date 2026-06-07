import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/videos/[id]/playback-event/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { AccessPolicy } from '@/lib/access/access-policy';
import { setNxEx } from '@/lib/rate-limit';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    videoPlaybackSession: {
      findUnique: vi.fn(),
      update: vi.fn().mockReturnValue({ catch: vi.fn() }),
    },
    videoPlaybackEvent: {
      create: vi.fn(),
    },
    videoView: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : Promise.resolve(cb))),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/access/access-policy', () => ({
  AccessPolicy: {
    canViewVideo: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  setNxEx: vi.fn(),
}));

vi.mock('@/lib/media/rate-limit', () => ({
  getMediaClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('Playback Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.videoPlaybackSession.update as any).mockReturnValue({ catch: vi.fn() });
    (prisma.videoPlaybackEvent.create as any).mockResolvedValue({});
    (prisma.videoView.create as any).mockResolvedValue({});
  });

  it('returns 400 for invalid event type', async () => {
    (auth as any).mockResolvedValue({ userId: 'user_1' });
    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({ type: 'INVALID_TYPE' }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('INVALID_EVENT_TYPE');
  });

  it('requires session for WATCHED_10_SECONDS', async () => {
    (auth as any).mockResolvedValue({ userId: 'user_1' });
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'vid_1' });
    (AccessPolicy.canViewVideo as any).mockResolvedValue({ allowed: true });

    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({ type: 'WATCHED_10_SECONDS' }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('SESSION_REQUIRED');
  });

  it('denies access if AccessPolicy says no', async () => {
    (auth as any).mockResolvedValue({ userId: 'user_1' });
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'vid_1' });
    (AccessPolicy.canViewVideo as any).mockResolvedValue({ allowed: false, reason: 'PATRON_REQUIRED' });

    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({ type: 'PLAY_STARTED', sessionId: 'sess_1' }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('ACCESS_DENIED');
  });

  it('counts view for WATCHED_10_SECONDS with valid session', async () => {
    (auth as any).mockResolvedValue({ userId: 'user_1' });
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'vid_1' });
    (AccessPolicy.canViewVideo as any).mockResolvedValue({ allowed: true });
    (prisma.videoPlaybackSession.findUnique as any).mockResolvedValue({
      id: 'sess_1',
      videoId: 'vid_1',
      userId: 'user_1',
      countedAsView: false,
      isAdminPreview: false,
      createdAt: new Date(),
    });
    (setNxEx as any).mockResolvedValue(true);

    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({ type: 'WATCHED_10_SECONDS', sessionId: 'sess_1' }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(200);
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'vid_1' },
      data: { views: { increment: 1 } }
    }));
  });

  it('does not count view for admin preview', async () => {
    (auth as any).mockResolvedValue({ userId: 'admin_1' });
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'vid_1' });
    (AccessPolicy.canViewVideo as any).mockResolvedValue({ allowed: true });
    (prisma.videoPlaybackSession.findUnique as any).mockResolvedValue({
      id: 'sess_1',
      videoId: 'vid_1',
      userId: 'admin_1',
      countedAsView: false,
      isAdminPreview: true,
      createdAt: new Date(),
    });

    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({ type: 'WATCHED_10_SECONDS', sessionId: 'sess_1' }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(200);
    expect(prisma.video.update).not.toHaveBeenCalled();
    expect(prisma.videoView.create).not.toHaveBeenCalled();
  });

  it('deduplicates views in same session', async () => {
    (auth as any).mockResolvedValue({ userId: 'user_1' });
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'vid_1' });
    (AccessPolicy.canViewVideo as any).mockResolvedValue({ allowed: true });
    (prisma.videoPlaybackSession.findUnique as any).mockResolvedValue({
      id: 'sess_1',
      videoId: 'vid_1',
      userId: 'user_1',
      countedAsView: true,
      isAdminPreview: false,
      createdAt: new Date(),
    });

    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({ type: 'WATCHED_10_SECONDS', sessionId: 'sess_1' }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(200);
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it('throttles PROGRESS events within 10 seconds', async () => {
    (auth as any).mockResolvedValue({ userId: 'user_1' });
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'vid_1' });
    (AccessPolicy.canViewVideo as any).mockResolvedValue({ allowed: true });

    const now = new Date();
    (prisma.videoPlaybackSession.findUnique as any).mockResolvedValue({
      id: 'sess_1',
      videoId: 'vid_1',
      userId: 'user_1',
      lastHeartbeatAt: now,
      createdAt: now,
    });

    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({ type: 'PROGRESS', sessionId: 'sess_1' }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.throttled).toBe(true);
    expect(prisma.videoPlaybackEvent.create).not.toHaveBeenCalled();
  });

  it('sanitizes sensitive metadata', async () => {
    (auth as any).mockResolvedValue({ userId: 'user_1' });
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'vid_1' });
    (AccessPolicy.canViewVideo as any).mockResolvedValue({ allowed: true });
    (prisma.videoPlaybackSession.findUnique as any).mockResolvedValue({
      id: 'sess_1',
      videoId: 'vid_1',
      userId: 'user_1',
      createdAt: new Date(Date.now() - 20000),
    });

    const req = new NextRequest('http://localhost/api/videos/vid_1/playback-event', {
      method: 'POST',
      body: JSON.stringify({
        type: 'PLAYER_READY',
        sessionId: 'sess_1',
        metadata: {
            playbackUrl: 'http://secret.com/video.mp4',
            token: 'secret-token',
            visibleKey: 'visible-value'
        }
      }),
    });

    const res = await POST(req, { params: { id: 'vid_1' } });
    expect(res.status).toBe(200);
    expect(prisma.videoPlaybackEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            metadata: {
                visibleKey: 'visible-value'
            }
        })
    }));
  });
});
