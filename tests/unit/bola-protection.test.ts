import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/lib/services/user.service';
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
  },
}));

vi.mock('@/lib/services/user.service', () => ({
  UserService: {
    getOrCreateUserFromAuth: vi.fn(),
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
      video: { creatorId: 'creator_1' }
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'attacker_1',
      role: 'USER',
      creators: []
    } as any);

    const req = new NextRequest('http://localhost/api/comments?id=comment_1', { method: 'DELETE' });
    const res = await DELETE(req);

    expect(res.status).toBe(403);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/comments: blocks non-creator from pinning comment', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'random_user' } as any);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({
      id: 'comment_1',
      authorId: 'victim_1',
      video: { id: 'video_1', creatorId: 'creator_1' }
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'random_user',
      role: 'USER',
      creators: [] // User does not own creator_1
    } as any);

    const req = new NextRequest('http://localhost/api/comments', {
      method: 'PATCH',
      body: JSON.stringify({ commentId: 'comment_1', pinned: true })
    });
    const res = await PATCH(req);

    expect(res.status).toBe(403);
  });
});
