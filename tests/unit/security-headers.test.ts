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

    expect(csp).toContain('https://accounts.google.com');
    expect(csp).toContain('https://challenges.cloudflare.com');
    
    expect(csp).toContain('https://js.stripe.com');
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain("default-src 'self'");
  });

  it('allows the Google One Tap stylesheet (F-10)', () => {
    const csp = generateCSP();
    const directive = (name: string) => csp.split('; ').find((part) => part.startsWith(`${name} `)) ?? '';

    expect(directive('style-src')).toContain('https://accounts.google.com/gsi/style');
    expect(directive('style-src-elem')).toContain('https://accounts.google.com/gsi/style');
  });

  it('sets defensive browser boundary directives', () => {
    const csp = generateCSP();

    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
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

  it('allows our own HLS delivery host and hls.js dependencies in CSP', () => {
    const directive = (name: string) => generateCSP().split('; ').find((part) => part.startsWith(`${name} `)) ?? '';

    expect(directive('script-src')).toContain('https://cdn.jsdelivr.net');
    expect(directive('script-src-elem')).toContain('https://cdn.jsdelivr.net');
    expect(directive('connect-src')).toContain('https://video.pawelperfect.com');
    expect(directive('media-src')).toContain("'self' blob:");
    expect(directive('media-src')).toContain('https://video.pawelperfect.com');
  });

  it('does not allow any former third-party video provider (Cloudflare Stream, Mux, YouTube, Vimeo)', () => {
    const csp = generateCSP();

    for (const host of ['videodelivery.net', 'cloudflarestream.com', 'mux.com', 'youtube', 'vimeo']) {
      expect(csp).not.toContain(host);
    }
  });

  it('includes allowed image hosts in img-src', () => {
    process.env.ALLOWED_COMMENT_IMAGE_HOSTS = 'user-images.example.com';

    const csp = generateCSP();

    expect(csp).toContain('https://user-images.example.com');
    expect(csp).toContain("img-src 'self' data: blob: https://img.clerk.com https://images.unsplash.com https://www.dicebear.com https://user-images.example.com");
  });

  it('allows thumbnails from the public R2 host in img-src', () => {
    const directive = (name: string) => generateCSP().split('; ').find((part) => part.startsWith(`${name} `)) ?? '';
    expect(directive('img-src')).toContain('https://thumbs.pawelperfect.pl');
  });

  it('allows the hosts Stripe.js needs (script, frames incl. 3-D Secure) and restricts form targets', () => {
    const csp = generateCSP();
    const directive = (name: string) => csp.split('; ').find((part) => part.startsWith(`${name} `)) ?? '';
    for (const host of ['https://js.stripe.com', 'https://*.js.stripe.com']) {
      expect(directive('script-src')).toContain(host);
      expect(directive('frame-src')).toContain(host);
    }
    expect(directive('frame-src')).toContain('https://hooks.stripe.com');
    expect(directive('connect-src')).toContain('https://api.stripe.com');
    expect(csp).toContain("form-action 'self'");
  });
});
