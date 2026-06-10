import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { createVideoComment } from '@/lib/modules/comments';
import { POST } from '@/app/api/videos/[id]/comments/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/modules/comments', () => ({
  createVideoComment: vi.fn(),
  listVideoComments: vi.fn(),
}));

describe('/api/videos/[id]/comments POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 4 });
  });

  it('persists the comment via modular createVideoComment', async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: 'clerk-user-id',
      sessionClaims: { email: 'fan@example.com' },
    } as any);

    const mockComment = { id: 'comment-id', text: 'Komentarz fana' };
    vi.mocked(createVideoComment).mockResolvedValue({ ok: true, data: mockComment } as any);

    const request = new NextRequest('http://localhost/api/videos/video-id/comments', {
      method: 'POST',
      body: JSON.stringify({ text: '  Komentarz fana  ' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: { id: 'video-id' } });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(createVideoComment).toHaveBeenCalledWith({
        videoId: 'video-id',
        text: 'Komentarz fana',
        parentId: undefined,
        imageUrl: undefined
    }, expect.anything());
  });

  it('returns 401 for guests', async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: null,
    } as any);

    const request = new NextRequest('http://localhost/api/videos/video-id/comments', {
      method: 'POST',
      body: JSON.stringify({ text: 'Komentarz' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: { id: 'video-id' } });
    expect(response.status).toBe(401);
  });

  it('returns 403 when modular use case returns FORBIDDEN', async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: 'clerk-user-id',
      sessionClaims: { email: 'fan@example.com' },
    } as any);
    vi.mocked(createVideoComment).mockResolvedValue({ ok: false, error: { type: 'FORBIDDEN', message: 'Patron only' } } as any);

    const request = new NextRequest('http://localhost/api/videos/video-id/comments', {
      method: 'POST',
      body: JSON.stringify({ text: 'Komentarz' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: { id: 'video-id' } });
    expect(response.status).toBe(403);
  });
});
