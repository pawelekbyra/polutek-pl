import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/webhooks/resend/route';
import { NextRequest } from 'next/server';
import { handleResendWebhook } from '@/lib/modules/email';
import { Webhook } from 'svix';

const verifyMock = vi.fn();

vi.mock('@/lib/modules/email', () => ({
  handleResendWebhook: vi.fn(),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(function () {
    return {
      verify: verifyMock,
    };
  }),
}));

function makeRequest(headers: HeadersInit, body = JSON.stringify({ type: 'email.sent', data: { email_id: 're_123' } })) {
  return new NextRequest('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers,
    body,
  });
}

describe('Resend Webhook Route Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'test-secret');
    vi.stubEnv('RESEND_WEBHOOK_DEV_SECRET_AUTH', 'true');
    verifyMock.mockReturnValue({ type: 'email.sent', data: { email_id: 're_123' } });
    vi.mocked(handleResendWebhook).mockResolvedValue({ ok: true, data: { received: true } } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects production legacy secret with forged svix-id and no valid Svix signature', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const res = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
        'svix-id': 'evt_forged',
      }),
    );

    expect(res.status).toBe(401);
    expect(Webhook).not.toHaveBeenCalled();
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('rejects production legacy secret without Svix authentication', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const res = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
      }),
    );

    expect(res.status).toBe(401);
    expect(Webhook).not.toHaveBeenCalled();
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('rejects partial Svix headers and does not fall back to legacy authentication', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const res = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
        'svix-id': 'evt_123',
        'svix-timestamp': '123',
      }),
    );

    expect(res.status).toBe(401);
    expect(Webhook).not.toHaveBeenCalled();
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('rejects invalid Svix signatures without calling the webhook handler', async () => {
    verifyMock.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });
    vi.stubEnv('NODE_ENV', 'production');

    const res = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
        'svix-id': 'evt_123',
        'svix-timestamp': '123',
        'svix-signature': 'v1,invalid',
      }),
    );

    expect(res.status).toBe(401);
    expect(Webhook).toHaveBeenCalledWith('test-secret');
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('accepts valid complete Svix signatures, assigns the event ID, and calls the handler once', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const res = await POST(
      makeRequest({
        'svix-id': 'evt_123',
        'svix-timestamp': '123',
        'svix-signature': 'v1,valid',
      }),
    );

    expect(res.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith(expect.any(String), {
      'svix-id': 'evt_123',
      'svix-timestamp': '123',
      'svix-signature': 'v1,valid',
    });
    expect(handleResendWebhook).toHaveBeenCalledTimes(1);
    expect(handleResendWebhook).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: 'evt_123' }),
    );
  });

  it('returns controlled 400 for malformed JSON on permitted non-production legacy path', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const res = await POST(
      makeRequest(
        {
          'x-resend-webhook-secret': 'test-secret',
        },
        '{not json',
      ),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Malformed JSON' });
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('allows non-production legacy compatibility only when explicitly authenticated by the legacy secret', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const accepted = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
      }),
    );

    expect(accepted.status).toBe(200);
    expect(handleResendWebhook).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    verifyMock.mockReturnValue({ type: 'email.sent', data: { email_id: 're_123' } });

    const rejected = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'wrong-secret',
      }),
    );

    expect(rejected.status).toBe(401);
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('rejects non-production legacy fallback when svix-id is present with an empty value', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const res = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
        'svix-id': '',
      }),
    );

    expect(res.status).toBe(401);
    expect(Webhook).not.toHaveBeenCalled();
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('rejects non-production legacy fallback when only a non-empty svix-id is supplied', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const res = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
        'svix-id': 'evt_partial',
      }),
    );

    expect(res.status).toBe(401);
    expect(Webhook).not.toHaveBeenCalled();
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });

  it('rejects non-production legacy requests when any Svix header is present but invalid', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    verifyMock.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const res = await POST(
      makeRequest({
        'x-resend-webhook-secret': 'test-secret',
        'svix-id': 'evt_123',
        'svix-timestamp': '123',
        'svix-signature': 'v1,invalid',
      }),
    );

    expect(res.status).toBe(401);
    expect(handleResendWebhook).not.toHaveBeenCalled();
  });
});
