import { describe, it, expect, vi } from 'vitest';
import { flags } from '@/lib/feature-flags';

describe('Feature Flags Configuration', () => {
  it('no longer exposes the main creator slug (the main channel is the main_channel_id setting)', () => {
    expect('mainCreatorSlug' in flags).toBe(false);
  });

  it('demo fallbacks are on only outside production and only when asked for', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ENABLE_DEMO_FALLBACKS', 'true');
    expect(flags.demoFallbacks).toBe(true);

    vi.stubEnv('NODE_ENV', 'production');
    expect(flags.demoFallbacks).toBe(false);

    vi.unstubAllEnvs();
  });
});
