import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { createVideoComment, listVideoComments } from '@/lib/modules/comments';
import { GET, POST } from '@/app/api/videos/[id]/comments/route';
import { getActorFromAuth } from '@/lib/api/auth';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock('@/lib/modules/comments', () => ({
  createVideoComment: vi.fn(),
  listVideoComments: vi.fn(),
}));

describe('/api/videos/[id]/comments POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 4 });
    vi.mocked(getActorFromAuth).mockResolvedValue({
      type: 'user',
      userId: 'local-user-id',
      isPatron: false,
    } as any);
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

    const response = await POST(request, { params: Promise.resolve({ id: 'video-id' }) });
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

  it('rejects oversized comment payloads before persisting', async () => {
    const request = new NextRequest('http://localhost/api/videos/video-id/comments', {
      method: 'POST',
      body: JSON.stringify({ text: 'a'.repeat(5001) }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'video-id' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('COMMENT_VALIDATION_ERROR');
    expect(createVideoComment).not.toHaveBeenCalled();
  });

  it('returns 401 for guests', async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: null,
    } as any);
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);

    const request = new NextRequest('http://localhost/api/videos/video-id/comments', {
      method: 'POST',
      body: JSON.stringify({ text: 'Komentarz' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'video-id' }) });
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.code).toBe('AUTH_REQUIRED');
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

    const response = await POST(request, { params: Promise.resolve({ id: 'video-id' }) });
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.code).toBe('COMMENT_FORBIDDEN');
  });

  it('returns 429 when the posting rate limit is exceeded', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0 } as any);

    const request = new NextRequest('http://localhost/api/videos/video-id/comments', {
      method: 'POST',
      body: JSON.stringify({ text: 'Komentarz' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'video-id' }) });
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.message).toContain('Zbyt dużo komentarzy');
    expect(body.code).toBe('COMMENT_RATE_LIMITED');
    expect(createVideoComment).not.toHaveBeenCalled();
  });
});

describe('/api/videos/[id]/comments GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows guests to read published video comments and returns non-interactive viewer capabilities', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    vi.mocked(listVideoComments).mockResolvedValue({
      ok: true,
      data: {
        comments: [{ id: 'comment-id', text: 'Publiczny komentarz' }],
        totalCount: 1,
        nextCursor: null,
        viewer: {
          canComment: false,
          canReact: false,
          canReport: false,
          canModerate: false,
        },
      },
    } as any);

    const request = new NextRequest('http://localhost/api/videos/video-id/comments?sortBy=newest');
    const response = await GET(request, { params: Promise.resolve({ id: 'video-id' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.comments).toHaveLength(1);
    expect(body.viewer).toMatchObject({
      canComment: false,
      canReact: false,
      canReport: false,
    });
    expect(listVideoComments).toHaveBeenCalledWith(
      { videoId: 'video-id', sortBy: 'newest', cursor: undefined, limit: 20 },
      expect.objectContaining({ actor: { type: 'guest' } }),
    );
  });

  it('does not leak missing or deleted video comments', async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' } as any);
    vi.mocked(listVideoComments).mockResolvedValue({
      ok: false,
      error: { type: 'NOT_FOUND', message: 'Film nie istnieje lub został usunięty.' },
    } as any);

    const request = new NextRequest('http://localhost/api/videos/deleted/comments');
    const response = await GET(request, { params: Promise.resolve({ id: 'deleted' }) });

    expect(response.status).toBe(404);
  });
});
