import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSubscriptionStatusUseCase, SubscribeUseCase, UnsubscribeUseCase } from '@/lib/modules/subscriptions';
import { MainChannelService } from '@/lib/modules/channel';
import { AppContext } from '@/lib/modules/shared/app-context';
import { SubscriptionRepository } from '@/lib/modules/subscriptions/infrastructure/subscription.repository';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
    incrementSubscribersCount: vi.fn(),
    decrementSubscribersCount: vi.fn(),
  },
}));

const mockRepoInstance = {
  findByUserIdAndCreatorId: vi.fn(),
  create: vi.fn(),
  deleteByUserIdAndCreatorId: vi.fn(),
};

vi.mock('@/lib/modules/subscriptions/infrastructure/subscription.repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(function() {
      return mockRepoInstance;
  }),
}));

describe('Subscriptions Use-Cases', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', subscribersCount: 10 };
  const mockActor = { type: 'user', userId: 'u1', isPatron: false };
  const mockCtx = {
    actor: mockActor,
    db: {
      read: {},
      writeTransaction: vi.fn((cb) => cb({})),
    },
  } as unknown as AppContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mockMainChannel as any);
  });

  describe('GetSubscriptionStatusUseCase', () => {
    it('returns status when subscribed', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue({ id: 's1', createdAt: new Date() } as any);

      const result = await GetSubscriptionStatusUseCase.execute(mockCtx);

      expect(result.isSubscribed).toBe(true);
      expect(result.subscribersCount).toBe(10);
      expect(result.creatorSlug).toBe('polutek');
    });

    it('returns status when not subscribed', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue(null);

      const result = await GetSubscriptionStatusUseCase.execute(mockCtx);

      expect(result.isSubscribed).toBe(false);
      expect(result.subscribersCount).toBe(10);
    });
  });

  describe('SubscribeUseCase', () => {
    it('creates a new subscription and increments count', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue(null);
      mockRepoInstance.create.mockResolvedValue({ id: 's1', createdAt: new Date() } as any);
      vi.mocked(MainChannelService.getRequired).mockResolvedValueOnce(mockMainChannel as any) // first call
                                             .mockResolvedValueOnce({ ...mockMainChannel, subscribersCount: 11 } as any); // second call after update

      const result = await SubscribeUseCase.execute(mockCtx);

      expect(result.isSubscribed).toBe(true);
      expect(result.subscribersCount).toBe(11);
      expect(MainChannelService.incrementSubscribersCount).toHaveBeenCalled();
    });

    it('is idempotent: returns existing subscription without incrementing', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue({ id: 's1', createdAt: new Date() } as any);

      const result = await SubscribeUseCase.execute(mockCtx);

      expect(result.isSubscribed).toBe(true);
      expect(MainChannelService.incrementSubscribersCount).not.toHaveBeenCalled();
      expect(mockRepoInstance.create).not.toHaveBeenCalled();
    });
  });

  describe('UnsubscribeUseCase', () => {
    it('deletes existing subscription and decrements count', async () => {
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 1 } as any);
      vi.mocked(MainChannelService.getRequired).mockResolvedValueOnce(mockMainChannel as any)
                                             .mockResolvedValueOnce({ ...mockMainChannel, subscribersCount: 9 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx);

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);
      expect(result.subscribersCount).toBe(9);
      expect(MainChannelService.decrementSubscribersCount).toHaveBeenCalled();
    });

    it('handles non-existent subscription without decrementing', async () => {
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 0 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx);

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(false);
      expect(MainChannelService.decrementSubscribersCount).not.toHaveBeenCalled();
    });
  });
});
