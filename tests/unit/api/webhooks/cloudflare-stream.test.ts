import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/cloudflare-stream/route';
import { NextRequest } from 'next/server';
import { handleCloudflareStreamWebhook } from '@/lib/modules/video';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/modules/video', () => ({
  handleCloudflareStreamWebhook: vi.fn(),
}));

describe('Cloudflare Stream Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDFLARE_WEBHOOK_SECRET = 'test-secret';
  });

  it('returns 401 if signature is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
      method: 'POST',
      body: JSON.stringify({ uid: '123', status: { state: 'ready' } }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('returns 401 if signature is invalid', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
      method: 'POST',
      headers: { 'cf-webhook-signature': 'wrong-secret' },
      body: JSON.stringify({ uid: '123', status: { state: 'ready' } }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('returns 400 if payload is invalid', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
      method: 'POST',
      headers: { 'cf-webhook-signature': 'test-secret' },
      body: JSON.stringify({ uid: '123' }), // Missing status
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('returns 200 and calls use case if valid', async () => {
    vi.mocked(handleCloudflareStreamWebhook).mockResolvedValue(ok({ assetId: 'asset-1', status: 'READY' }));

    const req = new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
      method: 'POST',
      headers: { 'cf-webhook-signature': 'test-secret' },
      body: JSON.stringify({ uid: 'cf-uid-123', status: { state: 'ready' } }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('READY');
    expect(handleCloudflareStreamWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'cf-uid-123' }),
      expect.any(Object)
    );
  });
});
