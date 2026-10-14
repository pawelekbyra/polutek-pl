import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailsSend } };
  }),
}));
vi.mock('@/lib/feature-flags', () => ({ flags: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { getEmailProvider, sendEmail } from '@/lib/modules/email/infrastructure/resend-email.transport';
import { buildPostmarkPayload, isProviderUnavailable, postmarkStream, sendViaPostmark, type PostmarkMessage } from '@/lib/modules/email/infrastructure/postmark-email.transport';
import { checkBasicAuth, normalizePostmarkEvent } from '@/lib/modules/email/infrastructure/postmark-webhook';

const message: PostmarkMessage = {
  from: 'Pawel Perfect <no-reply@pawelperfect.com>',
  to: 'a@example.com',
  subject: 'Temat',
  html: '<p>x</p>',
  text: 'x',
  replyTo: 'support@pawelperfect.com',
  headers: { 'Auto-Submitted': 'auto-generated', 'Feedback-ID': 'welcome:tx:pp:ppmail', 'List-Unsubscribe': '<https://x/u>' },
  tag: 'welcome',
  metadata: { app: 'pawelperfect', kind: 'welcome' },
};
const okResponse = () => new Response(JSON.stringify({ ErrorCode: 0, Message: 'OK', MessageID: 'pm-123' }), { status: 200 });
const errResponse = (code: number, status = 422, msg = 'nope') => new Response(JSON.stringify({ ErrorCode: code, Message: msg }), { status });
const env = { POSTMARK_SERVER_TOKEN: 'tok_secret' };

describe('Postmark payload', () => {
  it('maps the message to the Email API: streams, no tracking, metadata, no foreign Feedback-ID', () => {
    const p = buildPostmarkPayload(message, env);
    expect(p).toMatchObject({
      From: message.from, To: 'a@example.com', Subject: 'Temat', HtmlBody: '<p>x</p>', TextBody: 'x', ReplyTo: 'support@pawelperfect.com',
      Tag: 'welcome', Metadata: { app: 'pawelperfect', kind: 'welcome' }, MessageStream: 'outbound', TrackOpens: false, TrackLinks: 'None',
    });
    expect(p.Headers).toEqual([{ Name: 'Auto-Submitted', Value: 'auto-generated' }, { Name: 'List-Unsubscribe', Value: '<https://x/u>' }]);
  });

  it('sends mass mail through the broadcast stream, overridable by env', () => {
    expect(postmarkStream('news', {})).toBe('broadcast');
    expect(postmarkStream(undefined, {})).toBe('outbound');
    expect(postmarkStream('news', { POSTMARK_STREAM_NEWS: 'newsletter' })).toBe('newsletter');
    expect(buildPostmarkPayload({ ...message, stream: 'news' }, env).MessageStream).toBe('broadcast');
  });
});

describe('sendViaPostmark', () => {
  it('posts to the Email API with the server token and returns the message id', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse());
    const r = await sendViaPostmark(message, fetcher as unknown as typeof fetch, env);
    expect(r).toEqual({ ok: true, id: 'pm-123' });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.postmarkapp.com/email');
    expect(init.headers['X-Postmark-Server-Token']).toBe('tok_secret');
    expect(init.method).toBe('POST');
  });

  it('maps API errors and network failures, and never leaks the token', async () => {
    const bad = await sendViaPostmark(message, vi.fn().mockResolvedValue(errResponse(406, 422, 'inactive')) as unknown as typeof fetch, env);
    expect(bad).toEqual({ ok: false, error: { name: 'PostmarkError406', message: 'inactive', statusCode: 422 } });
    const net = await sendViaPostmark(message, vi.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch, env);
    expect(net.ok).toBe(false);
    if (!net.ok) {
      expect(net.error.statusCode).toBeNull();
      expect(JSON.stringify(net)).not.toContain('tok_secret');
    }
    const none = await sendViaPostmark(message, vi.fn() as unknown as typeof fetch, {});
    expect(none).toMatchObject({ ok: false, error: { name: 'PostmarkNotConfigured' } });
  });

  it('treats outages, a rejected token and an account in test mode as "provider unavailable", recipient errors as final', () => {
    expect(isProviderUnavailable({ name: 'PostmarkError10', message: '', statusCode: 401 })).toBe(true);
    expect(isProviderUnavailable({ name: 'PostmarkError412', message: '', statusCode: 422 })).toBe(true);
    expect(isProviderUnavailable({ name: 'x', message: '', statusCode: 503 })).toBe(true);
    expect(isProviderUnavailable({ name: 'x', message: '', statusCode: null })).toBe(true);
    expect(isProviderUnavailable({ name: 'PostmarkError406', message: '', statusCode: 422 })).toBe(false);
    expect(isProviderUnavailable({ name: 'PostmarkError300', message: '', statusCode: 422 })).toBe(false);
  });
});

describe('sendEmail provider switch', () => {
  const base = { to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl' as const, kind: 'welcome' };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'no-reply@pawelperfect.com';
    delete process.env.EMAIL_PROVIDER;
    delete process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.EMAIL_FROM_NEWS;
    emailsSend.mockResolvedValue({ data: { id: 'rs_1' }, error: null });
  });

  it('uses Resend by default and when Postmark is selected without a token', async () => {
    expect(getEmailProvider({})).toBe('resend');
    expect(getEmailProvider({ EMAIL_PROVIDER: 'postmark' })).toBe('resend');
    await sendEmail(base);
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });

  it('sends through Postmark when selected and does not touch Resend on success', async () => {
    process.env.EMAIL_PROVIDER = 'postmark';
    process.env.POSTMARK_SERVER_TOKEN = 'tok_secret';
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    const r = await sendEmail({ ...base, stream: 'news' });
    expect(r).toEqual({ ok: true, id: 'pm-123' });
    expect(emailsSend).not.toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.MessageStream).toBe('broadcast');
    expect(body.Metadata.app).toBe('pawelperfect');
  });

  it('falls back to Resend when Postmark is down or the account is still in test mode', async () => {
    process.env.EMAIL_PROVIDER = 'postmark';
    process.env.POSTMARK_SERVER_TOKEN = 'tok_secret';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errResponse(412, 422, 'pending approval')));
    const r = await sendEmail(base);
    expect(r).toEqual({ ok: true, id: 'rs_1' });
    expect(emailsSend).toHaveBeenCalledTimes(1);
  });

  it('does not fall back for recipient errors: the address is the problem, not the provider', async () => {
    process.env.EMAIL_PROVIDER = 'postmark';
    process.env.POSTMARK_SERVER_TOKEN = 'tok_secret';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errResponse(406, 422, 'inactive')));
    const r = await sendEmail(base);
    expect(r.ok).toBe(false);
    expect(emailsSend).not.toHaveBeenCalled();
  });
});

