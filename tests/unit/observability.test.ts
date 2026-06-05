import { afterEach, describe, expect, it, vi } from 'vitest';
import { elapsedMs, recordAlert, recordDurationMetric, recordMetric } from '@/lib/observability';

describe('observability metrics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('emits structured log metrics with sanitized payloads', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    recordMetric('stripe.webhook.processing_time', {
      durationMs: 123,
      callbackUrl: 'https://cdn.example.com/video.mp4?token=SECRET_TOKEN',
      status: 'processed',
    });

    const payload = JSON.stringify(infoSpy.mock.calls);
    expect(payload).toContain('[METRIC] stripe.webhook.processing_time');
    expect(payload).toContain('processed');
    expect(payload).toContain('https://cdn.example.com/video.mp4?redacted=1');
    expect(payload).not.toContain('SECRET_TOKEN');
  });

  it('emits alert metrics through error logs', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    recordAlert('media_proxy.upstream_error', { status: 502, host: 'cdn.example.com' });

    const payload = JSON.stringify(errorSpy.mock.calls);
    expect(payload).toContain('[METRIC] media_proxy.upstream_error');
    expect(payload).toContain('"alert":true');
    expect(payload).toContain('cdn.example.com');
  });

  it('records elapsed duration from a deterministic start time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T00:00:00.000Z'));
    const start = Date.now();
    vi.setSystemTime(new Date('2026-06-05T00:00:01.250Z'));

    expect(elapsedMs(start)).toBe(1250);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    recordDurationMetric('clerk.webhook.processing_time', start, { status: 'slow' }, { level: 'warn' });

    expect(JSON.stringify(warnSpy.mock.calls)).toContain('"durationMs":1250');
  });
});
