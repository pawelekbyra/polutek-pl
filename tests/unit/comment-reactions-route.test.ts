import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { toggleCommentLike } from '@/lib/modules/comments';
import { PUT as likeComment } from '@/app/api/comments/[commentId]/reaction/route';
import { getActorFromAuth } from '@/lib/api/auth';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/comments', () => ({
  toggleCommentLike: vi.fn(),
}));

vi.mock('@/lib/services/user/profile.service', () => ({
  UserProfileService: {
    getOrCreateUserFromAuth: vi.fn(),
  },
}));

describe('/api/comments/like', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 59 });
    vi.mocked(UserService.getOrCreateUserFromAuth).mockResolvedValue({ id: 'local-user-id' } as Awaited<ReturnType<typeof UserService.getOrCreateUserFromAuth>>);
    vi.mocked(getActorFromAuth).mockResolvedValue({
      type: 'user',
      userId: 'local-user-id',
      isPatron: false,
    } as any);
  });

  it('persists likes with the modular toggleCommentLike', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'clerk-user-id', sessionClaims: { email: 'fan@example.com' } } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.mocked(toggleCommentLike).mockResolvedValue({ ok: true, data: { liked: true } } as any);

    const request = new NextRequest('http://localhost/api/comments/comment-id/reaction', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await likeComment(request, { params: { commentId: 'comment-id' } } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, liked: true });
    expect(toggleCommentLike).toHaveBeenCalledWith({ commentId: 'comment-id', action: 'LIKE' }, expect.anything());
  });
});