describe('Postmark webhook events', () => {
  const meta = { app: 'pawelperfect', kind: 'welcome' };

  it('maps delivery, hard bounce, soft bounce and spam complaint to the shared event types', () => {
    expect(normalizePostmarkEvent({ RecordType: 'Delivery', MessageID: 'm1', Recipient: 'a@example.com', DeliveredAt: '2026-10-08T10:00:00Z', Metadata: meta })).toMatchObject({
      type: 'email.delivered', eventId: 'postmark:Delivery:m1:', data: { email_id: 'm1', to: ['a@example.com'], tags: meta },
    });
    expect(normalizePostmarkEvent({ RecordType: 'Bounce', ID: 77, MessageID: 'm1', Email: 'a@example.com', Type: 'HardBounce', Inactive: true, Metadata: meta })).toMatchObject({
      type: 'email.bounced', eventId: 'postmark:Bounce:m1:77', data: { bounce: { type: 'permanent', subType: 'HardBounce' } },
    });
    expect(normalizePostmarkEvent({ RecordType: 'Bounce', ID: 78, MessageID: 'm2', Email: 'a@example.com', Type: 'Transient', Inactive: false, Metadata: meta })?.data.bounce?.type).toBe('transient');
    expect(normalizePostmarkEvent({ RecordType: 'SpamComplaint', ID: 5, MessageID: 'm3', Email: 'a@example.com', Metadata: meta })).toMatchObject({ type: 'email.complained', data: { to: ['a@example.com'] } });
  });

  it('ignores events the app does not act on and malformed bodies', () => {
    expect(normalizePostmarkEvent({ RecordType: 'Open', MessageID: 'm1' })).toBeNull();
    expect(normalizePostmarkEvent({ RecordType: 'SubscriptionChange', MessageID: 'm1' })).toBeNull();
    expect(normalizePostmarkEvent({ RecordType: 'Bounce' })).toBeNull();
    expect(normalizePostmarkEvent(null)).toBeNull();
    expect(normalizePostmarkEvent('x')).toBeNull();
  });

  it('checks Basic credentials in constant time and rejects anything else', () => {
    const header = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
    expect(checkBasicAuth(header('pm', 's3cret:with:colons'), 'pm', 's3cret:with:colons')).toBe(true);
    expect(checkBasicAuth(header('pm', 'wrong'), 'pm', 's3cret')).toBe(false);
    expect(checkBasicAuth(header('other', 's3cret'), 'pm', 's3cret')).toBe(false);
    expect(checkBasicAuth('Bearer abc', 'pm', 's3cret')).toBe(false);
    expect(checkBasicAuth(null, 'pm', 's3cret')).toBe(false);
    expect(checkBasicAuth('Basic !!!', 'pm', 's3cret')).toBe(false);
  });
});
