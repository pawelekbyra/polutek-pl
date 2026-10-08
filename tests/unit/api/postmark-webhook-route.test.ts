import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock('@/lib/modules/email', async () => {
  const webhook = await import('@/lib/modules/email/infrastructure/postmark-webhook');
  return { checkBasicAuth: webhook.checkBasicAuth, normalizePostmarkEvent: webhook.normalizePostmarkEvent, handleResendWebhook: handle };
});
vi.mock('@/lib/modules/shared/app-context', () => ({ createAppContext: () => ({}) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from '@/app/api/webhooks/postmark/route';

const auth = (u = 'pm', p = 's3cret') => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('https://www.pawelperfect.com/api/webhooks/postmark', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });
const bounce = { RecordType: 'Bounce', ID: 1, MessageID: 'm1', Email: 'a@example.com', Type: 'HardBounce', Inactive: true, Metadata: { app: 'pawelperfect' } };

describe('POST /api/webhooks/postmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTMARK_WEBHOOK_USER = 'pm';
    process.env.POSTMARK_WEBHOOK_PASSWORD = 's3cret';
    handle.mockResolvedValue({ ok: true, data: { received: true, accepted: true, duplicate: false, idempotency: 'available' } });
  });

  it('refuses to run without configured credentials', async () => {
    delete process.env.POSTMARK_WEBHOOK_PASSWORD;
    expect((await POST(req(bounce, { authorization: auth() }))).status).toBe(500);
    expect(handle).not.toHaveBeenCalled();
  });

  it('rejects missing and wrong credentials before touching the body', async () => {
    expect((await POST(req(bounce))).status).toBe(401);
    expect((await POST(req(bounce, { authorization: auth('pm', 'wrong') }))).status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it('hands a valid bounce to the shared use case as a bounced event', async () => {
    const res = await POST(req(bounce, { authorization: auth() }));
    expect(res.status).toBe(200);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0][1]).toMatchObject({ type: 'email.bounced', data: { email_id: 'm1', bounce: { type: 'permanent' } } });
  });

  it('acknowledges events it does not act on and rejects invalid JSON', async () => {
    const ignored = await POST(req({ RecordType: 'Open', MessageID: 'm1' }, { authorization: auth() }));
    expect(await ignored.json()).toMatchObject({ ignored: true });
    expect(handle).not.toHaveBeenCalled();
    expect((await POST(req('not json', { authorization: auth() }))).status).toBe(400);
  });

  it('passes the use case failure status on, so Postmark retries a locked event', async () => {
    handle.mockResolvedValue({ ok: false, error: { message: 'lock', code: 'LOCK_CONFLICT', statusCode: 503 } });
    expect((await POST(req(bounce, { authorization: auth() }))).status).toBe(503);
  });
});
