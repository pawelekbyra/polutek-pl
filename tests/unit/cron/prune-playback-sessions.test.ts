import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/prune-playback-sessions/route';
import { pruneStalePlaybackSessions } from '@/lib/modules/video';

vi.mock('@/lib/modules/video', async () => {
  const actual = await vi.importActual<typeof import('@/lib/modules/video')>('@/lib/modules/video');
  return {
    ...actual,
    pruneStalePlaybackSessions: vi.fn(),
  };
});

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/cron/prune-playback-sessions', {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

describe('GET /api/cron/prune-playback-sessions', () => {
  const CRON_SECRET = 'test_cron_secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(pruneStalePlaybackSessions).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header does not match CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
    expect(pruneStalePlaybackSessions).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is not configured, even with a matching-looking header', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest('Bearer undefined'));
    expect(res.status).toBe(401);
  });

  it('runs the prune use-case and returns its result on a valid request', async () => {
    vi.mocked(pruneStalePlaybackSessions).mockResolvedValue({
      ok: true,
      data: { deletedCount: 42, cutoff: new Date('2026-08-21T00:00:00.000Z') },
    } as any);

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deletedCount).toBe(42);
    expect(pruneStalePlaybackSessions).toHaveBeenCalledWith({}, expect.anything());
  });

  it('returns 500 if the use-case reports a failure', async () => {
    vi.mocked(pruneStalePlaybackSessions).mockResolvedValue({
      ok: false,
      error: new Error('db down'),
    } as any);

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));

    expect(res.status).toBe(500);
  });
});
