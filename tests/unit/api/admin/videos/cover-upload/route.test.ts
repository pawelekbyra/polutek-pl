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

const r2PutPrivate = vi.hoisted(() => vi.fn());
const r2Configured = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/modules/media', () => ({
  THUMBNAIL_EXTENSION_BY_MIME: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  R2ThumbnailStorageClient: class {
    static isConfigured = () => r2Configured.value;
    putPrivate = r2PutPrivate;
  },
}));

vi.mock('@/lib/blob-config', () => ({
  getBlobAccess: vi.fn(),
}));

describe('POST /api/admin/videos/cover-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    r2Configured.value = false;
    vi.mocked(getBlobAccess).mockReturnValue('public');
  });

  it('stores covers in the private R2 bucket once configured and returns the proxy URL', async () => {
    r2Configured.value = true;
    vi.mocked(requireAdminForApi).mockResolvedValue({ adminUserId: 'admin-1', response: null as any });
    const storageUrl = 'https://acct.r2.cloudflarestorage.com/priv/videos/v1/covers/abc.jpg';
    r2PutPrivate.mockResolvedValue({ key: 'videos/v1/covers/abc.jpg', storageUrl });

    const formData = new FormData();
    formData.append('file', new File(['dummy'], 'cover.jpg', { type: 'image/jpeg' }));
    formData.append('videoId', 'v1');

    const res = await POST(new NextRequest('http://localhost/api/admin/videos/cover-upload', { method: 'POST', body: formData }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ url: '/api/videos/v1/thumbnail', storageUrl });
    expect(r2PutPrivate).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'videos/v1/covers',
      contentType: 'image/jpeg',
      extension: 'jpg',
    }));
    expect(put).not.toHaveBeenCalled();
  });

  it('falls back to Vercel Blob when the R2 write fails (e.g. token lacks bucket access)', async () => {
    r2Configured.value = true;
    vi.mocked(requireAdminForApi).mockResolvedValue({ adminUserId: 'admin-1', response: null as any });
    vi.mocked(getBlobAccess).mockReturnValue('private');
    r2PutPrivate.mockRejectedValue(Object.assign(new Error('Access Denied'), { name: 'AccessDenied' }));
    vi.mocked(put).mockResolvedValue({ url: 'https://store.private.blob.vercel-storage.com/c.jpg' } as any);

    const formData = new FormData();
    formData.append('file', new File(['dummy'], 'cover.jpg', { type: 'image/jpeg' }));
    formData.append('videoId', 'v1');

    const res = await POST(new NextRequest('http://localhost/api/admin/videos/cover-upload', { method: 'POST', body: formData }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.storageUrl).toBe('https://store.private.blob.vercel-storage.com/c.jpg');
    expect(put).toHaveBeenCalledWith(expect.stringContaining('videos/v1/covers/'), expect.any(File), { access: 'private' });
  });

  it('never returns a browser URL for an R2 cover of a not-yet-saved video', async () => {
    r2Configured.value = true;
    vi.mocked(requireAdminForApi).mockResolvedValue({ adminUserId: 'admin-1', response: null as any });
    r2PutPrivate.mockResolvedValue({ key: 'videos/new/covers/abc.jpg', storageUrl: 'https://acct.r2.cloudflarestorage.com/priv/videos/new/covers/abc.jpg' });

    const formData = new FormData();
    formData.append('file', new File(['dummy'], 'cover.jpg', { type: 'image/jpeg' }));

    const res = await POST(new NextRequest('http://localhost/api/admin/videos/cover-upload', { method: 'POST', body: formData }));
    const data = await res.json();

    expect(data.url).toBeNull();
    expect(r2PutPrivate).toHaveBeenCalledWith(expect.objectContaining({ scope: 'videos/new/covers' }));
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

  it('allows private access upload without a videoId yet (e.g. a brand-new, unsaved video)', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin-1',
      response: null as any,
    });
    vi.mocked(getBlobAccess).mockReturnValue('private');

    const mockBlobUrl = 'https://blob.vercel.com/private-cover-new.webp';
    vi.mocked(put).mockResolvedValue({ url: mockBlobUrl } as any);

    const formData = new FormData();
    const file = new File(['dummy'], 'cover.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost/api/admin/videos/cover-upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const data = await res.json();

    // Without a videoId there's no DB record yet to proxy the private thumbnail
    // through, so both fields fall back to the raw storage URL; the client
    // renders an immediate local preview instead of relying on this URL, and
    // the raw URL gets persisted once the video is actually saved.
    expect(res.status).toBe(200);
    expect(data.url).toBe(mockBlobUrl);
    expect(data.storageUrl).toBe(mockBlobUrl);
    expect(put).toHaveBeenCalledWith(expect.stringContaining('videos/new/covers/'), expect.any(File), { access: 'private' });
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
