import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContext } from '@/lib/modules/shared/app-context';
import { GetSubscriptionStatusUseCase } from '@/lib/modules/users/application/get-subscription-status.use-case';
import { SubscribeUseCase } from '@/lib/modules/users/application/subscribe.use-case';
import { UnsubscribeUseCase } from '@/lib/modules/users/application/unsubscribe.use-case';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';

vi.mock('@/lib/modules/channel/application/main-channel.service', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

const prismaMock = {
  subscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  creator: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((cb) => cb(prismaMock)),
};

describe('Subscription Use Cases', () => {
  const ctx = {
    prisma: prismaMock,
    actor: { type: 'user', userId: 'user_1' },
  } as unknown as AppContext;

  const mainChannel = { id: 'c1', slug: 'main' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mainChannel as any);
  });

  describe('GetSubscriptionStatusUseCase', () => {
    it('returns status when subscribed', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue({ id: 's1', createdAt: new Date() });
      prismaMock.creator.findUnique.mockResolvedValue({ id: 'c1', subscribersCount: 10, slug: 'main' });

      const result = await GetSubscriptionStatusUseCase.execute(ctx, 'user_1');

      expect(result.isSubscribed).toBe(true);
      expect(result.subscribersCount).toBe(10);
    });

    it('returns status when not subscribed', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.creator.findUnique.mockResolvedValue({ id: 'c1', subscribersCount: 5, slug: 'main' });

      const result = await GetSubscriptionStatusUseCase.execute(ctx, 'user_1');

      expect(result.isSubscribed).toBe(false);
      expect(result.subscribersCount).toBe(5);
    });
  });

  describe('SubscribeUseCase', () => {
    it('creates a new subscription and increments count', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.subscription.create.mockResolvedValue({ id: 's1', createdAt: new Date() });
      prismaMock.creator.update.mockResolvedValue({});
      prismaMock.creator.findUnique.mockResolvedValue({ id: 'c1', subscribersCount: 11, slug: 'main' });

      const result = await SubscribeUseCase.execute(ctx, 'user_1');

      expect(result.isSubscribed).toBe(true);
      expect(result.subscribersCount).toBe(11);
      expect(prismaMock.subscription.create).toHaveBeenCalled();
    });

    it('does not create if already exists', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue({ id: 's1', createdAt: new Date() });
      prismaMock.creator.findUnique.mockResolvedValue({ id: 'c1', subscribersCount: 10, slug: 'main' });

      const result = await SubscribeUseCase.execute(ctx, 'user_1');

      expect(result.isSubscribed).toBe(true);
      expect(prismaMock.subscription.create).not.toHaveBeenCalled();
    });
  });

  describe('UnsubscribeUseCase', () => {
    it('deletes subscription and decrements count', async () => {
      prismaMock.subscription.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.creator.updateMany.mockResolvedValue({});
      prismaMock.creator.findUnique.mockResolvedValue({ id: 'c1', subscribersCount: 9, slug: 'main' });

      const result = await UnsubscribeUseCase.execute(ctx, 'user_1');

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);
      expect(result.subscribersCount).toBe(9);
    });

    it('handles non-existent subscription', async () => {
      prismaMock.subscription.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.creator.findUnique.mockResolvedValue({ id: 'c1', subscribersCount: 9, slug: 'main' });

      const result = await UnsubscribeUseCase.execute(ctx, 'user_1');

      expect(result.deleted).toBe(false);
    });
  });
});
