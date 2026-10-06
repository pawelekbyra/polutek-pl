import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { handleSesEvent, loggerWarn, loggerError } = vi.hoisted(() => ({ handleSesEvent: vi.fn(), loggerWarn: vi.fn(), loggerError: vi.fn() }));
vi.mock('@/lib/modules/email/application/handle-ses-event.use-case', () => ({ handleSesEvent, normalizeSesEvent: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: loggerWarn, error: loggerError }, createScopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true, remaining: 1 })) }));

import { POST } from '@/app/api/webhooks/ses/route';
import { rateLimit } from '@/lib/rate-limit';
import { resetSnsCertificateCacheForTests } from '@/lib/modules/email/infrastructure/sns-verifier';
import { CERT_URL, TOPIC, createTestSigner, sesEvent, signedSnsMessage } from '../../helpers/sns';

let signer: ReturnType<typeof createTestSigner>;
const fetchMock = vi.fn();

const post = (body: unknown, raw = false) =>
  POST(new NextRequest('http://localhost/api/webhooks/ses', { method: 'POST', headers: { 'content-type': 'text/plain; charset=UTF-8' }, body: raw ? (body as string) : JSON.stringify(body) }));

beforeAll(() => {
  signer = createTestSigner();
});
beforeEach(() => {
  vi.clearAllMocks();
  resetSnsCertificateCacheForTests();
  process.env.SES_SNS_TOPIC_ARN = TOPIC;
  delete process.env.SES_SNS_REGIONS;
  delete process.env.AWS_REGION;
  handleSesEvent.mockResolvedValue({ ok: true, data: { received: true, accepted: true, duplicate: false } });
  fetchMock.mockImplementation(async (url: string) => (url === CERT_URL ? new Response(signer.certificate) : new Response('<ok/>', { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SES_SNS_TOPIC_ARN;
});

describe('POST /api/webhooks/ses', () => {
  it('fails closed (503) when SES_SNS_TOPIC_ARN is not set, without touching the network', async () => {
    delete process.env.SES_SNS_TOPIC_ARN;
    expect((await post(signedSnsMessage(signer))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(handleSesEvent).not.toHaveBeenCalled();
  });

  it('a valid signed Notification reaches the handler with the SNS MessageId and the parsed event', async () => {
    const message = sesEvent('Delivery', { delivery: { recipients: ['a@b.c'] } });
    const res = await post(signedSnsMessage(signer, { Message: message, MessageId: 'sns-42' }, '1'));
    expect(res.status).toBe(200);
    expect(handleSesEvent).toHaveBeenCalledWith(expect.anything(), { snsMessageId: 'sns-42', payload: JSON.parse(message) });
  });

  it('rejects a tampered body (403) and never calls the handler', async () => {
    const good = signedSnsMessage(signer, { Message: sesEvent('Bounce') });
    const res = await post({ ...good, Message: sesEvent('Complaint') });
    expect(res.status).toBe(403);
    expect(handleSesEvent).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith('[ses-events] Rejected: signature_mismatch');
  });

  it('rejects a certificate URL on a look-alike host without fetching it', async () => {
    const res = await post(signedSnsMessage(signer, { SigningCertURL: 'https://sns.eu-north-1.amazonaws.com.evil.com/SimpleNotificationService-abc.pem' }));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a message of another topic', async () => {
    process.env.SES_SNS_TOPIC_ARN = 'arn:aws:sns:eu-north-1:123456789012:another';
    expect((await post(signedSnsMessage(signer))).status).toBe(403);
    expect(handleSesEvent).not.toHaveBeenCalled();
  });

  it('SubscriptionConfirmation: verifies, then confirms with a GET to the (validated) SubscribeURL', async () => {
    const message = signedSnsMessage(signer, { Type: 'SubscriptionConfirmation' });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ confirmed: true });
    expect(fetchMock).toHaveBeenCalledWith(message.SubscribeURL, expect.objectContaining({ redirect: 'error' }));
  });

  it('SubscriptionConfirmation with a SubscribeURL on a foreign host is refused even when signed', async () => {
    const message = signedSnsMessage(signer, { Type: 'SubscriptionConfirmation', SubscribeURL: 'https://evil.example.com/?Action=ConfirmSubscription&Token=t' });
    expect((await post(message)).status).toBe(403);
    expect(fetchMock.mock.calls.every(([url]) => url === CERT_URL)).toBe(true);
  });

  it('SubscriptionConfirmation: a failing confirmation answers 502 so SNS retries', async () => {
    fetchMock.mockImplementation(async (url: string) => (url === CERT_URL ? new Response(signer.certificate) : new Response('no', { status: 500 })));
    expect((await post(signedSnsMessage(signer, { Type: 'SubscriptionConfirmation' }))).status).toBe(502);
  });

  it('UnsubscribeConfirmation is only logged', async () => {
    const res = await post(signedSnsMessage(signer, { Type: 'UnsubscribeConfirmation' }));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.every(([url]) => url === CERT_URL)).toBe(true);
    expect(loggerWarn).toHaveBeenCalledWith(expect.stringContaining('unsubscribed this endpoint'));
  });

  it('a non-JSON Message is acknowledged and ignored; unknown events are 200 (handler decides)', async () => {
    const res = await post(signedSnsMessage(signer, { Message: 'AmazonSnsSubscriptionSucceeded' }));
    expect(res.status).toBe(200);
    expect(handleSesEvent).not.toHaveBeenCalled();
  });

  it('handler error codes become the response status; a thrown database error is a 500 (SNS retries)', async () => {
    handleSesEvent.mockResolvedValueOnce({ ok: false, error: { message: 'busy', code: 'LOCK_CONFLICT', statusCode: 503 } });
    expect((await post(signedSnsMessage(signer, { Message: sesEvent('Bounce') }))).status).toBe(503);
    handleSesEvent.mockRejectedValueOnce(new Error('DB down'));
    expect((await post(signedSnsMessage(signer, { Message: sesEvent('Bounce'), MessageId: 'x2' }))).status).toBe(500);
  });

  it('limits body size (413) and rate (429), and survives a broken limiter', async () => {
    expect((await post('x'.repeat(300_000), true)).status).toBe(413);
    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, remaining: 0 });
    expect((await post(signedSnsMessage(signer))).status).toBe(429);
    vi.mocked(rateLimit).mockRejectedValueOnce(new Error('redis down'));
    expect((await post(signedSnsMessage(signer, { Message: sesEvent('Delivery') }))).status).toBe(200);
  });

  it('rejects garbage bodies', async () => {
    expect((await post('not json', true)).status).toBe(403);
    expect((await post('{}', true)).status).toBe(403);
  });
});
