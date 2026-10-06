import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccountDeletionCleanupUseCase } from '@/lib/modules/users/application/account-deletion-cleanup.use-case';
import { sendAccountDeletedEmail } from '@/lib/modules/email';

const stripeCustomers = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('@/lib/modules/payments/infrastructure/stripe-client', () => ({ getStripeClient: () => ({ customers: stripeCustomers }) }));

vi.mock('@/lib/modules/email/application/send-transactional-email.use-case', () => ({
  sendAccountDeletedEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailLanguage: (language: string | null | undefined) => (language === 'pl' ? 'pl' : 'en'),
}));

const NOW = new Date('2026-06-26T00:00:00.000Z');

describe('AccountDeletionCleanupUseCase', () => {
  let prisma: any;
  let queuedCustomers: Map<string, { id: string; stripeCustomerId: string; userId: string | null; attempts: number; nextAttemptAt: Date }>;

  beforeEach(() => {
    vi.clearAllMocks();
    stripeCustomers.update.mockResolvedValue({});
    queuedCustomers = new Map();
    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'user@example.com', isDeleted: false, language: 'en' }),
        update: vi.fn().mockResolvedValue({}),
      },
      patronGrant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      subscription: {
        findMany: vi.fn().mockResolvedValue([{ creatorId: 'creator-1' }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(4),
      },
      creator: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      emailPreference: {
        findMany: vi.fn().mockResolvedValue([{ email: 'user@example.com' }]),
        findFirst: vi.fn().mockResolvedValue(null),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      account: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      twoFactor: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      passkey: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      userAvatar: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      comment: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
      broadcastEmailRecipient: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      emailEvent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      resendContactRemoval: { upsert: vi.fn() },
      stripeCustomerAnonymization: {
        upsert: vi.fn(async ({ create }: any) => {
          const row = { id: `s-${create.stripeCustomerId}`, attempts: 0, ...create };
          queuedCustomers.set(create.stripeCustomerId, row);
          return row;
        }),
        findMany: vi.fn(async ({ where }: any) => [...queuedCustomers.values()].filter((row) => where.stripeCustomerId.in.includes(row.stripeCustomerId))),
        deleteMany: vi.fn(async ({ where }: any) => {
          for (const [id, row] of queuedCustomers) if (row.id === where.id) queuedCustomers.delete(id);
          return { count: 1 };
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          for (const row of queuedCustomers.values()) if (row.id === where.id) Object.assign(row, data);
          return { count: 1 };
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn((fn) => fn(prisma)),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function ctx() {
    return createAppContext({ actor: { type: 'system', reason: 'test' }, prisma, now: () => NOW });
  }

  it('anonymizes user, revokes access, removes consent, resyncs subscriber count, and audits', async () => {
    await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION', reason: 'deleted' });

    expect(prisma.patronGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: NOW, reason: 'deleted' },
    });
    // Nothing may sign in to the tombstone again.
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.account.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.twoFactor.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.passkey.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.userAvatar.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.emailPreference.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'u1' }, { email: 'user@example.com' }] },
    });
    expect(prisma.creator.updateMany).toHaveBeenCalledWith({ where: { id: 'creator-1' }, data: { subscribersCount: 4 } });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ isDeleted: true, stripeCustomerId: null, imageUrl: null }),
    }));
    // A reserved domain: the tombstone address can never reach a real mailbox.
    expect(prisma.user.update.mock.calls[0][0].data.email).toMatch(/^deleted_.*@deleted\.invalid$/);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith('user@example.com', 'en');
  });

  describe('Stripe Customer (PA-03)', () => {
    const withCustomer = () => prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', isDeleted: false, language: 'en', stripeCustomerId: 'cus_123' });

    it('erases e-mail, name, phone, description and the userId metadata at Stripe and keeps nothing queued', async () => {
      withCustomer();
      await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });

      expect(stripeCustomers.update).toHaveBeenCalledWith('cus_123', { email: '', name: '', phone: '', description: '', metadata: { userId: '' } });
      expect(queuedCustomers.size).toBe(0);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'STRIPE_CUSTOMER_ANONYMIZED' }) }));
    });

    it('a Stripe outage never fails the deletion: the erasure stays queued with a backoff for the cron', async () => {
      withCustomer();
      stripeCustomers.update.mockRejectedValue(new Error('stripe down'));

      const result = await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });

      expect(result.cleaned).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
      const row = queuedCustomers.get('cus_123')!;
      expect(row.attempts).toBe(1);
      expect(row.nextAttemptAt.getTime()).toBeGreaterThan(NOW.getTime());
    });

    it('a person who never paid has no customer, so nothing is queued or sent', async () => {
      await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });
      expect(stripeCustomers.update).not.toHaveBeenCalled();
      expect(prisma.stripeCustomerAnonymization.upsert).not.toHaveBeenCalled();
    });

    it('a customer Stripe no longer knows counts as done', async () => {
      withCustomer();
      stripeCustomers.update.mockRejectedValue(Object.assign(new Error('No such customer'), { code: 'resource_missing' }));
      await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });
      expect(queuedCustomers.size).toBe(0);
    });
  });

  it('erases the content of every comment but keeps the rows for the threads', async () => {
    await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });

    expect(prisma.comment.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'u1', status: { not: 'DELETED' } },
      data: { status: 'DELETED', deletedAt: NOW, deletedById: 'u1', deletedReason: 'AUTHOR_DELETED' },
    });
    expect(prisma.comment.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'u1', OR: [{ text: { not: '' } }, { imageUrl: { not: null } }] },
      data: { text: '', imageUrl: null },
    });
  });

  it('removes the address from e-mail history and skips broadcasts still waiting for it', async () => {
    await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });

    const tombstone = prisma.user.update.mock.calls[0][0].data.email;
    const owner = [{ userId: 'u1' }, { email: { in: ['user@example.com'] } }];
    expect(prisma.broadcastEmailRecipient.updateMany).toHaveBeenCalledWith({
      where: { OR: owner, status: 'PENDING' },
      data: { status: 'SKIPPED', error: 'ACCOUNT_DELETED' },
    });
    expect(prisma.broadcastEmailRecipient.updateMany).toHaveBeenCalledWith({ where: { OR: owner }, data: { email: tombstone } });
    expect(prisma.emailEvent.updateMany).toHaveBeenCalledWith({
      where: { OR: owner },
      data: { email: null, payload: { redacted: 'ACCOUNT_DELETED' } },
    });
  });

  it('deletes the e-mail consent rows and needs no external audience (the local database is the only record)', async () => {
    const result = await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });

    expect(result.cleaned).toBe(true);
    expect(prisma.emailPreference.deleteMany).toHaveBeenCalled();
    expect(prisma.resendContactRemoval.upsert).not.toHaveBeenCalled();
  });

  it('treats missing local user as successful idempotent cleanup', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'missing', source: 'APP_ACCOUNT_DELETION' });

    expect(result).toEqual({ cleaned: false, alreadyDeleted: true, originalEmail: null });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('is idempotent for an already anonymized deleted user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'deleted_abc@deleted.com', isDeleted: true });
    prisma.emailPreference.findMany.mockResolvedValue([]);

    await AccountDeletionCleanupUseCase.execute(ctx(), { userId: 'u1', source: 'APP_ACCOUNT_DELETION' });

    expect(prisma.user.update.mock.calls[0][0].data.email).toBe('deleted_abc@deleted.com');
    expect(sendAccountDeletedEmail).not.toHaveBeenCalled();
  });
});
