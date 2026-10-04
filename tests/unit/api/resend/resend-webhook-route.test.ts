import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';

const { handleResendWebhook, loggerWarn, loggerError } = vi.hoisted(() => ({
  handleResendWebhook: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/modules/email/application/handle-resend-webhook.use-case', () => ({ handleResendWebhook }));
vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/logger')>()),
  logger: { warn: loggerWarn, error: loggerError, info: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/webhooks/resend/route';

// A Standard Webhooks / Svix secret: "whsec_" + base64 key.
const KEY = Buffer.from('0123456789abcdef0123456789abcdef');
const SECRET = `whsec_${KEY.toString('base64')}`;
const BODY = JSON.stringify({ type: 'email.bounced', created_at: '2026-10-03T10:00:00Z', data: { email_id: 're_1', tags: { app: 'pawelperfect' } } });

/** Signs exactly like Resend (Svix): HMAC-SHA256 over "<id>.<timestamp>.<raw body>". */
function sign(body: string, id = 'msg_1', timestamp = Math.floor(Date.now() / 1000), key = KEY) {
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': `v1,${signature}` };
}

function request(headers: Record<string, string>, body = BODY) {
  return new NextRequest('http://localhost/api/webhooks/resend', { method: 'POST', headers, body });
}

describe('POST /api/webhooks/resend (real signature verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RESEND_WEBHOOK_SECRET', SECRET);
    handleResendWebhook.mockResolvedValue({ ok: true, data: { received: true, accepted: true } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a correctly signed event and passes svix-id as the idempotency key', async () => {
    const res = await POST(request(sign(BODY, 'msg_42')));
    expect(res.status).toBe(200);
    expect(handleResendWebhook).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'email.bounced', eventId: 'msg_42' }));
  });

  it('accepts a secret saved with a Windows line ending or quotes around it', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `"${SECRET}"\r\n`);
    const res = await POST(request(sign(BODY)));
    expect(res.status).toBe(200);
  });

  it('rejects a body changed after signing and logs why, without the secret', async () => {
    const res = await POST(request(sign(BODY), BODY.replace('re_1', 're_2')));
    expect(res.status).toBe(401);
    expect(handleResendWebhook).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith(
      '[ResendWebhook] Rejected: signature_mismatch',
      expect.objectContaining({ message: 'No matching signature found', svixId: 'msg_1', secretHasPrefix: true }),
    );
    expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain(KEY.toString('base64'));
  });

  it('rejects a signature made with another endpoint secret', async () => {
    const res = await POST(request(sign(BODY, 'msg_1', Math.floor(Date.now() / 1000), Buffer.from('another-endpoint-secret-0000000'))));
    expect(res.status).toBe(401);
  });

  it('rejects an event signed more than 5 minutes ago and reports the clock difference', async () => {
    const res = await POST(request(sign(BODY, 'msg_1', Math.floor(Date.now() / 1000) - 3600)));
    expect(res.status).toBe(401);
    expect(loggerWarn).toHaveBeenCalledWith(
      '[ResendWebhook] Rejected: timestamp_out_of_range',
      expect.objectContaining({ clockSkewSeconds: expect.any(Number) }),
    );
    const diagnostics = loggerWarn.mock.calls[0][1] as { clockSkewSeconds: number };
    expect(diagnostics.clockSkewSeconds).toBeGreaterThanOrEqual(3600);
  });

  it('rejects a request without the Svix headers', async () => {
    const res = await POST(request({ 'x-resend-webhook-secret': SECRET }));
    expect(res.status).toBe(401);
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('answers 500 (not 401) when the configured secret is not a whsec_ value, so the cause is clear', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'my-password');
    const res = await POST(request(sign(BODY)));
    expect(res.status).toBe(500);
    expect(loggerError).toHaveBeenCalledWith('[ResendWebhook] Rejected: secret_invalid', expect.objectContaining({ secretHasPrefix: false, secretLength: 11 }));
  });

  it('answers 500 when the secret is missing', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    const res = await POST(request(sign(BODY)));
    expect(res.status).toBe(500);
  });

  it('rejects an oversized body before verifying', async () => {
    const big = 'x'.repeat(100_001);
    const res = await POST(request(sign(big), big));
    expect(res.status).toBe(413);
  });
});
