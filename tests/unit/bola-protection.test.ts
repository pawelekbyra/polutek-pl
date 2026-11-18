import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '@/app/api/comments/[commentId]/route';
import { NextRequest } from 'next/server';
import { getActorFromAuth } from '@/lib/api/auth';
import { updateComment, deleteComment } from '@/lib/modules/comments';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

// These assertions exercise authorization/body handling; Redis has its own integration boundary.
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true })) }));

vi.mock('@/lib/modules/comments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/comments')>()),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock('@/lib/modules/shared/app-context', () => ({
  createAppContext: vi.fn().mockReturnValue({}),
}));

describe('Comments API BOLA protection (Modularized)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DELETE /api/comments/[commentId]: blocks unauthorized user from deleting others comment', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'attacker_1' });
    vi.mocked(deleteComment).mockResolvedValue({
        ok: false,
        error: { type: 'FORBIDDEN', message: 'Forbidden' }
    });

    const req = new NextRequest('http://localhost/api/comments/comment_1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ commentId: 'comment_1' }) });

    expect(res.status).toBe(403);
    expect(deleteComment).toHaveBeenCalledWith({ commentId: 'comment_1' }, expect.any(Object));
  });

  it('PATCH /api/comments/[commentId]: rejects a pinning payload before updating a comment', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'random_user' });

    const req = new NextRequest('http://localhost/api/comments/comment_1', {
      method: 'PATCH',
      body: JSON.stringify({ pinned: true })
    });
    const res = await PATCH(req, { params: Promise.resolve({ commentId: 'comment_1' }) });

    expect(res.status).toBe(400);
    expect(updateComment).not.toHaveBeenCalled();
  });
});
