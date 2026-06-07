import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { POST, DELETE, PATCH } from '@/app/api/comments/route';
import { NextRequest } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    creator: {
      findFirst: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock('@/lib/services/user/profile.service', () => ({
  UserProfileService: {
    getOrCreateUserFromAuth: vi.fn(),
  },
}));

vi.mock('@/lib/services/comments/comment-access.service', () => ({
  CommentAccessService: {
    canModerate: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Comments API BOLA protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserService.getOrCreateUserFromAuth).mockImplementation(async (userId) => ({ id: userId } as Awaited<ReturnType<typeof UserService.getOrCreateUserFromAuth>>));
  });

  it('DELETE /api/comments: blocks unauthorized user from deleting others comment', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'attacker_1' } as any);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({
      id: 'comment_1',
      authorId: 'victim_1',
      videoId: 'video_1'
    } as any);
    vi.mocked(CommentAccessService.canModerate).mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/comments?id=comment_1', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: 'video_1', commentId: 'comment_1' } } as any);

    expect(res.status).toBe(403);
  });

  it('PATCH /api/comments: blocks non-creator from pinning comment', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'random_user' } as any);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({
      id: 'comment_1',
      authorId: 'victim_1',
      videoId: 'video_1'
    } as any);
    vi.mocked(CommentAccessService.canModerate).mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/comments?id=comment_1', {
      method: 'PATCH',
      body: JSON.stringify({ pinned: true })
    });
    const res = await PATCH(req, { params: { id: 'video_1', commentId: 'comment_1' } } as any);

    expect(res.status).toBe(403);
  });
});
