import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/videos/[id]/comments/route';
import { listVideoComments } from '@/lib/modules/comments';
import { requireAdminForApi } from '@/lib/auth-utils';

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock('@/lib/modules/comments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/modules/comments')>(
    '@/lib/modules/comments',
  );
  return {
    ...actual,
    listVideoComments: vi.fn(),
  };
});

function makeRequest(videoId: string, query = '') {
  const req = new NextRequest(`http://localhost/api/admin/videos/${videoId}/comments${query}`);
  const props = { params: Promise.resolve({ id: videoId }) };
  return { req, props };
}

describe('GET /api/admin/videos/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin_1',
      response: null,
    } as any);
  });

  it('returns the raw use-case data (no success envelope) on success', async () => {
    const data = { comments: [{ id: 'c1' }], totalCount: 1, nextCursor: null };
    vi.mocked(listVideoComments).mockResolvedValue({ ok: true, data } as any);

    const { req, props } = makeRequest('video_1');
    const res = await GET(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(data);
    expect(body.success).toBeUndefined();
  });

  it('maps a NOT_FOUND use-case error to 404, not a regressed generic 403', async () => {
    vi.mocked(listVideoComments).mockResolvedValue({
      ok: false,
      error: { type: 'NOT_FOUND', message: 'Film nie istnieje.' },
    } as any);

    const { req, props } = makeRequest('missing-video');
    const res = await GET(req, props);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Film nie istnieje.' });
  });

  it('maps a FORBIDDEN use-case error to 403', async () => {
    vi.mocked(listVideoComments).mockResolvedValue({
      ok: false,
      error: { type: 'FORBIDDEN', message: 'Brak dostępu do komentarzy.' },
    } as any);

    const { req, props } = makeRequest('video_1');
    const res = await GET(req, props);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'Brak dostępu do komentarzy.' });
  });

  it('maps an UNAUTHORIZED use-case error to 401', async () => {
    vi.mocked(listVideoComments).mockResolvedValue({
      ok: false,
      error: { type: 'UNAUTHORIZED', message: 'Wymagane logowanie.' },
    } as any);

    const { req, props } = makeRequest('video_1');
    const res = await GET(req, props);
    expect(res.status).toBe(401);
  });

  it('maps a DATABASE_ERROR use-case error to 500', async () => {
    vi.mocked(listVideoComments).mockResolvedValue({
      ok: false,
      error: { type: 'DATABASE_ERROR', message: 'Błąd podczas sprawdzania dostępu.' },
    } as any);

    const { req, props } = makeRequest('video_1');
    const res = await GET(req, props);
    expect(res.status).toBe(500);
  });

  it('short-circuits with the requireAdminForApi response when not an admin', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: '',
      response: new Response('Unauthorized', { status: 401 }),
    } as any);

    const { req, props } = makeRequest('video_1');
    const res = await GET(req, props);
    expect(res.status).toBe(401);
    expect(listVideoComments).not.toHaveBeenCalled();
  });
});
