import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/admin/videos/cover-upload/route';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdminForApi } from '@/lib/auth-utils';
import * as blobConfig from '@/lib/blob-config';

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

  it('handles public access upload', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });
    vi.spyOn(blobConfig, 'getBlobAccess').mockReturnValue('public');

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
    vi.spyOn(blobConfig, 'getBlobAccess').mockReturnValue('private');

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
    vi.spyOn(blobConfig, 'getBlobAccess').mockReturnValue('private');

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
});
