import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAllowedSnsUrl, resetSnsCertificateCacheForTests, verifySnsMessage } from '@/lib/modules/email/infrastructure/sns-verifier';
import { CERT_URL, TOPIC, createTestSigner, signedSnsMessage } from '../../../helpers/sns';

let signer: ReturnType<typeof createTestSigner>;
let fetchCertificate: ReturnType<typeof vi.fn>;
const opts = () => ({ allowedTopicArns: [TOPIC], allowedRegions: ['eu-north-1'], fetchCertificate: fetchCertificate as unknown as (url: string) => Promise<string> });
const verify = (message: unknown, extra: Partial<ReturnType<typeof opts>> & { now?: () => number } = {}) => verifySnsMessage(JSON.stringify(message), { ...opts(), ...extra });

beforeAll(() => {
  signer = createTestSigner();
});
beforeEach(() => {
  resetSnsCertificateCacheForTests();
  fetchCertificate = vi.fn(async () => signer.certificate);
});

describe('SNS signature verification', () => {
  it.each([['1' as const], ['2' as const]])('accepts a correctly signed Notification (SignatureVersion %s)', async (version) => {
    expect(await verify(signedSnsMessage(signer, {}, version))).toMatchObject({ ok: true });
  });

  it('accepts a Notification with a Subject (Subject is part of the string to sign)', async () => {
    expect(await verify(signedSnsMessage(signer, { Subject: 'Amazon SES Email Event Notification' }))).toMatchObject({ ok: true });
  });

  it.each([['SubscriptionConfirmation' as const], ['UnsubscribeConfirmation' as const]])('accepts a signed %s', async (type) => {
    expect(await verify(signedSnsMessage(signer, { Type: type }, '1'))).toMatchObject({ ok: true });
    expect(await verify(signedSnsMessage(signer, { Type: type, MessageId: 'other' }, '2'))).toMatchObject({ ok: true });
  });

  it('rejects a tampered body, a tampered MessageId and a signature of another key', async () => {
    const good = signedSnsMessage(signer);
    expect(await verify({ ...good, Message: '{"hello":"evil"}' })).toEqual({ ok: false, reason: 'signature_mismatch' });
    expect(await verify({ ...good, MessageId: 'forged' })).toEqual({ ok: false, reason: 'signature_mismatch' });
    const other = createTestSigner();
    expect(await verify(signedSnsMessage(other))).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rejects a signature that was made for another message type', async () => {
    const good = signedSnsMessage(signer, { Type: 'Notification' });
    expect(await verify({ ...good, Type: 'UnsubscribeConfirmation', Token: 't', SubscribeURL: 'https://sns.eu-north-1.amazonaws.com/?Action=ConfirmSubscription' })).toMatchObject({ ok: false });
  });

  it.each([
    'https://sns.eu-north-1.amazonaws.com.evil.com/SimpleNotificationService-abc.pem',
    'https://evil.com/sns.eu-north-1.amazonaws.com/SimpleNotificationService-abc.pem',
    'https://sns.eu-north-1.amazonaws.com@evil.com/SimpleNotificationService-abc.pem',
    'http://sns.eu-north-1.amazonaws.com/SimpleNotificationService-abc.pem',
    'https://sns.eu-north-1.amazonaws.com:8443/SimpleNotificationService-abc.pem',
    'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem',
    'https://sns.eu-north-1.amazonaws.com/other.pem',
    'https://sns.eu-north-1.amazonaws.com/SimpleNotificationService-abc.pem?x=1',
    'https://sns.eu-north-1.amazonaws.com/../SimpleNotificationService-abc.pem.evil',
  ])('rejects the signing certificate URL %s without fetching it', async (url) => {
    const message = signedSnsMessage(signer, { SigningCertURL: url });
    expect(await verify(message)).toEqual({ ok: false, reason: 'cert_url_not_allowed' });
    expect(fetchCertificate).not.toHaveBeenCalled();
  });

  it('allows an extra region only when configured', async () => {
    const url = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-abc.pem';
    expect(isAllowedSnsUrl(url, ['eu-north-1'], 'cert')).toBe(false);
    expect(isAllowedSnsUrl(url, ['eu-north-1', 'eu-west-1'], 'cert')).toBe(true);
    expect(await verify(signedSnsMessage(signer, { SigningCertURL: url }), { allowedRegions: ['eu-north-1', 'eu-west-1'] })).toMatchObject({ ok: true });
  });

  it('validates the SubscribeURL host the same way', () => {
    const ok = 'https://sns.eu-north-1.amazonaws.com/?Action=ConfirmSubscription&Token=t';
    expect(isAllowedSnsUrl(ok, ['eu-north-1'], 'subscribe')).toBe(true);
    expect(isAllowedSnsUrl('https://sns.eu-north-1.amazonaws.com.evil.com/?Action=ConfirmSubscription', ['eu-north-1'], 'subscribe')).toBe(false);
    expect(isAllowedSnsUrl('https://evil.com/?Action=ConfirmSubscription', ['eu-north-1'], 'subscribe')).toBe(false);
    expect(isAllowedSnsUrl('https://sns.eu-north-1.amazonaws.com/?Action=Other', ['eu-north-1'], 'subscribe')).toBe(false);
  });

  it('rejects a topic outside the allowlist, and fails closed when the allowlist is empty', async () => {
    const message = signedSnsMessage(signer);
    expect(await verify(message, { allowedTopicArns: ['arn:aws:sns:eu-north-1:123456789012:other'] })).toEqual({ ok: false, reason: 'topic_not_allowed' });
    expect(await verify(message, { allowedTopicArns: [] })).toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchCertificate).not.toHaveBeenCalled();
  });

  it('timestamp policy: too old and from the future are rejected', async () => {
    const now = Date.now();
    const old = signedSnsMessage(signer, { Timestamp: new Date(now - 15 * 86_400_000).toISOString() });
    expect(await verify(old)).toEqual({ ok: false, reason: 'timestamp_invalid' });
    const future = signedSnsMessage(signer, { Timestamp: new Date(now + 3_600_000).toISOString() });
    expect(await verify(future)).toEqual({ ok: false, reason: 'timestamp_invalid' });
    const retry = signedSnsMessage(signer, { Timestamp: new Date(now - 5 * 86_400_000).toISOString() });
    expect(await verify(retry)).toMatchObject({ ok: true }); // SNS redelivers for days
  });

  it('rejects unknown types, versions, non-JSON, malformed shapes and a certificate that cannot be fetched or is expired', async () => {
    expect(await verifySnsMessage('not json', opts())).toEqual({ ok: false, reason: 'invalid_json' });
    expect(await verifySnsMessage('[]', opts())).toEqual({ ok: false, reason: 'invalid_shape' });
    expect(await verify({ ...signedSnsMessage(signer), Type: 'Weird' })).toEqual({ ok: false, reason: 'unknown_type' });
    expect(await verify({ ...signedSnsMessage(signer), Signature: undefined })).toEqual({ ok: false, reason: 'invalid_shape' });
    expect(await verify({ ...signedSnsMessage(signer, {}, '2'), SignatureVersion: '3' })).toEqual({ ok: false, reason: 'unsupported_signature_version' });
    fetchCertificate.mockRejectedValueOnce(new Error('timeout'));
    expect(await verify(signedSnsMessage(signer))).toEqual({ ok: false, reason: 'cert_fetch_failed' });
    // Certificate valid for 2 days; verifying "5 days later" must fail even with a fresh timestamp.
    const later = Date.now() + 5 * 86_400_000;
    const message = signedSnsMessage(signer, { Timestamp: new Date(later).toISOString() });
    expect(await verify(message, { now: () => later })).toEqual({ ok: false, reason: 'cert_fetch_failed' });
  });

  it('caches the certificate per URL', async () => {
    await verify(signedSnsMessage(signer));
    await verify(signedSnsMessage(signer, { MessageId: 'again' }));
    expect(fetchCertificate).toHaveBeenCalledTimes(1);
    expect(fetchCertificate).toHaveBeenCalledWith(CERT_URL);
  });
});

