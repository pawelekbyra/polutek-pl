import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GetSubscriptionStatusUseCase,
  ListMySubscriptionsUseCase,
  SetSubscriptionNotifyUseCase,
  SubscribeUseCase,
  UnsubscribeUseCase,
} from '@/lib/modules/subscriptions';
import { MainChannelService } from '@/lib/modules/channel';
import { AppContext } from '@/lib/modules/shared/app-context';
import { AppError } from '@/lib/modules/shared/app-error';

class FakeChannelNotFound extends AppError {
  constructor(id: string) {
    super(`Channel "${id}" not found.`, 404, 'CHANNEL_NOT_FOUND');
  }
}

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
    getPubliclyVisibleById: vi.fn(),
    getAnyById: vi.fn(),
    syncSubscribersCount: vi.fn(),
  },
  MainChannelPolicy: {
    isPubliclyVisible: (c: { status?: string; deletedAt?: Date | null }) =>
      !c.deletedAt && (c.status === 'ACTIVE' || c.status === 'LIMITED'),
  },
  resolveChannelAvatarUrl: (s: { ownerImageUrl?: string | null }) => s.ownerImageUrl ?? null,
}));

const mockRepoInstance = {
  findByUserIdAndCreatorId: vi.fn(),
  createIfMissing: vi.fn(),
  deleteByUserIdAndCreatorId: vi.fn(),
  countByUserId: vi.fn(),
  setNotify: vi.fn(),
  listForUser: vi.fn(),
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
  const mainChannel = { id: 'c1', slug: 'polutek', subscribersCount: 10 };
  const otherChannel = { id: 'c2', slug: 'other', subscribersCount: 3 };
  const mockActor = { type: 'user', userId: 'u1' };
  const groupBy = vi.fn();
  const mockCtx = {
    actor: mockActor,
    requestId: 'req_123',
    now: () => new Date('2026-10-14T12:00:00Z'),
    prisma: { video: { groupBy } },
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
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mainChannel as any);
    vi.mocked(MainChannelService.getPubliclyVisibleById).mockImplementation(async (_ctx, id) => {
      if (id === 'c2') return otherChannel as any;
      throw new FakeChannelNotFound(id);
    });
    vi.mocked(MainChannelService.getAnyById).mockImplementation(async (_ctx, id) => {
      if (id === 'c2' || id === 'hidden') return { ...otherChannel, id } as any;
      throw new FakeChannelNotFound(id);
    });
    vi.mocked(MainChannelService.syncSubscribersCount).mockImplementation(async (_ctx, id) => ({
      subscribersCount: id === 'c2' ? 4 : 11,
    }) as any);
    subscribeGateway.syncExplicitSubscribe.mockResolvedValue('SYNCED');
    unsubscribeGateway.syncExplicitUnsubscribe.mockResolvedValue('SYNCED');
    mockPreferenceRepoInstance.recordExplicitContentOptIn.mockResolvedValue({ id: 'pref_1', recorded: true });
    mockPreferenceRepoInstance.recordExplicitContentOptOut.mockResolvedValue({ id: 'pref_1', recorded: true });
    mockRepoInstance.createIfMissing.mockResolvedValue({
      subscription: { id: 's1', createdAt: new Date('2026-10-14T00:00:00Z'), notify: true },
      created: true,
    });
    mockRepoInstance.countByUserId.mockResolvedValue(0);
    mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 1 });
  });

  describe('GetSubscriptionStatusUseCase', () => {
    it('returns status of the main channel when no channel id is given (back-compat)', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue({ id: 's1', createdAt: new Date(), notify: false });

      const result = await GetSubscriptionStatusUseCase.execute(mockCtx);

      expect(MainChannelService.getRequired).toHaveBeenCalled();
      expect(MainChannelService.getPubliclyVisibleById).not.toHaveBeenCalled();
      expect(mockRepoInstance.findByUserIdAndCreatorId).toHaveBeenCalledWith('u1', 'c1');
      expect(result.isSubscribed).toBe(true);
      expect(result.notify).toBe(false);
      expect(result.subscribersCount).toBe(10);
      expect(result.creatorSlug).toBe('polutek');
    });

    it('returns the status of the requested channel, not the main one', async () => {
      mockRepoInstance.findByUserIdAndCreatorId.mockResolvedValue(null);

      const result = await GetSubscriptionStatusUseCase.execute(mockCtx, { creatorId: 'c2' });

      expect(MainChannelService.getRequired).not.toHaveBeenCalled();
      expect(mockRepoInstance.findByUserIdAndCreatorId).toHaveBeenCalledWith('u1', 'c2');
      expect(result).toMatchObject({ isSubscribed: false, creatorId: 'c2', subscribersCount: 3, notify: true });
    });

    it('fails with 404 for a missing or hidden channel', async () => {
      await expect(GetSubscriptionStatusUseCase.execute(mockCtx, { creatorId: 'nope' })).rejects.toMatchObject({ statusCode: 404 });
      expect(mockRepoInstance.findByUserIdAndCreatorId).not.toHaveBeenCalled();
    });
  });

  describe('SubscribeUseCase', () => {
    it('without a channel id subscribes to the main channel, records opt-in, recounts, then syncs provider', async () => {
      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });

      expect(result.isSubscribed).toBe(true);
      expect(result.creatorId).toBe('c1');
      expect(result.providerSyncStatus).toBe('SYNCED');
      expect(result.subscribersCount).toBe(11);
      expect(result.notify).toBe(true);
      expect(mockRepoInstance.createIfMissing).toHaveBeenCalledWith('u1', 'c1', {});
      expect(mockPreferenceRepoInstance.recordExplicitContentOptIn).toHaveBeenCalledWith('u1', 'user@example.com', {});
      expect(MainChannelService.syncSubscribersCount).toHaveBeenCalledWith(mockCtx, 'c1', {});
      expect(subscribeGateway.syncExplicitSubscribe).toHaveBeenCalledWith('user@example.com');
      expect(subscribeGateway.syncExplicitSubscribe.mock.invocationCallOrder[0]).toBeGreaterThan(
        vi.mocked(mockCtx.db.writeTransaction).mock.invocationCallOrder[0]
      );
    });

    it('subscribes to the requested channel and updates only its counter', async () => {
      const result = await SubscribeUseCase.execute(mockCtx, { trustedEmail, creatorId: 'c2', audienceGateway: subscribeGateway });

      expect(MainChannelService.getRequired).not.toHaveBeenCalled();
      expect(MainChannelService.getPubliclyVisibleById).toHaveBeenCalledWith(mockCtx, 'c2');
      expect(mockRepoInstance.createIfMissing).toHaveBeenCalledWith('u1', 'c2', {});
      expect(MainChannelService.syncSubscribersCount).toHaveBeenCalledWith(mockCtx, 'c2', {});
      expect(result).toMatchObject({ creatorId: 'c2', creatorSlug: 'other', subscribersCount: 4 });
    });

    it('rejects a missing or hidden channel with 404 before any write or provider call', async () => {
      const promise = SubscribeUseCase.execute(mockCtx, { trustedEmail, creatorId: 'hidden', audienceGateway: subscribeGateway });

      await expect(promise).rejects.toMatchObject({ statusCode: 404, code: 'CHANNEL_NOT_FOUND' });
      expect(mockCtx.db.writeTransaction).not.toHaveBeenCalled();
      expect(mockRepoInstance.createIfMissing).not.toHaveBeenCalled();
      expect(mockPreferenceRepoInstance.recordExplicitContentOptIn).not.toHaveBeenCalled();
      expect(subscribeGateway.syncExplicitSubscribe).not.toHaveBeenCalled();
    });

    it('throws AppError 409 when the e-mail preference cannot be recorded', async () => {
      mockPreferenceRepoInstance.recordExplicitContentOptIn.mockResolvedValue({
        id: null,
        recorded: false,
        reason: 'FOREIGN_EMAIL_CONFLICT'
      });

      const promise = SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 409,
        code: 'EMAIL_PREFERENCE_IDENTITY_CONFLICT',
      });
      expect(mockRepoInstance.createIfMissing).not.toHaveBeenCalled();
      expect(MainChannelService.syncSubscribersCount).not.toHaveBeenCalled();
      expect(subscribeGateway.syncExplicitSubscribe).not.toHaveBeenCalled();
    });

    it('a double subscription is idempotent: the existing row is returned and the count is only recounted', async () => {
      mockRepoInstance.createIfMissing.mockResolvedValue({
        subscription: { id: 's1', createdAt: new Date('2026-09-01T00:00:00Z'), notify: false },
        created: false,
      });

      const first = await SubscribeUseCase.execute(mockCtx, { trustedEmail, creatorId: 'c2', audienceGateway: subscribeGateway });
      const second = await SubscribeUseCase.execute(mockCtx, { trustedEmail, creatorId: 'c2', audienceGateway: subscribeGateway });

      expect(first.isSubscribed).toBe(true);
      expect(second.subscribedAt).toEqual(new Date('2026-09-01T00:00:00Z'));
      // An existing subscription keeps its bell: subscribing again never switches it back on.
      expect(second.notify).toBe(false);
      expect(second.subscribersCount).toBe(4);
    });

    it('reports provider NOT_CONFIGURED and FAILED without touching the local subscription', async () => {
      subscribeGateway.syncExplicitSubscribe.mockResolvedValueOnce('NOT_CONFIGURED').mockResolvedValueOnce('FAILED');

      const a = await SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });
      const b = await SubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: subscribeGateway });

      expect(a.providerSyncStatus).toBe('NOT_CONFIGURED');
      expect(b.providerSyncStatus).toBe('FAILED');
      expect(a.isSubscribed && b.isSubscribed).toBe(true);
      expect(mockRepoInstance.deleteByUserIdAndCreatorId).not.toHaveBeenCalled();
    });

    it('does not sync provider when trusted email is missing', async () => {
      await expect(SubscribeUseCase.execute(mockCtx, { trustedEmail: '', audienceGateway: subscribeGateway })).rejects.toThrow('Trusted user email is required');
      expect(subscribeGateway.syncExplicitSubscribe).not.toHaveBeenCalled();
    });
  });

  describe('UnsubscribeUseCase', () => {
    it('last subscription: deletes it, records opt-out, recounts and syncs provider unsubscribe', async () => {
      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);
      expect(result.creatorId).toBe('c1');
      expect(result.subscribersCount).toBe(11);
      expect(mockRepoInstance.deleteByUserIdAndCreatorId).toHaveBeenCalledWith('u1', 'c1', {});
      expect(mockPreferenceRepoInstance.recordExplicitContentOptOut).toHaveBeenCalledWith('u1', 'user@example.com', {});
      expect(MainChannelService.syncSubscribersCount).toHaveBeenCalledWith(mockCtx, 'c1', {});
      expect(unsubscribeGateway.syncExplicitUnsubscribe).toHaveBeenCalledWith('user@example.com');
    });

    it('leaving one of several channels keeps the e-mail consent and the provider contact', async () => {
      mockRepoInstance.countByUserId.mockResolvedValue(2);

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, creatorId: 'c2', audienceGateway: unsubscribeGateway });

      expect(mockRepoInstance.deleteByUserIdAndCreatorId).toHaveBeenCalledWith('u1', 'c2', {});
      expect(result).toMatchObject({ isSubscribed: false, deleted: true, creatorId: 'c2', subscribersCount: 4 });
      expect(mockPreferenceRepoInstance.recordExplicitContentOptOut).not.toHaveBeenCalled();
      expect(unsubscribeGateway.syncExplicitUnsubscribe).not.toHaveBeenCalled();
    });

    it('can leave a channel that is no longer public', async () => {
      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, creatorId: 'hidden', audienceGateway: unsubscribeGateway });

      expect(MainChannelService.getAnyById).toHaveBeenCalledWith(mockCtx, 'hidden');
      expect(result.deleted).toBe(true);
    });

    it('rejects an unknown channel id with 404 and writes nothing', async () => {
      await expect(
        UnsubscribeUseCase.execute(mockCtx, { trustedEmail, creatorId: 'nope', audienceGateway: unsubscribeGateway }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(mockCtx.db.writeTransaction).not.toHaveBeenCalled();
    });

    it('is fail-safe on FOREIGN_EMAIL_CONFLICT and uses structured logging', async () => {
      mockPreferenceRepoInstance.recordExplicitContentOptOut.mockResolvedValue({
        id: null,
        recorded: false,
        reason: 'FOREIGN_EMAIL_CONFLICT'
      });

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(true);
      expect(unsubscribeGateway.syncExplicitUnsubscribe).toHaveBeenCalledWith('user@example.com');

      const { createScopedLogger } = await import('@/lib/logger');
      expect(createScopedLogger).toHaveBeenCalledWith('req_123');
      const logger = vi.mocked(createScopedLogger).mock.results[0].value;
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('[SUBSCRIPTION_IDENTITY_CONFLICT]'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('userId=u1'));
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('user@example.com'));
    });

    it('is idempotent when there was no subscription and still retries provider unsubscribe', async () => {
      mockRepoInstance.deleteByUserIdAndCreatorId.mockResolvedValue({ count: 0 });

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.deleted).toBe(false);
      expect(unsubscribeGateway.syncExplicitUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('keeps local opt-out when provider sync fails', async () => {
      unsubscribeGateway.syncExplicitUnsubscribe.mockResolvedValueOnce('FAILED');

      const result = await UnsubscribeUseCase.execute(mockCtx, { trustedEmail, audienceGateway: unsubscribeGateway });

      expect(result.isSubscribed).toBe(false);
      expect(result.providerSyncStatus).toBe('FAILED');
      expect(mockPreferenceRepoInstance.recordExplicitContentOptOut).toHaveBeenCalled();
    });
  });

  describe('SetSubscriptionNotifyUseCase', () => {
    it('switches the bell of the subscription of the requested channel only', async () => {
      mockRepoInstance.setNotify.mockResolvedValue({ count: 1 });

      const result = await SetSubscriptionNotifyUseCase.execute(mockCtx, { creatorId: 'c2', notify: false });

      expect(mockRepoInstance.setNotify).toHaveBeenCalledWith('u1', 'c2', false);
      expect(result).toEqual({ creatorId: 'c2', creatorSlug: 'other', isSubscribed: true, notify: false });
      expect(mockPreferenceRepoInstance.recordExplicitContentOptOut).not.toHaveBeenCalled();
    });

    it('defaults to the main channel', async () => {
      mockRepoInstance.setNotify.mockResolvedValue({ count: 1 });

      await SetSubscriptionNotifyUseCase.execute(mockCtx, { notify: true });

      expect(mockRepoInstance.setNotify).toHaveBeenCalledWith('u1', 'c1', true);
    });

    it('is a 404 when the viewer does not subscribe to the channel (it never creates a subscription)', async () => {
      mockRepoInstance.setNotify.mockResolvedValue({ count: 0 });

      await expect(SetSubscriptionNotifyUseCase.execute(mockCtx, { creatorId: 'c2', notify: false })).rejects.toMatchObject({
        statusCode: 404,
        code: 'SUBSCRIPTION_NOT_FOUND',
      });
      expect(mockRepoInstance.createIfMissing).not.toHaveBeenCalled();
    });

    it('is a 401 for a guest', async () => {
      const guestCtx = { ...mockCtx, actor: { type: 'guest' } } as unknown as AppContext;

      await expect(SetSubscriptionNotifyUseCase.execute(guestCtx, { notify: false })).rejects.toMatchObject({ statusCode: 401 });
      expect(mockRepoInstance.setNotify).not.toHaveBeenCalled();
    });
  });

  describe('ListMySubscriptionsUseCase', () => {
    it('lists the viewer subscriptions with video count, latest video and availability', async () => {
      mockRepoInstance.listForUser.mockResolvedValue([
        {
          creatorId: 'c2',
          notify: false,
          createdAt: new Date('2026-10-01T00:00:00Z'),
          creator: { id: 'c2', slug: 'other', handle: 'other', name: 'Other', status: 'ACTIVE', deletedAt: null, subscribersCount: 3, user: { imageUrl: 'https://x/a.png' } },
        },
        {
          creatorId: 'c3',
          notify: true,
          createdAt: new Date('2026-09-01T00:00:00Z'),
          creator: { id: 'c3', slug: 'sus', handle: null, name: 'Suspended', status: 'SUSPENDED', deletedAt: null, subscribersCount: 1, user: null },
        },
      ]);
      groupBy.mockResolvedValue([
        { creatorId: 'c2', _count: { _all: 5 }, _max: { publishedAt: new Date('2026-10-10T00:00:00Z') } },
      ]);

      const result = await ListMySubscriptionsUseCase.execute(mockCtx);

      expect(mockRepoInstance.listForUser).toHaveBeenCalledWith('u1');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        creatorId: 'c2', handle: 'other', notify: false, videosCount: 5, available: true, imageUrl: 'https://x/a.png',
        lastVideoAt: new Date('2026-10-10T00:00:00Z'),
      });
      expect(result[1]).toMatchObject({ creatorId: 'c3', videosCount: 0, lastVideoAt: null, available: false, imageUrl: null });
    });

    it('does not query videos when the viewer has no subscriptions', async () => {
      mockRepoInstance.listForUser.mockResolvedValue([]);

      expect(await ListMySubscriptionsUseCase.execute(mockCtx)).toEqual([]);
      expect(groupBy).not.toHaveBeenCalled();
    });

    it('is a 401 for a guest', async () => {
      const guestCtx = { ...mockCtx, actor: { type: 'guest' } } as unknown as AppContext;

      await expect(ListMySubscriptionsUseCase.execute(guestCtx)).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
