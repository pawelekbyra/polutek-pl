import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/feature-flags', () => ({ flags: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { buildNewUserNotice, newUserNotificationRecipient } from '@/lib/modules/email/application/notify-new-user';

describe('new-user notification', () => {
  it('goes to the owner by default and can be redirected or switched off', () => {
    expect(newUserNotificationRecipient({})).toBe('pawel.perfect@gmail.com');
    expect(newUserNotificationRecipient({ NEW_USER_NOTIFY_EMAIL: 'x@example.com' })).toBe('x@example.com');
    expect(newUserNotificationRecipient({ NEW_USER_NOTIFY_EMAIL: 'OFF' })).toBeNull();
    expect(newUserNotificationRecipient({ NEW_USER_NOTIFY_EMAIL: 'not-an-address' })).toBe('pawel.perfect@gmail.com');
  });

  it('shows nick, e-mail, language and time, and escapes the free-text nickname', () => {
    const { subject, html } = buildNewUserNotice({
      userId: 'u1', email: 'a@example.com', nickname: '<img src=x onerror=alert(1)>\nBcc: evil@example.com', language: 'pl', createdAt: new Date('2026-10-10T08:15:00Z'),
    });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('a@example.com');
    expect(html).toContain('2026-10-10 08:15 UTC');
  });

  it('copes with a missing nickname and language', () => {
    const { subject, html } = buildNewUserNotice({ userId: 'u', email: 'b@example.com', nickname: null, language: null, createdAt: new Date('2026-10-10T00:00:00Z') });
    expect(subject).toBe('Nowy użytkownik: (bez nicku)');
    expect(html).toContain('b@example.com');
  });
});
