import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
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

vi.mock('@/lib/services/comments/comment-access.service', () => ({
  CommentAccessService: {
    canComment: vi.fn(),
  },
}));

vi.mock('@/lib/services/comments/comment.service', () => ({
  CommentService: {
    createComment: vi.fn(),
    mapToDto: vi.fn(),
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
    vi.mocked(CommentAccessService.canComment).mockResolvedValue({ allowed: true });
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

    const mockComment = { id: 'comment-id', text: 'Komentarz fana' };
    vi.mocked(CommentService.createComment).mockResolvedValue(mockComment as any);
    vi.mocked(CommentService.mapToDto).mockReturnValue({ id: 'comment-id', text: 'Komentarz fana' } as any);

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
    expect(CommentAccessService.canComment).toHaveBeenCalledWith('clerk-user-id', 'video-id');
    expect(CommentService.createComment).toHaveBeenCalledWith('local-user-id', 'video-id', 'Komentarz fana', undefined, undefined);
  });

  it('returns 401 for guests', async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({ videoId: 'video-id', text: 'Komentarz' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 403 when AccessPolicy denies commenting', async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: 'clerk-user-id',
      sessionClaims: { email: 'fan@example.com' },
    } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(CommentAccessService.canComment).mockResolvedValue({ allowed: false, reason: 'PATRON_REQUIRED' });

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({ videoId: 'video-id', text: 'Komentarz' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
