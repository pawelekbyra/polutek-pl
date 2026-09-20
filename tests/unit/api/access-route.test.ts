import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/access/route';
import { getActorFromAuth } from '@/lib/api/auth';
import { checkVideoAccess } from '@/lib/modules/access';
import { AccessTier } from '@prisma/client';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/access${query}`);
}

describe('GET /api/access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
  });

  it('returns 400 without resolving an actor when videoId is missing', async () => {
    const res = await GET(makeRequest(''));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'Missing videoId' });
    expect(getActorFromAuth).not.toHaveBeenCalled();
    expect(checkVideoAccess).not.toHaveBeenCalled();
  });

  it('resolves the actor (allowing guests) and forwards videoId to checkVideoAccess', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as any);

    await GET(makeRequest('?videoId=vid_1'));

    expect(getActorFromAuth).toHaveBeenCalled();
    expect(checkVideoAccess).toHaveBeenCalledWith({ videoIdOrSlug: 'vid_1' }, expect.anything());
  });

  it('returns the raw access decision with a 200 status when access is granted', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } } as any);

    const res = await GET(makeRequest('?videoId=vid_1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ hasAccess: true });
  });

  it('still returns 200 with the denial reason/tier when access is denied (not an HTTP error)', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: AccessTier.PATRON },
    } as any);

    const res = await GET(makeRequest('?videoId=vid_1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: AccessTier.PATRON });
  });

  it('returns a 500 if checkVideoAccess throws unexpectedly', async () => {
    vi.mocked(checkVideoAccess).mockRejectedValue(new Error('db down'));

    const res = await GET(makeRequest('?videoId=vid_1'));

    expect(res.status).toBe(500);
  });

  it('returns a 500 if getActorFromAuth throws (e.g. malformed session)', async () => {
    vi.mocked(getActorFromAuth).mockRejectedValue(new Error('bad session'));

    const res = await GET(makeRequest('?videoId=vid_1'));

    expect(res.status).toBe(500);
    expect(checkVideoAccess).not.toHaveBeenCalled();
  });
});
