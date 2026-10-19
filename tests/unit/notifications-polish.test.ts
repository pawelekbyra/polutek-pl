/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { formatNotificationAge } from '@/app/components/notifications/notification-events';
import { pruneOldNotifications, READ_NOTIFICATION_RETENTION_DAYS, UNREAD_NOTIFICATION_RETENTION_DAYS } from '@/lib/modules/notifications/application/prune-notifications.use-case';

describe('formatNotificationAge', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('says how long ago in the viewer language, then falls back to a date after a week', () => {
    expect(formatNotificationAge(ago(20_000), 'en', now)).toBe('now');
    expect(formatNotificationAge(ago(5 * 60_000), 'en', now)).toBe('5 minutes ago');
    expect(formatNotificationAge(ago(3 * 3_600_000), 'en', now)).toBe('3 hours ago');
    expect(formatNotificationAge(ago(2 * 86_400_000), 'en', now)).toBe('2 days ago');
    expect(formatNotificationAge(ago(3 * 3_600_000), 'pl', now)).toContain('3');
    expect(formatNotificationAge(ago(30 * 86_400_000), 'en', now)).toMatch(/2026/);
    expect(formatNotificationAge('not a date', 'en', now)).toBe('');
  });
});

describe('pruneOldNotifications', () => {
  it('deletes read notifications after 90 days and any after a year', async () => {
    const deleteMany = vi.fn().mockResolvedValueOnce({ count: 4 }).mockResolvedValueOnce({ count: 1 });
    const now = new Date('2026-10-19T00:00:00Z');
    const result = await pruneOldNotifications({ now, db: { notification: { deleteMany } } as never });
    expect(result).toEqual({ readDeleted: 4, unreadDeleted: 1 });
    const day = 86_400_000;
    expect(deleteMany.mock.calls[0][0]).toEqual({ where: { read: true, createdAt: { lt: new Date(now.getTime() - READ_NOTIFICATION_RETENTION_DAYS * day) } } });
    expect(deleteMany.mock.calls[1][0]).toEqual({ where: { createdAt: { lt: new Date(now.getTime() - UNREAD_NOTIFICATION_RETENTION_DAYS * day) } } });
  });
});
