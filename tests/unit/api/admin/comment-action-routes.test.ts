import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as restore } from '@/app/api/admin/comments/[commentId]/restore/route';
import { POST as approve } from '@/app/api/admin/comments/[commentId]/approve/route';
import { POST as hide } from '@/app/api/admin/comments/[commentId]/hide/route';
import { POST as resolveReport } from '@/app/api/admin/comments/reports/[reportId]/resolve/route';
import { restoreAdminComment, approveHeldComment, hideAdminComment, resolveCommentReport } from '@/lib/modules/comments';
import { requireAdminForApi } from '@/lib/auth-utils';

vi.mock('@/lib/auth-utils', () => ({ requireAdminForApi: vi.fn() }));
vi.mock('@/lib/modules/comments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/modules/comments')>('@/lib/modules/comments');
  return {
    ...actual,
    restoreAdminComment: vi.fn(),
    approveHeldComment: vi.fn(),
    hideAdminComment: vi.fn(),
    resolveCommentReport: vi.fn(),
  };
});

const post = (path: string, body?: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = { params: Promise.resolve({ commentId: 'c1' }) };

describe('admin comment action routes map errors to real HTTP statuses (not 500)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminForApi).mockResolvedValue({ adminUserId: 'admin_1', response: null } as any);
  });

  it('restore of a deleted comment is 409 Conflict with a readable message', async () => {
    vi.mocked(restoreAdminComment).mockResolvedValue({ ok: false, error: { type: 'CONFLICT', message: 'Usuniętego komentarza nie da się przywrócić.' } });
    const res = await restore(post('/api/admin/comments/c1/restore'), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ success: false, error: 'CONFLICT', message: 'Usuniętego komentarza nie da się przywrócić.' });
  });

  it('a missing comment is 404', async () => {
    vi.mocked(approveHeldComment).mockResolvedValue({ ok: false, error: { type: 'NOT_FOUND', message: 'Komentarz nie istnieje.' } });
    expect((await approve(post('/api/admin/comments/c1/approve'), params)).status).toBe(404);
  });

  it('a validation error is 400', async () => {
    vi.mocked(resolveCommentReport).mockResolvedValue({ ok: false, error: { type: 'VALIDATION_ERROR', message: 'x' } });
    const res = await resolveReport(post('/api/admin/comments/reports/r1/resolve', { status: 'DISMISSED' }), { params: Promise.resolve({ reportId: 'r1' }) });
    expect(res.status).toBe(400);
  });

  it('success is 200 with { success: true } for actions without a payload', async () => {
    vi.mocked(hideAdminComment).mockResolvedValue({ ok: true, data: undefined });
    const res = await hide(post('/api/admin/comments/c1/hide'), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
