import { describe, it, expect, vi } from 'vitest';
import { flags } from '@/lib/feature-flags';

describe('Feature Flags Configuration', () => {
  it('throws in production if MAIN_CREATOR_SLUG is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MAIN_CREATOR_SLUG', '');

    // We need to re-import or bypass cache if possible, but let's see if flags.mainCreatorSlug triggers it
    expect(() => flags.mainCreatorSlug).toThrow('CRITICAL CONFIGURATION ERROR');

    vi.unstubAllEnvs();
  });

  it('returns null or slug in non-production if missing', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MAIN_CREATOR_SLUG', '');

    expect(flags.mainCreatorSlug).toBeNull();

    vi.unstubAllEnvs();
  });
});
