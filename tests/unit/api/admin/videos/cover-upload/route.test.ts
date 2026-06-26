import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/videos/cover-upload/route';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdminForApi } from '@/lib/auth-utils';

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: vi.fn(),
}));

describe('POST /api/admin/videos/cover-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-admin requests', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/admin/videos/cover-upload', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects missing file', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });

    const formData = new FormData();
    const req = new NextRequest('http://localhost/api/admin/videos/cover-upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('No file uploaded');
  });

  it('rejects invalid MIME type', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });

    const formData = new FormData();
    const file = new File(['dummy'], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost/api/admin/videos/cover-upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Invalid file type/);
  });

  it('rejects oversize file', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });

    const formData = new FormData();
    // 6MB file
    const file = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost/api/admin/videos/cover-upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/File too large/);
  });

  it('uploads valid image to vercel blob', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });

    const mockBlobUrl = 'https://blob.vercel.com/videos/v1/covers/uuid.webp';
    vi.mocked(put).mockResolvedValue({ url: mockBlobUrl } as any);

    const formData = new FormData();
    const file = new File(['dummy'], 'cover.jpg', { type: 'image/jpeg' });
    formData.append('file', file);
    formData.append('videoId', 'v1');

    const req = new NextRequest('http://localhost/api/admin/videos/cover-upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe(mockBlobUrl);
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^videos\/v1\/covers\/.*\.jpeg$/),
      file,
      expect.objectContaining({ access: 'public' })
    );
  });
});
