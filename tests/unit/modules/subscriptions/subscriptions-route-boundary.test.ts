import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('subscriptions route consent boundary', () => {
  it('does not read arbitrary email from request body for subscribe/unsubscribe', () => {
    const source = fs.readFileSync('app/api/subscriptions/route.ts', 'utf8');

    expect(source).toContain('normalizeTrustedEmail');
    expect(source).not.toContain('.json()');
    expect(source).not.toMatch(/trustedEmail:\s*.*body/i);
  });
});
