import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/feature-flags', () => ({ flags: { mainCreatorSlug: 'polutek' } }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { getEmailFrom } from '@/lib/modules/email/infrastructure/email.transport';

describe('email sender display name', () => {
  afterEach(() => {
    delete process.env.EMAIL_FROM;
  });

  it('adds the brand name to a bare EMAIL_FROM address', () => {
    process.env.EMAIL_FROM = 'no-reply@pawelperfect.com';
    expect(getEmailFrom()).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
  });

  it('keeps an EMAIL_FROM that already has a display name', () => {
    process.env.EMAIL_FROM = 'Someone <x@pawelperfect.pl>';
    expect(getEmailFrom()).toBe('Someone <x@pawelperfect.pl>');
  });

  it('falls back to the brand sender when EMAIL_FROM is unset', () => {
    expect(getEmailFrom()).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
  });
});
