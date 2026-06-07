import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentReactionService } from '@/lib/services/comments/comment-reaction.service';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { POST as likeComment } from '@/app/api/comments/like/route';

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

vi.mock('@/lib/services/comments/comment-access.service', () => ({
  CommentAccessService: {
    canReact: vi.fn(),
  },
}));

vi.mock('@/lib/services/comments/comment-reaction.service', () => ({
  CommentReactionService: {
    toggleLike: vi.fn(),
  },
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
    vi.mocked(CommentAccessService.canReact).mockResolvedValue({ allowed: true });
    vi.mocked(UserService.getOrCreateUserFromAuth).mockResolvedValue({ id: 'local-user-id' } as Awaited<ReturnType<typeof UserService.getOrCreateUserFromAuth>>);
  });

  it('persists likes with the synchronized local user id', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'clerk-user-id', sessionClaims: { email: 'fan@example.com' } } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.mocked(CommentReactionService.toggleLike).mockResolvedValue({ liked: true });

    const request = new NextRequest('http://localhost/api/comments/like', {
      method: 'POST',
      body: JSON.stringify({ commentId: 'comment-id' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await likeComment(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, liked: true, disliked: false });
    expect(UserService.getOrCreateUserFromAuth).toHaveBeenCalledWith('clerk-user-id', { email: 'fan@example.com' });
    expect(CommentReactionService.toggleLike).toHaveBeenCalledWith('local-user-id', 'comment-id');
  });
});
