import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildStringToSign, type SnsMessage } from '@/lib/modules/email/infrastructure/sns-verifier';

/** Test-only: a throwaway RSA key and self-signed certificate (needs the openssl binary), and signed SNS messages. */
export function createTestSigner(days = 2) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sns-test-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', String(days), '-subj', '/CN=sns.amazonaws.com'], { stdio: 'ignore' });
    return { privateKey: readFileSync(path.join(dir, 'k.pem'), 'utf8'), certificate: readFileSync(path.join(dir, 'c.pem'), 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const TOPIC = 'arn:aws:sns:eu-north-1:123456789012:ses-events';
export const CERT_URL = 'https://sns.eu-north-1.amazonaws.com/SimpleNotificationService-0123456789abcdef0123456789abcdef.pem';

export function signedSnsMessage(
  signer: { privateKey: string },
  overrides: Partial<SnsMessage> & { Type?: SnsMessage['Type'] } = {},
  version: '1' | '2' = '2',
): SnsMessage {
  const type = overrides.Type ?? 'Notification';
  const base: Record<string, unknown> = {
    Type: type,
    MessageId: overrides.MessageId ?? 'msg-0001',
    TopicArn: TOPIC,
    Message: '{"hello":"world"}',
    Timestamp: new Date().toISOString(),
    SignatureVersion: version,
    SigningCertURL: CERT_URL,
    ...(type !== 'Notification' ? { Token: 'token-123', SubscribeURL: `https://sns.eu-north-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${TOPIC}&Token=token-123` } : {}),
    ...overrides,
  };
  const signer2 = createSign(version === '1' ? 'RSA-SHA1' : 'RSA-SHA256');
  signer2.update(buildStringToSign(base, type), 'utf8');
  base.Signature = signer2.sign(signer.privateKey, 'base64');
  return base as unknown as SnsMessage;
}

/** An SES event-publishing payload as SNS would carry it in `Message`. */
export function sesEvent(eventType: string, extra: Record<string, unknown> = {}, messageId = 'ses-msg-1', tags: Record<string, string[]> | undefined = { app: ['pawelperfect'] }) {
  return JSON.stringify({ eventType, mail: { messageId, destination: ['person@example.com'], ...(tags ? { tags } : {}) }, ...extra });
}
