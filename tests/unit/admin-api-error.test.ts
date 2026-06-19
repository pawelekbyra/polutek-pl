import { describe, expect, it } from 'vitest';
import { readAdminApiError } from '@/app/admin/videos/components/api-error';

describe('readAdminApiError', () => {
  it('prefers top-level message', () => {
    expect(readAdminApiError({ message: 'Top level reason', error: { message: 'Nested reason' } }, 'Fallback')).toBe('Top level reason');
  });

  it('uses nested error message before string error', () => {
    expect(readAdminApiError({ error: { message: 'Nested reason' } }, 'Fallback')).toBe('Nested reason');
  });

  it('uses string error before contextual fallback', () => {
    expect(readAdminApiError({ error: 'String reason' }, 'Fallback')).toBe('String reason');
  });

  it('uses contextual fallback when API payload has no specific reason', () => {
    expect(readAdminApiError({ error: { code: 'UNKNOWN' } }, 'Context fallback')).toBe('Context fallback');
  });
});
