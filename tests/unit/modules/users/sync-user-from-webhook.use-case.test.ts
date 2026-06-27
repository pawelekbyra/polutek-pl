import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users/application/sync-user-from-webhook.use-case';
import { EmailService } from '@/lib/services/email.service';

vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('SyncUserFromWebhookUseCase', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      subscription: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      emailPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      creator: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi.fn((fn) => fn(prisma)),
    };
  });

  function ctx() {
    return createAppContext({ actor: { type: 'system', reason: 'test' }, prisma });
  }

  it('reactivates an existing tombstoned Clerk user id without granting patron access', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'user_1',
        email: 'deleted_old@deleted.com',
        name: 'Usunięty Użytkownik',
        username: 'deleted_old',
        imageUrl: null,
        language: 'pl',
        isPatron: true,
      })
      .mockResolvedValueOnce(null);

    await SyncUserFromWebhookUseCase.execute(ctx(), {
      id: 'user_1',
      email: 'user@example.com',
      name: 'User One',
      username: 'userone',
      imageUrl: 'https://img.example.com/u.png',
      language: 'en',
    }, 'user.created');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        email: 'user@example.com',
        name: 'User One',
        username: 'userone',
        imageUrl: 'https://img.example.com/u.png',
        language: 'en',
        isDeleted: false,
      },
    });
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('isPatron');
    expect(EmailService.sendWelcomeEmail).toHaveBeenCalledWith('user@example.com', 'User One', 'en');
  });

  it('does not transfer mailing consent when a webhook email conflicts with another active identity', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'old_user', email: 'user@example.com', isDeleted: false });
    prisma.subscription.findMany.mockResolvedValue([{ creatorId: 'creator_1' }]);
    prisma.subscription.count.mockResolvedValue(3);

    await SyncUserFromWebhookUseCase.execute(ctx(), {
      id: 'new_user',
      email: 'user@example.com',
    }, 'user.created');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'old_user' },
      data: { email: expect.stringMatching(/^user@example\.com_stale_/) },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'new_user', email: 'user@example.com', role: 'USER' }),
    });
    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'old_user' } });
    expect(prisma.emailPreference.deleteMany).toHaveBeenCalledWith({ where: { userId: 'old_user' } });
    expect(prisma.creator.updateMany).toHaveBeenCalledWith({ where: { id: 'creator_1' }, data: { subscribersCount: 3 } });
  });
});
