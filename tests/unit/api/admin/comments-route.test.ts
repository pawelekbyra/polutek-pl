import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/comments/route';
import { listAdminComments } from '@/lib/modules/comments';
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
    listAdminComments: vi.fn(),
  };
});

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/comments${query}`);
}

describe('GET /api/admin/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin_1',
      response: null,
    } as any);
  });

  it('returns the raw comment list (no success/comments envelope) on success', async () => {
    const comments = [{ id: 'c1' }, { id: 'c2' }];
    vi.mocked(listAdminComments).mockResolvedValue({ ok: true, data: comments } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(comments);
    expect(body.success).toBeUndefined();
    expect(body.comments).toBeUndefined();
  });

  it('maps a FORBIDDEN use-case error to a 403 with an { error } body', async () => {
    vi.mocked(listAdminComments).mockResolvedValue({
      ok: false,
      error: { type: 'FORBIDDEN', message: 'Brak uprawnień administratora.' },
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'Brak uprawnień administratora.' });
    expect(body.success).toBeUndefined();
  });

  it('maps a NOT_FOUND use-case error to 404, not a generic 403', async () => {
    vi.mocked(listAdminComments).mockResolvedValue({
      ok: false,
      error: { type: 'NOT_FOUND', message: 'Nie znaleziono.' },
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Nie znaleziono.' });
  });

  it('maps an UNAUTHORIZED use-case error to 401', async () => {
    vi.mocked(listAdminComments).mockResolvedValue({
      ok: false,
      error: { type: 'UNAUTHORIZED', message: 'Wymagane logowanie.' },
    } as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('maps a VALIDATION_ERROR use-case error to 400', async () => {
    vi.mocked(listAdminComments).mockResolvedValue({
      ok: false,
      error: { type: 'VALIDATION_ERROR', message: 'Nieprawidłowe dane.' },
    } as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it('maps a DATABASE_ERROR use-case error to 500', async () => {
    vi.mocked(listAdminComments).mockResolvedValue({
      ok: false,
      error: { type: 'DATABASE_ERROR', message: 'Błąd bazy danych.' },
    } as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it('short-circuits with the requireAdminForApi response when not an admin', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: '',
      response: new Response('Unauthorized', { status: 401 }),
    } as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(listAdminComments).not.toHaveBeenCalled();
  });
});
