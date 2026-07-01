import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { CloudflareSignedPlaybackTokenService } from '@/lib/modules/playback';

function base64UrlDecode(part: string): Buffer {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64');
}

function parseToken(token: string) {
  const [header, payload, signature] = token.split('.');
  return {
    header: JSON.parse(base64UrlDecode(header).toString('utf8')),
    payload: JSON.parse(base64UrlDecode(payload).toString('utf8')),
    signingInput: `${header}.${payload}`,
    signature: base64UrlDecode(signature),
  };
}

describe('CloudflareSignedPlaybackTokenService', () => {
  const originalEnv = { ...process.env };
  let publicKey: string;
  let privateKey: string;

  beforeEach(() => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = 'test-key-id';
    process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
    process.env.CLOUDFLARE_STREAM_SIGNED_TOKEN_TTL_SECONDS = '900';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('generates a locally signed RS256 Cloudflare Stream JWT with subject, kid, and expiry', () => {
    const result = CloudflareSignedPlaybackTokenService.createSignedPlaybackToken({
      videoUid: 'cf-playback-id',
      now: new Date('2026-06-26T00:00:00.000Z'),
    });

    const parsed = parseToken(result.token);
    const verifier = createVerify('RSA-SHA256').update(parsed.signingInput).end();

    expect(verifier.verify(publicKey, parsed.signature)).toBe(true);
    expect(parsed.header).toMatchObject({ alg: 'RS256', kid: 'test-key-id' });
    expect(parsed.payload).toMatchObject({ sub: 'cf-playback-id', kid: 'test-key-id', exp: 1782432900 });
    expect(result.expiresAt.toISOString()).toBe('2026-06-26T00:15:00.000Z');
    expect(result.expiresInSeconds).toBe(900);
  });

  it('fails closed when signing key configuration is missing', () => {
    delete process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY;
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM;

    expect(() => CloudflareSignedPlaybackTokenService.createSignedPlaybackToken({ videoUid: 'cf-playback-id' })).toThrow(
      'Cloudflare Stream signing private key is not configured'
    );
  });
});
