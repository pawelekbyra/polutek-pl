import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordAuditEvent, recordAuditEventSafe, prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
    notificationTemplate: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    recordAuditEvent: vi.fn(),
    recordAuditEventSafe: vi.fn(),
    prismaMock,
  };
});

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
  recordAuditEventSafe: (...a: unknown[]) => recordAuditEventSafe(...a),
  resolveAdminAuditContext: vi.fn(async (id?: string) => ({
    actor: id ? { type: 'admin', userId: id } : { type: 'admin', userId: 'session-admin' },
  })),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { broadcastNotification } from '@/lib/modules/notifications/application/broadcast-notification.use-case';
import {
  upsertNotificationTemplate,
  resetNotificationTemplate,
} from '@/lib/modules/notifications/application/notification-templates.use-case';
import { resyncSubscribers } from '@/lib/modules/channel/application/resync-subscribers.use-case';
import { ChannelRepository } from '@/lib/modules/channel/infrastructure/channel.repository';
import { createAppContext } from '@/lib/modules/shared/app-context';

beforeEach(() => {
  vi.clearAllMocks();
  recordAuditEvent.mockResolvedValue({});
  recordAuditEventSafe.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn({ ...prismaMock, marker: 'tx' }));
});

describe('notifications audit', () => {
  it('audits a broadcast with counts only, in the same transaction as the insert', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', notificationPreference: null },
      { id: 'u2', notificationPreference: { systemEnabled: false } },
    ]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 });

    const res = await broadcastNotification({
      titlePl: 'Tajny tytul', titleEn: 'Secret title', bodyPl: 'x', bodyEn: 'y', audience: 'ALL', href: '/a',
    });

    expect(res.recipientCount).toBe(1);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const [, event, usedTx] = recordAuditEvent.mock.calls[0];
    expect(event).toMatchObject({ action: 'NOTIFICATION_BROADCAST_SENT', metadata: { audience: 'ALL', recipientCount: 1, hasHref: true } });
    expect(JSON.stringify(event)).not.toContain('Tajny');
    expect(JSON.stringify(event)).not.toContain('u1');
    expect(usedTx.marker).toBe('tx');
  });

  it('does not audit an empty broadcast (nothing was sent)', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await broadcastNotification({ titlePl: 'a', titleEn: 'a', bodyPl: 'a', bodyEn: 'a', audience: 'PATRONS' });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('audits template save and reset without the template text', async () => {
    prismaMock.notificationTemplate.upsert.mockResolvedValue({ kind: 'SYSTEM' });
    prismaMock.notificationTemplate.deleteMany.mockResolvedValue({ count: 1 });

    await upsertNotificationTemplate({ kind: 'SYSTEM', titlePl: 'sekret', titleEn: 'a', bodyPl: 'b', bodyEn: 'c', updatedByAdminId: 'admin-9' });
    await resetNotificationTemplate('SYSTEM');

    const [saveCtx, save] = recordAuditEvent.mock.calls[0];
    expect(saveCtx.actor).toEqual({ type: 'admin', userId: 'admin-9' });
    expect(save).toMatchObject({ action: 'NOTIFICATION_TEMPLATE_SAVED', targetType: 'NotificationTemplate', targetId: 'SYSTEM' });
    expect(JSON.stringify(save)).not.toContain('sekret');
    expect(recordAuditEvent.mock.calls[1][1]).toMatchObject({
      action: 'NOTIFICATION_TEMPLATE_RESET', targetId: 'SYSTEM', metadata: { hadOverride: true },
    });
  });
});

describe('resyncSubscribers audit', () => {
  it('records SUBSCRIBERS_RESYNCED only after a successful admin resync', async () => {
    (ChannelRepository as any).prototype.findAllCreators = vi.fn().mockResolvedValue([{ id: 'c1' }]);
    (ChannelRepository as any).prototype.syncSubscribersCount = vi.fn().mockResolvedValue({ id: 'c1', subscribersCount: 7 });

    await resyncSubscribers(createAppContext({ actor: { type: 'guest' } }));
    expect(recordAuditEventSafe).not.toHaveBeenCalled();

    await resyncSubscribers(createAppContext({ actor: { type: 'admin', userId: 'a1' } }));
    expect(recordAuditEventSafe).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'SUBSCRIBERS_RESYNCED', metadata: { creatorCount: 1, subscribersCounts: [7] } }),
    );
  });
});
