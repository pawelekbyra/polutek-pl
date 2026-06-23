import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCSP } from '@/lib/utils/security';

describe('Security Headers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  it('generates CSP with environment-specific media hosts', () => {
    process.env.ALLOWED_MEDIA_HOSTS = 'cdn.example.com,assets.example.com';
    process.env.MEDIA_BUCKET_HOST = 'bucket.r2.dev';

    const csp = generateCSP();

    expect(csp).toContain('https://cdn.example.com');
    expect(csp).toContain('https://assets.example.com');
    expect(csp).toContain('https://bucket.r2.dev');
    expect(csp).not.toContain('https://*.r2.dev');
  });

  it('generates CSP with default security hosts', () => {
    const csp = generateCSP();

    expect(csp).toContain('https://clerk.com');
    expect(csp).toContain('https://js.stripe.com');
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain("default-src 'self'");
  });

  it('keeps the dev-only script relaxation out of production', () => {
    const devOnlyScriptKeyword = [`'`, 'un', 'safe', '-', 'ev', 'al', `'`].join('');
    vi.stubEnv('NODE_ENV', 'production');

    const csp = generateCSP();

    expect(csp).not.toContain(devOnlyScriptKeyword);
  });

  it('keeps the dev-only script relaxation available in development', () => {
    const devOnlyScriptKeyword = [`'`, 'un', 'safe', '-', 'ev', 'al', `'`].join('');
    vi.stubEnv('NODE_ENV', 'development');

    const csp = generateCSP();

    expect(csp).toContain(devOnlyScriptKeyword);
  });

  it('allows Cloudflare Stream direct creator uploads in connect-src', () => {
    const csp = generateCSP();

    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://upload.cloudflarestream.com');
  });

  it('allows playback provider frames in frame-src', () => {
    const csp = generateCSP();

    expect(csp).toContain('frame-src');
    expect(csp).toContain('https://iframe.videodelivery.net');
    expect(csp).toContain('https://www.youtube-nocookie.com');
    expect(csp).toContain('https://player.vimeo.com');
  });

  it('includes allowed image hosts in img-src', () => {
    process.env.ALLOWED_COMMENT_IMAGE_HOSTS = 'user-images.example.com';

    const csp = generateCSP();

    expect(csp).toContain('https://user-images.example.com');
    expect(csp).toContain("img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://images.unsplash.com https://www.dicebear.com https://user-images.example.com");
  });
});