import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { AccessPolicy } from '@/lib/access/access-policy';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { POST } from '@/app/api/comments/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    comment: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/access/access-policy', () => ({
  AccessPolicy: {
    canComment: vi.fn(),
  },
}));

vi.mock('@/lib/services/user/profile.service', () => ({
  UserProfileService: {
    getOrCreateUserFromAuth: vi.fn(),
  },
}));

describe('/api/comments POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 4 });
    vi.mocked(AccessPolicy.canComment).mockResolvedValue({ allowed: true });
    vi.mocked(UserService.getOrCreateUserFromAuth).mockResolvedValue({
      id: 'local-user-id',
      email: 'fan@example.com',
      language: 'pl',
      role: 'USER',
    } as Awaited<ReturnType<typeof UserService.getOrCreateUserFromAuth>>);
  });

  it('persists the comment with the synchronized local user id', async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: 'clerk-user-id',
      sessionClaims: { email: 'fan@example.com' },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: 'comment-id',
      videoId: 'video-id',
      text: 'Komentarz fana',
      authorId: 'local-user-id',
      parentId: null,
      creatorId: null,
      imageUrl: null,
      pinnedAt: null,
      pinnedById: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-06-05T00:00:00.000Z'),
      updatedAt: new Date('2026-06-05T00:00:00.000Z'),
      author: {
        name: 'Fan',
        username: 'fan',
        imageUrl: null,
        isPatron: false,
        role: 'USER',
      },
      _count: { likes: 0, dislikes: 0, replies: 0 },
    } as unknown as Awaited<ReturnType<typeof prisma.comment.create>>);

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({ videoId: 'video-id', text: '  Komentarz fana  ' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(UserService.getOrCreateUserFromAuth).toHaveBeenCalledWith('clerk-user-id', { email: 'fan@example.com' });
    expect(AccessPolicy.canComment).toHaveBeenCalledWith('clerk-user-id', 'video-id');
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        videoId: 'video-id',
        text: 'Komentarz fana',
        authorId: 'local-user-id',
        parentId: null,
      }),
    }));
  });
});
