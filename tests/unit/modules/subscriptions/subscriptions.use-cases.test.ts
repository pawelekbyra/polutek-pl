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

  const trustedEmail = 'USER@Example.COM';
  const subscribeGateway = { syncExplicitSubscribe: vi.fn() };
  const unsubscribeGateway = { syncExplicitUnsubscribe: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mockMainChannel as any);
    subscribeGateway.syncExplicitSubscribe.mockResolvedValue('SYNCED');
    unsubscribeGateway.syncExplicitUnsubscribe.mockResolvedValue('SYNCED');
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
    it('creates exactly one subscription, records explicit opt-in, then syncs provider', async () => {
      const created = { id: 's1', createdAt: new Date() } as any;
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue(null);
      mockRepoInstance.create.mockResolvedValue(created);
      vi.mocked(MainChannelService.getRequired).mockResolvedValueOnce(mockMainChannel as any)
                                             .mockResolvedValueOnce({ ...mockMainChannel, subscribersCount: 11 } as any);

      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });

      expect(result.isSubscribed).toBe(true);
      expect(result.providerSyncStatus).toBe('SYNCED');
      expect(result.subscribersCount).toBe(11);
      expect(mockRepoInstance.create).toHaveBeenCalledTimes(1);
      expect(mockPreferenceRepoInstance.recordExplicitContentOptIn).toHaveBeenCalledWith('u1', 'user@example.com', {});
      expect(MainChannelService.incrementSubscribersCount).toHaveBeenCalled();
      expect(subscribeGateway.syncExplicitSubscribe).toHaveBeenCalledWith('user@example.com');
    });

    it('is idempotent and can retry provider sync without duplicating Subscription', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue({ id: 's1', createdAt: new Date() } as any);

      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });

      expect(result.isSubscribed).toBe(true);
      expect(MainChannelService.incrementSubscribersCount).not.toHaveBeenCalled();
      expect(mockRepoInstance.create).not.toHaveBeenCalled();
      expect(subscribeGateway.syncExplicitSubscribe).toHaveBeenCalledTimes(1);
    });

    it('rejects with AppError 409 when local opt-in returns recorded: false', async () => {
      mockPreferenceRepoInstance.recordExplicitContentOptIn.mockResolvedValueOnce({ id: null, recorded: false, reason: 'FOREIGN_EMAIL_CONFLICT' });

      await expect(SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway }))
        .rejects.toThrow(AppError);

      expect(mockRepoInstance.create).not.toHaveBeenCalled();
      expect(subscribeGateway.syncExplicitSubscribe).not.toHaveBeenCalled();
    });

    it('reports NOT_CONFIGURED without removing local Subscription', async () => {
      subscribeGateway.syncExplicitSubscribe.mockResolvedValueOnce('NOT_CONFIGURED');
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue({ id: 's1', createdAt: new Date() } as any);

      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });

      expect(result.providerSyncStatus).toBe('NOT_CONFIGURED');
      expect(result.isSubscribed).toBe(true);
    });

    it('reports FAILED without removing local Subscription', async () => {
      subscribeGateway.syncExplicitSubscribe.mockResolvedValueOnce('FAILED');
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue({ id: 's1', createdAt: new Date() } as any);

      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });

      expect(result.providerSyncStatus).toBe('FAILED');
      expect(result.isSubscribed).toBe(true);
      expect(mockRepoInstance.deleteByUserIdAndCreatorId).not.toHaveBeenCalled();
    });

    it('does not sync provider when trusted email is missing', async () => {
      await expect(SubscribeUseCase.execute(mockCtx, { trustedEmail: '', audienceGateway: subscribeGateway })).rejects.toThrow('Trusted user email is required');
      expect(subscribeGateway.syncExplicitSubscribe).not.toHaveBeenCalled();
    });
  });

  describe('UnsubscribeUseCase', () => {
    it('deletes local Subscription, records opt-out, and syncs provider unsubscribe', async () => {
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 1 } as any);
      vi.mocked(MainChannelService.getRequired).mockResolvedValueOnce(mockMainChannel as any)
                                             .mockResolvedValueOnce({ ...mockMainChannel, subscribersCount: 9 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);
      expect(result.subscribersCount).toBe(9);
      expect(mockPreferenceRepoInstance.recordExplicitContentOptOut).toHaveBeenCalledWith('u1', 'user@example.com', {});
      expect(MainChannelService.decrementSubscribersCount).toHaveBeenCalled();
      expect(unsubscribeGateway.syncExplicitUnsubscribe).toHaveBeenCalledWith('user@example.com');
    });

    it('remains fail-safe and still unsubscribes when local opt-out returns FOREIGN_EMAIL_CONFLICT', async () => {
      mockPreferenceRepoInstance.recordExplicitContentOptOut.mockResolvedValueOnce({ id: null, recorded: false, reason: 'FOREIGN_EMAIL_CONFLICT' });
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 1 } as any);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);
      expect(mockRepoInstance.deleteByUserIdAndCreatorId).toHaveBeenCalled();
      expect(unsubscribeGateway.syncExplicitUnsubscribe).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[SUBSCRIPTION_IDENTITY_CONFLICT]'));
      warnSpy.mockRestore();
    });

    it('is idempotent and still retries provider unsubscribe', async () => {
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 0 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(false);
      expect(MainChannelService.decrementSubscribersCount).not.toHaveBeenCalled();
      expect(unsubscribeGateway.syncExplicitUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('keeps local opt-out when provider sync fails', async () => {
      unsubscribeGateway.syncExplicitUnsubscribe.mockResolvedValueOnce('FAILED');
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 1 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.providerSyncStatus).toBe('FAILED');
      expect(mockRepoInstance.create).not.toHaveBeenCalled();
      expect(mockPreferenceRepoInstance.recordExplicitContentOptOut).toHaveBeenCalled();
    });

    it('reports NOT_CONFIGURED for missing Audience', async () => {
      unsubscribeGateway.syncExplicitUnsubscribe.mockResolvedValueOnce('NOT_CONFIGURED');
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 0 } as any);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.providerSyncStatus).toBe('NOT_CONFIGURED');
      expect(result.isSubscribed).toBe(false);
    });
  });
});
