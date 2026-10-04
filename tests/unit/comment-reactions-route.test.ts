import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { setCommentReaction } from '@/lib/modules/comments';
import { PUT, DELETE } from '@/app/api/comments/[commentId]/reaction/route';
import { getActorFromAuth } from '@/lib/api/auth';

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/comments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/modules/comments')>();
  return { ...actual, setCommentReaction: vi.fn() };
});

const params = { params: Promise.resolve({ commentId: 'comment-id' }) };
const put = (body?: unknown) =>
  PUT(new NextRequest('http://localhost/api/comments/comment-id/reaction', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), params);

describe('/api/comments/[commentId]/reaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 59 } as any);
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'local-user-id' } as any);
    vi.mocked(setCommentReaction).mockResolvedValue({ ok: true, data: { viewerReaction: 'LIKE', likesCount: 3 } });
  });

  it('PUT sets LIKE (the default) and answers with the authoritative state', async () => {
    const response = await put();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, liked: true, viewerReaction: 'LIKE', likesCount: 3 });
    expect(setCommentReaction).toHaveBeenCalledWith({ commentId: 'comment-id', reaction: 'LIKE' }, expect.anything());
  });

  it('PUT with type DISLIKE sets DISLIKE; DELETE clears', async () => {
    await put({ type: 'DISLIKE' });
    expect(setCommentReaction).toHaveBeenLastCalledWith({ commentId: 'comment-id', reaction: 'DISLIKE' }, expect.anything());
    await DELETE(new NextRequest('http://localhost/api/comments/comment-id/reaction', { method: 'DELETE' }), params);
    expect(setCommentReaction).toHaveBeenLastCalledWith({ commentId: 'comment-id', reaction: null }, expect.anything());
  });

  it('maps NOT_FOUND to 404 (not 403)', async () => {
    vi.mocked(setCommentReaction).mockResolvedValue({ ok: false, error: { type: 'NOT_FOUND', message: 'Komentarz nie istnieje.' } });
    expect((await put()).status).toBe(404);
  });

  it('a database failure is a 500 with a generic message', async () => {
    vi.mocked(setCommentReaction).mockResolvedValue({ ok: false, error: { type: 'DATABASE_ERROR', message: 'Coś poszło nie tak. Spróbuj ponownie.' } });
    const response = await put();
    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe('Coś poszło nie tak. Spróbuj ponownie.');
  });

  it('guests get 401, scripted loops get 429', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValueOnce({ type: 'guest' } as any);
    expect((await put()).status).toBe(401);

    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, remaining: 0 } as any);
    expect((await put()).status).toBe(429);
    expect(setCommentReaction).not.toHaveBeenCalled();
  });
});
