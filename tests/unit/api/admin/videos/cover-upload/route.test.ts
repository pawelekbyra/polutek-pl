import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/videos/cover-upload/route';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdminForApi } from '@/lib/auth-utils';
import { getBlobAccess } from '@/lib/blob-config';

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock('@/lib/blob-config', () => ({
  getBlobAccess: vi.fn(),
}));

describe('POST /api/admin/videos/cover-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBlobAccess).mockReturnValue('public');
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

  it('handles public access upload', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });
    vi.mocked(getBlobAccess).mockReturnValue('public');

    const mockBlobUrl = 'https://blob.vercel.com/public-cover.webp';
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
    expect(put).toHaveBeenCalledWith(expect.any(String), expect.any(File), { access: 'public' });
  });

  it('handles private access upload with videoId', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });
    vi.mocked(getBlobAccess).mockReturnValue('private');

    const mockBlobUrl = 'https://blob.vercel.com/private-cover.webp';
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
    expect(data.url).toBe('/api/videos/v1/thumbnail');
    expect(data.storageUrl).toBe(mockBlobUrl);
    expect(put).toHaveBeenCalledWith(expect.any(String), expect.any(File), { access: 'private' });
  });

  it('rejects private access upload without videoId', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });
    vi.mocked(getBlobAccess).mockReturnValue('private');

    const formData = new FormData();
    const file = new File(['dummy'], 'cover.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost/api/admin/videos/cover-upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Video must be saved/);
  });

  it('handles Vercel Blob access conflict errors', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });
    vi.mocked(getBlobAccess).mockReturnValue('public');
    vi.mocked(put).mockRejectedValue(new Error('Vercel Blob: Cannot use public access on a private store.'));

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

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/configured for private access/);
  });
});
