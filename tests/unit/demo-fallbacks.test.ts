import { afterEach, describe, expect, it, vi } from 'vitest';
import { canUseDemoFallbacks, flags } from '@/lib/feature-flags';

describe('demo fallback feature flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('never enables demo fallbacks in production even when env is true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_DEMO_FALLBACKS', 'true');

    expect(canUseDemoFallbacks()).toBe(false);
    expect(flags.demoFallbacks).toBe(false);
  });

  it('allows explicit demo fallbacks outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_DEMO_FALLBACKS', 'true');

    expect(canUseDemoFallbacks()).toBe(true);
    expect(flags.demoFallbacks).toBe(true);
  });
});
