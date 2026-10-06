import { beforeEach, describe, expect, it, vi } from 'vitest';

const unsubscribeUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/modules/subscriptions', () => ({ unsubscribeUserFromContentNotifications: unsubscribeUser }));
vi.mock('@/lib/modules/email/infrastructure/email-event-lock.service');

import { handleSesEvent, normalizeSesEvent } from '@/lib/modules/email/application/handle-ses-event.use-case';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { sesEvent } from '../../../helpers/sns';

function makeCtx(initialStatus = 'SENT') {
  const recipients = [{ id: 'r1', email: 'person@example.com', status: initialStatus, resendEmailId: 'ses-msg-1' }];
  const prisma = {
    broadcastEmailRecipient: {
      findFirst: vi.fn(async ({ where }: any) => recipients.find((r) => r.resendEmailId === where.resendEmailId) ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = recipients.find((r) => r.id === where.id && r.status === where.status);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    emailSuppression: { upsert: vi.fn() },
    emailPreference: { updateMany: vi.fn() },
    user: { findUnique: vi.fn(async () => ({ id: 'u1' })) },
  };
  const ctx = createAppContext({ prisma: prisma as any, db: { read: prisma as any, writeTransaction: vi.fn((cb: any) => cb(prisma)) } as any, actor: { type: 'system', reason: 'test' } });
  return { ctx, prisma, recipients };
}
const run = (ctx: any, message: string, id = 'sns-1') => handleSesEvent(ctx, { snsMessageId: id, payload: JSON.parse(message) });
const bounce = (type = 'Permanent', extra: Record<string, unknown> = {}) => sesEvent('Bounce', { bounce: { bounceType: type, bouncedRecipients: [{ emailAddress: 'Person@Example.com' }] }, ...extra });

describe('normalizeSesEvent', () => {
  it('understands event publishing and plain identity notifications', () => {
    expect(normalizeSesEvent(JSON.parse(bounce()))).toMatchObject({ kind: 'bounce', eventType: 'email.bounced', sesMessageId: 'ses-msg-1', recipients: ['Person@Example.com'] });
    expect(normalizeSesEvent({ notificationType: 'Complaint', mail: { messageId: 'm', destination: ['a@b.c'] }, complaint: { complainedRecipients: [{ emailAddress: 'a@b.c' }] } })).toMatchObject({ kind: 'complaint', recipients: ['a@b.c'] });
    expect(normalizeSesEvent({ notificationType: 'Delivery', mail: { messageId: 'm', destination: ['a@b.c'] }, delivery: { recipients: ['a@b.c'] } })).toMatchObject({ kind: 'delivery' });
    expect(normalizeSesEvent(JSON.parse(bounce('Transient')))).toMatchObject({ kind: 'bounce_transient', eventType: 'email.bounced_transient' });
    expect(normalizeSesEvent(JSON.parse(sesEvent('Reject')))).toMatchObject({ kind: 'reject' });
    expect(normalizeSesEvent(JSON.parse(sesEvent('DeliveryDelay', { deliveryDelay: { delayedRecipients: [{ emailAddress: 'a@b.c' }] } })))).toMatchObject({ kind: 'delay', recipients: ['a@b.c'] });
  });

  it('ignores opens, clicks, unknown shapes and mail tagged for another app', () => {
    expect(normalizeSesEvent(JSON.parse(sesEvent('Open')))).toBeNull();
    expect(normalizeSesEvent(JSON.parse(sesEvent('Click')))).toBeNull();
    expect(normalizeSesEvent({ foo: 1 })).toBeNull();
    expect(normalizeSesEvent(null)).toBeNull();
    expect(normalizeSesEvent(JSON.parse(sesEvent('Bounce', {}, 'm', { app: ['pp-support'] })))).toBeNull();
    expect(normalizeSesEvent(JSON.parse(sesEvent('Delivery', {}, 'm', undefined)))).not.toBeNull(); // no tags (identity notifications): accepted
  });
});

describe('handleSesEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
    vi.mocked(EmailEventLockService.prototype.releaseWithSuccess).mockResolvedValue();
    vi.mocked(EmailEventLockService.prototype.releaseWithFailure).mockResolvedValue();
  });

  it('permanent bounce suppresses the address (lower-cased, source SES_SNS) and marks the recipient BOUNCED', async () => {
    const { ctx, prisma, recipients } = makeCtx();
    const result = await run(ctx, bounce());
    expect(result).toMatchObject({ ok: true, data: { received: true, accepted: true, duplicate: false } });
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'person@example.com' },
      create: expect.objectContaining({ reason: 'BOUNCE', source: 'SES_SNS', providerEmailId: 'ses-msg-1' }),
    }));
    expect(recipients[0].status).toBe('BOUNCED');
    expect(EmailEventLockService.prototype.releaseWithSuccess).toHaveBeenCalledWith('sns-1', { resendEmailId: 'ses-msg-1' });
    // Privacy: the lock payload carries identifiers only.
    expect(JSON.stringify(vi.mocked(EmailEventLockService.prototype.acquireLock).mock.calls)).not.toContain('example.com');
  });

  it('transient bounce and delivery delay are recorded only', async () => {
    const { ctx, prisma, recipients } = makeCtx();
    await run(ctx, bounce('Transient'), 's1');
    await run(ctx, sesEvent('DeliveryDelay', { deliveryDelay: { delayedRecipients: [{ emailAddress: 'a@b.c' }] } }), 's2');
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
    expect(recipients[0].status).toBe('SENT');
    expect(EmailEventLockService.prototype.acquireLock).toHaveBeenCalledWith(expect.objectContaining({ type: 'email.bounced_transient' }));
  });

  it('complaint suppresses, withdraws marketing consent (user and address) and marks COMPLAINED', async () => {
    const { ctx, prisma, recipients } = makeCtx();
    await run(ctx, sesEvent('Complaint', { complaint: { complainedRecipients: [{ emailAddress: 'person@example.com' }] } }));
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ reason: 'COMPLAINT' }) }));
    expect(unsubscribeUser).toHaveBeenCalledWith(ctx, 'u1');
    expect(prisma.emailPreference.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'person@example.com', marketingEmails: true }, data: expect.objectContaining({ marketingEmails: false }) }));
    expect(recipients[0].status).toBe('COMPLAINED');
  });

  it('is out-of-order safe: a late Delivery or Send never undoes a bounce', async () => {
    const { ctx, recipients } = makeCtx('BOUNCED');
    await run(ctx, sesEvent('Delivery', { delivery: { recipients: ['person@example.com'] } }), 'late-1');
    await run(ctx, sesEvent('Send'), 'late-2');
    expect(recipients[0].status).toBe('BOUNCED');
  });

  it('delivery moves SENT forward to DELIVERED', async () => {
    const { ctx, recipients } = makeCtx('SENT');
    await run(ctx, sesEvent('Delivery', { delivery: { recipients: ['person@example.com'] } }));
    expect(recipients[0].status).toBe('DELIVERED');
  });

  it('reject marks the recipient FAILED', async () => {
    const { ctx, recipients } = makeCtx('SENT');
    await run(ctx, sesEvent('Reject'));
    expect(recipients[0]).toMatchObject({ status: 'FAILED', error: 'SES_REJECTED' });
  });

  it('replay of the same SNS MessageId changes nothing', async () => {
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValueOnce('ALREADY_PROCESSED');
    const { ctx, prisma } = makeCtx();
    expect(await run(ctx, bounce())).toMatchObject({ ok: true, data: { duplicate: true } });
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('a lock conflict returns 503 so SNS retries', async () => {
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValueOnce('CONFLICT');
    const { ctx } = makeCtx();
    expect(await run(ctx, bounce())).toMatchObject({ ok: false, error: { statusCode: 503 } });
  });

  it('a database failure is an error (5xx), releases the lock as failed and suppresses nothing silently', async () => {
    const { ctx, prisma } = makeCtx();
    prisma.emailSuppression.upsert.mockRejectedValueOnce(new Error('DB down'));
    const result = await run(ctx, bounce());
    expect(result).toMatchObject({ ok: false, error: { statusCode: 500 } });
    expect(EmailEventLockService.prototype.releaseWithFailure).toHaveBeenCalledWith('sns-1', 'DB down');
  });

  it('unknown or foreign events return success without touching anything', async () => {
    const { ctx, prisma } = makeCtx();
    expect(await run(ctx, sesEvent('Open'))).toMatchObject({ ok: true, data: { ignored: true } });
    expect(EmailEventLockService.prototype.acquireLock).not.toHaveBeenCalled();
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });
});
