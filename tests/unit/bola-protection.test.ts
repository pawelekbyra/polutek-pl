import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '@/app/api/comments/[commentId]/route';
import { NextRequest, NextResponse } from 'next/server';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getActorFromAuth } from '@/lib/api/auth';
import { updateComment, deleteComment } from '@/lib/modules/comments';

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/comments', () => ({
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
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'attacker_1', isPatron: false });
    vi.mocked(deleteComment).mockResolvedValue({
        ok: false,
        error: { type: 'FORBIDDEN', message: 'Forbidden' }
    });

    const req = new NextRequest('http://localhost/api/comments/comment_1', { method: 'DELETE' });
    const res = await DELETE(req, { params: { commentId: 'comment_1' } });

    expect(res.status).toBe(403);
    expect(deleteComment).toHaveBeenCalledWith({ commentId: 'comment_1' }, expect.any(Object));
  });

  it('PATCH /api/comments/[commentId]: blocks non-creator from pinning comment', async () => {
    // Note: pinning is now a separate route /api/comments/[commentId]/pin
    // This test in bola-protection.test.ts was testing PATCH /api/comments?id=comment_1 with { pinned: true }
    // Our new PATCH route only accepts { text: string } and doesn't allow pinning.
    // So we should verify it returns 400 or ignoring 'pinned' field if it's not in the schema.

    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'random_user', isPatron: false });

    const req = new NextRequest('http://localhost/api/comments/comment_1', {
      method: 'PATCH',
      body: JSON.stringify({ pinned: true })
    });
    const res = await PATCH(req, { params: { commentId: 'comment_1' } });

    // It should be 400 because 'text' is missing and 'pinned' is not allowed/ignored
    expect(res.status).toBe(400);
  });
});
