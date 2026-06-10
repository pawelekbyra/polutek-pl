import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/videos/[id]/playback-event/route';
import { NextRequest } from 'next/server';
import { checkVideoAccess } from '@/lib/modules/access';
import { getActorFromAuth } from '@/lib/api/auth';
import { rateLimit } from '@/lib/rate-limit';
import { recordPlaybackEventUseCase } from '@/lib/modules/video';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/video', () => ({
  recordPlaybackEventUseCase: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  setNxEx: vi.fn().mockResolvedValue(true),
}));

describe('Playback-Event Route Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createReq = (body: any) => new NextRequest('http://localhost/api/videos/v1/playback-event', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  it('denies event if use case returns error', async () => {
    const { AppError } = await import('@/lib/modules/shared/app-error');
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (recordPlaybackEventUseCase as any).mockResolvedValue({
      ok: false,
      error: new AppError('ACCESS_DENIED', 403, 'ACCESS_DENIED')
    });

    const res = await POST(createReq({ type: 'PLAY_STARTED' }), { params: { id: 'v1' } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('ACCESS_DENIED');
  });

  it('allows event if use case returns success', async () => {
    (getActorFromAuth as any).mockResolvedValue({ type: 'guest' });
    (recordPlaybackEventUseCase as any).mockResolvedValue({
      ok: true,
      data: { success: true }
    });

    const res = await POST(createReq({ type: 'PLAYER_READY' }), { params: { id: 'v1' } });
    expect(res.status).toBe(200);
    expect(recordPlaybackEventUseCase).toHaveBeenCalled();
  });
});
