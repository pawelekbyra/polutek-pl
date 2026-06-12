import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/cloudflare-stream/route';
import { handleCloudflareStreamWebhook } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { ok } from '@/lib/modules/shared/result';

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/modules/video', () => ({
  handleCloudflareStreamWebhook: vi.fn(),
}));

vi.mock('@/lib/modules/shared/app-context', () => ({
  createAppContext: vi.fn(() => ({
    prisma: {},
    actor: { type: 'system', reason: 'Cloudflare Stream Webhook' },
  })),
}));

vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => loggerMocks,
}));

vi.mock('@/lib/utils/correlation', () => ({
  getCorrelationId: () => 'test-request-id',
}));

const SECRET = 'test-cloudflare-webhook-signing-secret';
const NOW_SECONDS = 1_700_000_000;
const VALID_BODY = '{"uid":"cf-uid-123","status":{"state":"ready"}}';

function signatureFor(rawBody: string, time = NOW_SECONDS, secret = SECRET) {
  return createHmac('sha256', secret)
    .update(`${time}.${rawBody}`, 'utf8')
    .digest('hex');
}

function webhookSignature(rawBody: string, time = NOW_SECONDS, secret = SECRET) {
  return `time=${time},sig1=${signatureFor(rawBody, time, secret)}`;
}

