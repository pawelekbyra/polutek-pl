import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { AccessPolicy } from '@/lib/access/access-policy';
import { UserService } from '@/lib/services/user.service';
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

vi.mock('@/lib/access/access-policy', () => ({
  AccessPolicy: {
    canReactToComment: vi.fn(),
  },
}));

vi.mock('@/lib/services/user.service', () => ({
  UserService: {
    getOrCreateUserFromAuth: vi.fn(),
  },
}));

describe('/api/comments/like', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 59 });
    vi.mocked(AccessPolicy.canReactToComment).mockResolvedValue({ allowed: true });
    vi.mocked(UserService.getOrCreateUserFromAuth).mockResolvedValue({ id: 'local-user-id' } as Awaited<ReturnType<typeof UserService.getOrCreateUserFromAuth>>);
  });

  it('persists likes with the synchronized local user id', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'clerk-user-id', sessionClaims: { email: 'fan@example.com' } } as unknown as Awaited<ReturnType<typeof auth>>);

    const tx = {
      commentDislike: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      commentLike: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'like-id' }),
        delete: vi.fn(),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

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
    expect(tx.commentDislike.deleteMany).toHaveBeenCalledWith({ where: { userId: 'local-user-id', commentId: 'comment-id' } });
    expect(tx.commentLike.findUnique).toHaveBeenCalledWith({ where: { userId_commentId: { userId: 'local-user-id', commentId: 'comment-id' } } });
    expect(tx.commentLike.create).toHaveBeenCalledWith({ data: { userId: 'local-user-id', commentId: 'comment-id' } });
  });
});
