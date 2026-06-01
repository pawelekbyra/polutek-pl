import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/comments/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
        findUnique: vi.fn(),
        upsert: vi.fn()
    },
    comment: { create: vi.fn(), findUnique: vi.fn() },
    creator: { updateMany: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'u1' }),
  currentUser: vi.fn().mockResolvedValue({
    id: 'u1',
    primaryEmailAddress: { emailAddress: 'test@example.com' },
    emailAddresses: [],
    publicMetadata: {},
    unsafeMetadata: {}
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/access/access-policy', () => ({
  AccessPolicy: {
    canComment: vi.fn().mockResolvedValue({ allowed: true }),
    canViewVideo: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

describe('Comments API - Sanitization', () => {
  it('strips HTML tags from comments', async () => {
    const maliciousInput = {
        videoId: 'v1',
        text: 'Hello <script>alert(1)</script><img src=x onerror=alert(1)>world',
    };

    const req = new NextRequest('http://localhost/api/comments', {
        method: 'POST',
        body: JSON.stringify(maliciousInput),
    });

    vi.mocked(prisma.comment.create).mockResolvedValue({
        id: 'c1',
        text: 'Hello world', // Expected result after sanitization
        author: { name: 'Test' },
        _count: { likes: 0, dislikes: 0, replies: 0 }
    } as any);

    await POST(req);

    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            text: 'Hello world'
        })
    }));
  });
});
