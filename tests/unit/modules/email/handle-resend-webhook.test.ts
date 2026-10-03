import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleResendWebhook } from '@/lib/modules/email/application/handle-resend-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';

vi.mock('@/lib/modules/email/infrastructure/email-event-lock.service');

const OUR_TAGS = { app: 'pawelperfect', kind: 'broadcast' };

function makeCtx() {
  const recipients: Array<{ id: string; email: string; status: string; resendEmailId: string }> = [];
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
  };
  const ctx = createAppContext({
    prisma: prisma as any,
    db: { read: prisma as any, writeTransaction: vi.fn((cb: any) => cb(prisma)) } as any,
    actor: { type: 'system', reason: 'test' },
  });
  return { ctx, prisma, recipients };
}

function event(type: string, data: Record<string, unknown> = {}, eventId = 'evt_1') {
  return {
    type,
    eventId,
    created_at: '2026-10-03T10:00:00.000Z',
    data: { email_id: 're_1', to: ['Person@Example.com'], tags: OUR_TAGS, ...data },
  } as any;
}

describe('handleResendWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValue('ACQUIRED');
    vi.mocked(EmailEventLockService.prototype.releaseWithSuccess).mockResolvedValue();
    vi.mocked(EmailEventLockService.prototype.releaseWithFailure).mockResolvedValue();
  });

  it('rejects a payload that is not an object or has no data', async () => {
    const { ctx } = makeCtx();
    const notObject = await handleResendWebhook(ctx, 'nope' as any);
    const noData = await handleResendWebhook(ctx, { type: 'email.sent', eventId: 'e' } as any);
    expect(notObject.ok || noData.ok).toBe(false);
  });

  it('rejects an event without svix-id (needed for idempotency)', async () => {
    const { ctx } = makeCtx();
    const result = await handleResendWebhook(ctx, { ...event('email.sent'), eventId: undefined });
    expect(result.ok).toBe(false);
    expect(EmailEventLockService.prototype.acquireLock).not.toHaveBeenCalled();
  });

  it('acknowledges and ignores events it does not handle (incoming mail, opens, clicks)', async () => {
    const { ctx, prisma } = makeCtx();
    for (const type of ['email.received', 'email.opened', 'email.clicked', 'contact.updated']) {
      const result = await handleResendWebhook(ctx, event(type));
      expect(result.ok && result.data.ignored).toBe(true);
    }
    expect(prisma.broadcastEmailRecipient.findFirst).not.toHaveBeenCalled();
    expect(EmailEventLockService.prototype.acquireLock).not.toHaveBeenCalled();
  });

  it('ignores a bounce of mail this app did not send (PP Support shares the Resend account)', async () => {
    const { ctx, prisma } = makeCtx();
    const untagged = await handleResendWebhook(ctx, event('email.bounced', { tags: undefined }));
    const otherApp = await handleResendWebhook(ctx, event('email.bounced', { tags: { app: 'pp-support' } }));
    expect(untagged.ok && untagged.data.ignored).toBe(true);
    expect(otherApp.ok && otherApp.data.ignored).toBe(true);
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('blocks the address (lowercased) on a permanent bounce of a system mail', async () => {
    const { ctx, prisma } = makeCtx();
    const result = await handleResendWebhook(ctx, event('email.bounced', { bounce: { type: 'Permanent' } }));
    expect(result.ok).toBe(true);
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'person@example.com' },
      create: expect.objectContaining({ email: 'person@example.com', reason: 'BOUNCE', active: true }),
    }));
    expect(EmailEventLockService.prototype.releaseWithSuccess).toHaveBeenCalledWith('evt_1', { resendEmailId: 're_1' });
  });

  it('does not block an address on a transient bounce', async () => {
    const { ctx, prisma } = makeCtx();
    await handleResendWebhook(ctx, event('email.bounced', { bounce: { type: 'Transient' } }));
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('blocks on a complaint and uses the broadcast recipient address when there is one', async () => {
    const { ctx, prisma, recipients } = makeCtx();
    recipients.push({ id: 'r1', email: 'real@example.com', status: 'DELIVERED', resendEmailId: 're_1' });
    await handleResendWebhook(ctx, event('email.complained', { to: ['other@example.com'] }));
    expect(recipients[0].status).toBe('COMPLAINED');
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'real@example.com' },
      create: expect.objectContaining({ reason: 'COMPLAINT' }),
    }));
  });

  it('moves a broadcast recipient forward and never backward', async () => {
    const { ctx, recipients } = makeCtx();
    recipients.push({ id: 'r1', email: 'a@example.com', status: 'SENT', resendEmailId: 're_1' });
    await handleResendWebhook(ctx, event('email.delivered', {}, 'evt_d'));
    expect(recipients[0].status).toBe('DELIVERED');
    await handleResendWebhook(ctx, event('email.sent', {}, 'evt_s'));
    expect(recipients[0].status).toBe('DELIVERED');
  });

  it('marks a recipient FAILED on email.failed and email.suppressed', async () => {
    const { ctx, recipients } = makeCtx();
    recipients.push({ id: 'r1', email: 'a@example.com', status: 'SENT', resendEmailId: 're_1' });
    recipients.push({ id: 'r2', email: 'b@example.com', status: 'SENT', resendEmailId: 're_2' });
    await handleResendWebhook(ctx, event('email.failed', {}, 'evt_f'));
    await handleResendWebhook(ctx, event('email.suppressed', { email_id: 're_2' }, 'evt_x'));
    expect(recipients[0]).toMatchObject({ status: 'FAILED', error: 'PROVIDER_FAILED' });
    expect(recipients[1]).toMatchObject({ status: 'FAILED', error: 'SUPPRESSED_BY_PROVIDER' });
  });

  it('does nothing for an already processed event and asks for a retry on a lock conflict', async () => {
    const { ctx, prisma } = makeCtx();
    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValueOnce('ALREADY_PROCESSED');
    const duplicate = await handleResendWebhook(ctx, event('email.bounced'));
    expect(duplicate.ok && duplicate.data.duplicate).toBe(true);
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();

    vi.mocked(EmailEventLockService.prototype.acquireLock).mockResolvedValueOnce('CONFLICT');
    const conflict = await handleResendWebhook(ctx, event('email.bounced'));
    expect(!conflict.ok && conflict.error.statusCode).toBe(503);
  });

  it('records the failure on the lock when processing throws, so Resend retries', async () => {
    const { ctx, prisma } = makeCtx();
    prisma.emailSuppression.upsert.mockRejectedValueOnce(new Error('DB down'));
    const result = await handleResendWebhook(ctx, event('email.bounced'));
    expect(result.ok).toBe(false);
    expect(EmailEventLockService.prototype.releaseWithFailure).toHaveBeenCalledWith('evt_1', 'DB down');
  });

  it('gives up with 503 when the recipient keeps changing under it', async () => {
    const { ctx, prisma } = makeCtx();
    prisma.broadcastEmailRecipient.findFirst.mockResolvedValue({ id: 'r1', status: 'SENT' } as any);
    prisma.broadcastEmailRecipient.updateMany.mockResolvedValue({ count: 0 });
    const result = await handleResendWebhook(ctx, event('email.delivered'));
    expect(!result.ok && result.error.statusCode).toBe(503);
    expect(prisma.broadcastEmailRecipient.updateMany).toHaveBeenCalledTimes(3);
  });
});
