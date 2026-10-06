import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSubscriptionStatusUseCase, SubscribeUseCase, UnsubscribeUseCase } from '@/lib/modules/subscriptions';
import { MainChannelService } from '@/lib/modules/channel';
import { AppContext } from '@/lib/modules/shared/app-context';
import { AppError } from '@/lib/modules/shared/app-error';

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

const mockPreferenceRepoInstance = {
  recordExplicitContentOptIn: vi.fn(),
  recordExplicitContentOptOut: vi.fn(),
};

vi.mock('@/lib/modules/subscriptions/infrastructure/email-preference.repository', () => ({
  EmailPreferenceRepository: vi.fn().mockImplementation(function() {
    return mockPreferenceRepoInstance;
  }),
}));

vi.mock('@/lib/logger', () => {
  return {
    createScopedLogger: vi.fn().mockReturnValue({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    }),
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    }
  };
});

describe('Subscriptions Use-Cases', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', subscribersCount: 10 };
  const mockActor = { type: 'user', userId: 'u1' };
  const mockCtx = {
    actor: mockActor,
    requestId: 'req_123',
    db: {
      read: {},
      writeTransaction: vi.fn((cb) => cb({})),
    },
  } as unknown as AppContext;

  const trustedEmail = 'USER@Example.COM';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mockMainChannel as any);
    mockPreferenceRepoInstance.recordExplicitContentOptIn.mockResolvedValue({ id: 'pref_1', recorded: true });
    mockPreferenceRepoInstance.recordExplicitContentOptOut.mockResolvedValue({ id: 'pref_1', recorded: true });
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
    it('creates exactly one subscription, records explicit opt-in, and never talks to an external audience', async () => {
      const created = { id: 's1', createdAt: new Date() } as any;
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue(null);
      mockRepoInstance.create.mockResolvedValue(created);
      vi.mocked(MainChannelService.getRequired).mockResolvedValueOnce(mockMainChannel as any)
                                             .mockResolvedValueOnce({ ...mockMainChannel, subscribersCount: 11 } as any);

      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail });

      expect(result.isSubscribed).toBe(true);
      expect(result.subscribersCount).toBe(11);
      expect(mockRepoInstance.create).toHaveBeenCalledTimes(1);
      expect(mockPreferenceRepoInstance.recordExplicitContentOptIn).toHaveBeenCalledWith('u1', 'user@example.com', {});
      expect(MainChannelService.incrementSubscribersCount).toHaveBeenCalled();
    });

    it('throws AppError 409 when recorded: false (FOREIGN_EMAIL_CONFLICT)', async () => {
      mockPreferenceRepoInstance.recordExplicitContentOptIn.mockResolvedValue({
        id: null,
        recorded: false,
        reason: 'FOREIGN_EMAIL_CONFLICT'
      });

      const promise = SubscribeUseCase.execute(mockCtx, { trustedEmail });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 409,
        code: 'EMAIL_PREFERENCE_IDENTITY_CONFLICT',
        message: 'Email notification preferences could not be updated for this account.'
      });

      expect(mockRepoInstance.create).not.toHaveBeenCalled();
      expect(MainChannelService.incrementSubscribersCount).not.toHaveBeenCalled();
    });

    it('handles the by-userId foreign email conflict by throwing 409 and avoiding side effects', async () => {
       // Proof that SubscribeUseCase handles ANY recorded: false from the repository as a 409
       mockPreferenceRepoInstance.recordExplicitContentOptIn.mockResolvedValue({
         id: null,
         recorded: false,
         reason: 'FOREIGN_EMAIL_CONFLICT'
       });

       const promise = SubscribeUseCase.execute(mockCtx, { trustedEmail });

       await expect(promise).rejects.toMatchObject({ statusCode: 409 });
       expect(mockRepoInstance.create).not.toHaveBeenCalled();
    });

    it('is idempotent and can retry provider sync without duplicating Subscription', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue({ id: 's1', createdAt: new Date() } as any);

      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail });

      expect(result.isSubscribed).toBe(true);
      expect(MainChannelService.incrementSubscribersCount).not.toHaveBeenCalled();
      expect(mockRepoInstance.create).not.toHaveBeenCalled();
    });

  });

  describe('UnsubscribeUseCase', () => {
    it('deletes local Subscription, records opt-out, ', async () => {
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 1 } as any);
      vi.mocked(MainChannelService.getRequired).mockResolvedValueOnce(mockMainChannel as any)
                                             .mockResolvedValueOnce({ ...mockMainChannel, subscribersCount: 9 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);
      expect(result.subscribersCount).toBe(9);
      expect(mockPreferenceRepoInstance.recordExplicitContentOptOut).toHaveBeenCalledWith('u1', 'user@example.com', {});
      expect(MainChannelService.decrementSubscribersCount).toHaveBeenCalled();
    });

    it('is fail-safe on FOREIGN_EMAIL_CONFLICT and uses structured logging', async () => {
      mockPreferenceRepoInstance.recordExplicitContentOptOut.mockResolvedValue({
        id: null,
        recorded: false,
        reason: 'FOREIGN_EMAIL_CONFLICT'
      });
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 1 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);

      const { createScopedLogger } = await import('@/lib/logger');
      expect(createScopedLogger).toHaveBeenCalledWith('req_123');
      const logger = vi.mocked(createScopedLogger).mock.results[0].value;
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('[SUBSCRIPTION_IDENTITY_CONFLICT]'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('userId=u1'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('reason=FOREIGN_EMAIL_CONFLICT'));
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('user@example.com'));
    });

    it('is idempotent ', async () => {
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 0 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(false);
      expect(MainChannelService.decrementSubscribersCount).not.toHaveBeenCalled();
    });

  });
});
