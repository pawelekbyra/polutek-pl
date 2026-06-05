import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger sanitization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts token-bearing URLs and sensitive object keys before logging', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.error('media failed', new Error('fetch failed for https://cdn.example.com/private/video.mp4?token=SECRET_TOKEN'), {
      token: 'SECRET_TOKEN',
      nested: {
        stripeSecret: 'sk_live_SECRET',
        callbackUrl: 'https://cdn.example.com/private/video.mp4?signature=abc123',
      },
    });

    const payload = JSON.stringify(errorSpy.mock.calls);
    expect(payload).toContain('[ERROR]');
    expect(payload).toContain('https://cdn.example.com/private/video.mp4?redacted=1');
    expect(payload).not.toContain('SECRET_TOKEN');
    expect(payload).not.toContain('signature=abc123');
    expect(payload).not.toContain('sk_live_SECRET');
  });

  it('handles circular payloads without throwing or expanding full objects', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const payload: { name: string; self?: unknown } = { name: 'cycle' };
    payload.self = payload;

    logger.warn('circular payload', payload);

    expect(JSON.stringify(warnSpy.mock.calls)).toContain('[Circular]');
  });
});