function request(rawBody: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

async function responseText(response: Response) {
  return await response.clone().text();
}

describe('Cloudflare Stream Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_SECONDS * 1000));
    vi.stubEnv('CLOUDFLARE_WEBHOOK_SECRET', SECRET);
    vi.stubEnv('NODE_ENV', 'test');
    vi.mocked(handleCloudflareStreamWebhook).mockResolvedValue(ok({ assetId: 'asset-1', status: 'READY' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('production missing secret fails closed before parsing, context creation, or mutation', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLOUDFLARE_WEBHOOK_SECRET', '');

    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': webhookSignature(VALID_BODY),
    }));

    expect(response.status).toBe(500);
    expect(await responseText(response)).not.toContain('CLOUDFLARE_WEBHOOK_SECRET');
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
    expect(createAppContext).not.toHaveBeenCalled();
  });

  it('missing signature returns 401 and performs zero mutation', async () => {
    const response = await POST(request(VALID_BODY));

    expect(response.status).toBe(401);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
    expect(createAppContext).not.toHaveBeenCalled();
  });

  it('legacy cf-webhook-signature is not accepted', async () => {
    const response = await POST(request(VALID_BODY, {
      'cf-webhook-signature': SECRET,
    }));

    expect(response.status).toBe(401);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('malformed signature is rejected', async () => {
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': `time=${NOW_SECONDS};sig1=${signatureFor(VALID_BODY)}`,
    }));

    expect(response.status).toBe(401);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('missing time is rejected', async () => {
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': `sig1=${signatureFor(VALID_BODY)}`,
    }));

    expect(response.status).toBe(401);
  });

  it('missing sig1 is rejected', async () => {
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': `time=${NOW_SECONDS}`,
    }));

    expect(response.status).toBe(401);
  });

  it('non-numeric timestamp is rejected', async () => {
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': `time=not-a-number,sig1=${signatureFor(VALID_BODY)}`,
    }));

    expect(response.status).toBe(401);
  });

  it('non-hex signature is rejected', async () => {
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': `time=${NOW_SECONDS},sig1=${'z'.repeat(64)}`,
    }));

    expect(response.status).toBe(401);
  });

  it('stale timestamp is rejected', async () => {
    const time = NOW_SECONDS - 301;
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': webhookSignature(VALID_BODY, time),
    }));

    expect(response.status).toBe(401);
  });

  it('far-future timestamp is rejected', async () => {
    const time = NOW_SECONDS + 301;
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': webhookSignature(VALID_BODY, time),
    }));

    expect(response.status).toBe(401);
  });

  it('invalid HMAC is rejected', async () => {
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': `time=${NOW_SECONDS},sig1=${'a'.repeat(64)}`,
    }));

    expect(response.status).toBe(401);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('payload altered after signing is rejected', async () => {
    const signedBody = VALID_BODY;
    const alteredBody = '{"uid":"cf-uid-123","status":{"state":"error"}}';

    const response = await POST(request(alteredBody, {
      'Webhook-Signature': webhookSignature(signedBody),
    }));

    expect(response.status).toBe(401);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('whitespace and newline changes affect verification', async () => {
    const signedBody = '{"uid":"cf-uid-123","status":{"state":"ready"}}\n';

    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': webhookSignature(signedBody),
    }));

    expect(response.status).toBe(401);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('exact valid raw body succeeds', async () => {
    const exactBody = '{\n  "uid": "cf-uid-123",\n  "status": { "state": "ready" }\n}';

    const response = await POST(request(exactBody, {
      'Webhook-Signature': webhookSignature(exactBody),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assetId: 'asset-1', status: 'READY' });
  });

  it('valid signed payload calls the use case exactly once after creating system context', async () => {
    const response = await POST(request(VALID_BODY, {
      'Webhook-Signature': webhookSignature(VALID_BODY),
    }));

    expect(response.status).toBe(200);
    expect(createAppContext).toHaveBeenCalledTimes(1);
    expect(handleCloudflareStreamWebhook).toHaveBeenCalledTimes(1);
    expect(handleCloudflareStreamWebhook).toHaveBeenCalledWith(
      { uid: 'cf-uid-123', status: { state: 'ready' } },
      expect.any(Object),
    );
  });

  it('invalid and missing signatures call the use case zero times', async () => {
    await POST(request(VALID_BODY));
    await POST(request(VALID_BODY, {
      'Webhook-Signature': `time=${NOW_SECONDS},sig1=${'b'.repeat(64)}`,
    }));

    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('authenticated invalid JSON returns 400', async () => {
    const rawBody = '{"uid":"cf-uid-123","status":{"state":"ready"}';
    const response = await POST(request(rawBody, {
      'Webhook-Signature': webhookSignature(rawBody),
    }));

    expect(response.status).toBe(400);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('authenticated payload missing uid returns 400', async () => {
    const rawBody = '{"status":{"state":"ready"}}';
    const response = await POST(request(rawBody, {
      'Webhook-Signature': webhookSignature(rawBody),
    }));

    expect(response.status).toBe(400);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('authenticated payload missing valid status returns 400', async () => {
    const missingStatus = '{"uid":"cf-uid-123"}';
    const unsupportedStatus = '{"uid":"cf-uid-123","status":{"state":"unsupported"}}';

    const missingResponse = await POST(request(missingStatus, {
      'Webhook-Signature': webhookSignature(missingStatus),
    }));
    const unsupportedResponse = await POST(request(unsupportedStatus, {
      'Webhook-Signature': webhookSignature(unsupportedStatus),
    }));

    expect(missingResponse.status).toBe(400);
    expect(unsupportedResponse.status).toBe(400);
    expect(handleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('responses do not expose secret, signature, HMAC, or raw body', async () => {
    const secret = 'fake-secret-never-in-response';
    vi.stubEnv('CLOUDFLARE_WEBHOOK_SECRET', secret);
    const rawBody = '{"uid":"cf-uid-123","status":{"state":"ready"},"playback":{"hls":"https://signed.example/stream.m3u8"}}';
    const signature = webhookSignature(rawBody, NOW_SECONDS, 'wrong-secret');

    const response = await POST(request(rawBody, {
      'Webhook-Signature': signature,
    }));
    const text = await responseText(response);

    expect(response.status).toBe(401);
    expect(text).not.toContain(secret);
    expect(text).not.toContain(signature);
    expect(text).not.toContain(signatureFor(rawBody, NOW_SECONDS, secret));
    expect(text).not.toContain(rawBody);
    expect(text).not.toContain('signed.example');
  });

  it('logs do not expose secret, signature, raw payload, or playback URL', async () => {
    const secret = 'fake-secret-never-in-logs';
    vi.stubEnv('CLOUDFLARE_WEBHOOK_SECRET', secret);
    const rawBody = '{"uid":"cf-uid-123","status":{"state":"ready"},"playback":{"hls":"https://signed.example/stream.m3u8"}}';
    const signature = webhookSignature(rawBody, NOW_SECONDS, 'wrong-secret');

    await POST(request(rawBody, {
      'Webhook-Signature': signature,
    }));

    const serializedLogs = JSON.stringify(loggerMocks.warn.mock.calls.concat(loggerMocks.error.mock.calls));
    expect(serializedLogs).not.toContain(secret);
    expect(serializedLogs).not.toContain(signature);
    expect(serializedLogs).not.toContain(rawBody);
    expect(serializedLogs).not.toContain('signed.example');
    expect(serializedLogs).toContain('unauthorized_webhook');
  });

  it('repeated valid identical event follows current idempotent route behavior', async () => {
    const headers = { 'Webhook-Signature': webhookSignature(VALID_BODY) };

    const first = await POST(request(VALID_BODY, headers));
    const second = await POST(request(VALID_BODY, headers));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(handleCloudflareStreamWebhook).toHaveBeenCalledTimes(2);
    expect(handleCloudflareStreamWebhook).toHaveBeenNthCalledWith(1, { uid: 'cf-uid-123', status: { state: 'ready' } }, expect.any(Object));
    expect(handleCloudflareStreamWebhook).toHaveBeenNthCalledWith(2, { uid: 'cf-uid-123', status: { state: 'ready' } }, expect.any(Object));
  });
});
