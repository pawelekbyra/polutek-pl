import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccessTier,
  PaymentStatus,
  PatronGrantSource,
  StorageProvider,
  VideoAssetProcessingState,
  VideoStatus,
} from '@prisma/client';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { handleDispute } from '@/lib/modules/payments/application/handle-dispute.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { checkVideoAccess } from '@/lib/modules/access';
import { getPatronStatus, grantPatron, revokePatron } from '@/lib/modules/patron';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { recordPlaybackEventUseCase } from '@/lib/modules/video/application/record-playback-event.use-case';

const { cloudflareTokenCalls, rateLimitLocks } = vi.hoisted(() => ({
  cloudflareTokenCalls: [] as string[],
  rateLimitLocks: new Map<string, string>(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createScopedLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/lib/feature-flags', () => ({
  flags: { mainCreatorSlug: 'polutek' },
  canUseDemoFallbacks: () => false,
}));

vi.mock('@/lib/observability', () => ({
  recordMetric: vi.fn(),
  recordAlert: vi.fn(),
  startTimer: () => Date.now(),
  recordDurationMetric: vi.fn(),
}));

vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: { syncClerkAccess: vi.fn() },
}));

vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendBecomePatronEmail: vi.fn(),
    sendDonationThankYouEmail: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentCurrencySetting: { findMany: vi.fn(async () => []) },
    auditLog: { create: vi.fn(async ({ data }) => ({ id: 'audit-global', ...data })) },
  },
}));

vi.mock('@/lib/modules/video/infrastructure/cloudflare-stream.client', () => ({
  CloudflareStreamClient: vi.fn().mockImplementation(function CloudflareStreamClientMock(this: any) {
    this.createSignedPlaybackToken = vi.fn(async (uid: string) => {
      cloudflareTokenCalls.push(uid);
      return { token: `signed-token-for-${uid}` };
    });
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  setNxEx: vi.fn(async (key: string, value: string) => {
    if (rateLimitLocks.has(key)) return false;
    rateLimitLocks.set(key, value);
    return true;
  }),
  rateLimit: vi.fn(async () => ({ success: true })),
}));

type UserRecord = {
  id: string;
  email: string;
  language: string;
  isDeleted: boolean;
  isPatron: boolean;
  patronSince: Date | null;
  patronSource: PatronGrantSource | null;
  publicMetadata?: Record<string, unknown>;
};

type PaymentRecord = {
  id: string;
  userId: string;
  creatorId: string;
  stripeIntentId: string;
  amountMinor: number;
  refundedAmountMinor: number;
  currency: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
};

type GrantRecord = {
  id: string;
  userId: string;
  source: PatronGrantSource;
  paymentId: string | null;
  referralId: string | null;
  grantedById: string | null;
  reason: string | null;
  createdAt: Date;
  revokedAt: Date | null;
};

type VideoRecord = {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  videoUrl: string;
  thumbnailUrl: string;
  tier: AccessTier;
  status: VideoStatus;
  publishedAt: Date | null;
  views: number;
  creator?: { id: string; slug: string; isApproved: boolean; isPrimary: boolean };
  asset?: AssetRecord | null;
};

type AssetRecord = {
  id: string;
  videoId: string;
  provider: StorageProvider;
  objectKey: string;
  bucket: string | null;
  providerAssetId: string | null;
  providerPlaybackId: string | null;
  processingState: VideoAssetProcessingState;
  isPrimary: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
};

function createHarness() {
  const events: string[] = [];
  const state = {
    users: new Map<string, UserRecord>(),
    payments: new Map<string, PaymentRecord>(),
    totals: new Map<string, { userId: string; currency: string; amountMinor: number }>(),
    grants: [] as GrantRecord[],
    creators: new Map<string, any>(),
    videos: new Map<string, VideoRecord>(),
    assets: new Map<string, AssetRecord>(),
    sessions: [] as any[],
    playbackEvents: [] as any[],
    views: [] as any[],
    auditLogs: [] as any[],
    subscriptions: [] as any[],
  };

  const creator = { id: 'creator_main', slug: 'polutek', name: 'Polutek', isApproved: true, isPrimary: true };
  state.creators.set(creator.id, creator);

  const withTotals = (user: UserRecord) => ({
    ...user,
    paymentTotals: Array.from(state.totals.values()).filter((total) => total.userId === user.id),
  });

  const withCreatorAndAsset = (video: VideoRecord | null) => {
    if (!video) return null;
    const asset = state.assets.get(video.id) ?? null;
    return { ...video, creator: state.creators.get(video.creatorId), asset };
  };

  const matchesGrantWhere = (grant: GrantRecord, where: any = {}) => {
    if (where.userId !== undefined && grant.userId !== where.userId) return false;
    if (where.paymentId !== undefined && grant.paymentId !== where.paymentId) return false;
    if (where.source !== undefined && grant.source !== where.source) return false;
    if (where.reason !== undefined && grant.reason !== where.reason) return false;
    if (where.revokedAt === null && grant.revokedAt !== null) return false;
    if (where.revokedAt?.not === null && grant.revokedAt === null) return false;
    return true;
  };

  const db: any = {
    $transaction: async (fn: any) => fn(db),
    $executeRaw: async (_strings: TemplateStringsArray, userId: string, currency: string, amountMinor: number) => {
      const key = `${userId}:${currency}`;
      const existing = state.totals.get(key);
      if (existing) existing.amountMinor = Math.max(0, existing.amountMinor - amountMinor);
      return 1;
    },
    creator: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.slug) return Array.from(state.creators.values()).find((item) => item.slug === where.slug) ?? null;
        if (where.id) return state.creators.get(where.id) ?? null;
        return null;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }) => {
        const user = state.users.get(where.id);
        return user ? withTotals(user) : null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const user = state.users.get(where.id);
        if (!user) throw new Error(`User not found: ${where.id}`);
        Object.assign(user, data);
        return withTotals(user);
      }),
    },
    payment: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id) return state.payments.get(where.id) ?? null;
        if (where.stripeIntentId) return Array.from(state.payments.values()).find((payment) => payment.stripeIntentId === where.stripeIntentId) ?? null;
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const payment = state.payments.get(where.id);
        if (!payment) throw new Error(`Payment not found: ${where.id}`);
        Object.assign(payment, data);
        return payment;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const payment of state.payments.values()) {
          if (where.id !== undefined && payment.id !== where.id) continue;
          if (where.status !== undefined && payment.status !== where.status) continue;
          if (where.refundedAmountMinor !== undefined && payment.refundedAmountMinor !== where.refundedAmountMinor) continue;
          Object.assign(payment, data);
          count += 1;
        }
        return { count };
      }),
    },
    userPaymentTotal: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = `${where.userId_currency.userId}:${where.userId_currency.currency}`;
        const existing = state.totals.get(key);
        if (existing) {
          existing.amountMinor += update.amountMinor.increment;
          return existing;
        }
        const created = { ...create };
        state.totals.set(key, created);
        return created;
      }),
    },
    patronGrant: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.paymentId !== undefined) return state.grants.find((grant) => grant.paymentId === where.paymentId) ?? null;
        if (where.referralId !== undefined) return state.grants.find((grant) => grant.referralId === where.referralId) ?? null;
        return null;
      }),
      findFirst: vi.fn(async ({ where, orderBy }) => {
        const grants = state.grants.filter((grant) => matchesGrantWhere(grant, where));
        if (orderBy?.createdAt === 'asc') grants.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return grants[0] ?? null;
      }),
      findMany: vi.fn(async ({ where, orderBy }) => {
        const grants = state.grants.filter((grant) => matchesGrantWhere(grant, where));
        if (orderBy?.createdAt === 'asc') grants.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return grants;
      }),
      create: vi.fn(async ({ data }) => {
        if (data.paymentId && state.grants.some((grant) => grant.paymentId === data.paymentId)) {
          throw new Error(`Unique paymentId grant violation: ${data.paymentId}`);
        }
        const grant = {
          ...data,
          id: `grant_${state.grants.length + 1}`,
          referralId: data.referralId ?? null,
          grantedById: data.grantedById ?? null,
          reason: data.reason ?? null,
          createdAt: new Date(`2026-06-12T00:00:${String(state.grants.length).padStart(2, '0')}Z`),
          revokedAt: null,
        } as GrantRecord;
        state.grants.push(grant);
        return grant;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const grant of state.grants) {
          if (!matchesGrantWhere(grant, where)) continue;
          Object.assign(grant, data);
          count += 1;
        }
        return { count };
      }),
    },
    video: {
      findUnique: vi.fn(async ({ where }) => withCreatorAndAsset(state.videos.get(where.id) ?? null)),
      findFirst: vi.fn(async ({ where }) => {
        const match = Array.from(state.videos.values()).find((video) => {
          if (where.id !== undefined && video.id !== where.id) return false;
          if (where.slug !== undefined && video.slug !== where.slug) return false;
          if (where.creatorId !== undefined && video.creatorId !== where.creatorId) return false;
          return true;
        }) ?? null;
        return withCreatorAndAsset(match);
      }),
      update: vi.fn(async ({ where, data }) => {
        const video = state.videos.get(where.id);
        if (!video) throw new Error(`Video not found: ${where.id}`);
        if (data.views?.increment) video.views += data.views.increment;
        Object.assign(video, Object.fromEntries(Object.entries(data).filter(([_, value]) => typeof value !== 'object')));
        return video;
      }),
    },
    videoPlaybackSession: {
      create: vi.fn(async ({ data }) => {
        events.push('session:create');
        const session = {
          id: `session_${state.sessions.length + 1}`,
          ...data,
          createdAt: new Date('2026-06-12T12:00:00Z'),
          lastHeartbeatAt: null,
          firstPlayAt: null,
          totalWatchMs: 0,
          maxProgressMs: 0,
          durationMs: null,
          countedAsView: false,
        };
        state.sessions.push(session);
        return session;
      }),
      findUnique: vi.fn(async ({ where }) => state.sessions.find((session) => session.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const session = state.sessions.find((item) => item.id === where.id);
        if (!session) throw new Error(`Session not found: ${where.id}`);
        if (data.totalWatchMs?.increment) session.totalWatchMs += data.totalWatchMs.increment;
        Object.assign(session, Object.fromEntries(Object.entries(data).filter(([_, value]) => typeof value !== 'object')));
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const session of state.sessions) {
          if (where.id !== undefined && session.id !== where.id) continue;
          if (where.countedAsView !== undefined && session.countedAsView !== where.countedAsView) continue;
          Object.assign(session, data);
          count += 1;
        }
        return { count };
      }),
    },
    videoPlaybackEvent: {
      create: vi.fn(async ({ data }) => {
        events.push(`event:${data.type}`);
        state.playbackEvents.push(data);
      }),
    },
    videoView: {
      create: vi.fn(async ({ data }) => {
        events.push('view:create');
        state.views.push(data);
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }) => {
        const audit = { id: `audit_${state.auditLogs.length + 1}`, ...data };
        state.auditLogs.push(audit);
        return audit;
      }),
    },
    subscription: {
      count: vi.fn(async ({ where }) => state.subscriptions.filter((s) => s.creatorId === where.creatorId).length),
    },
  };

  const ctx = (userId?: string | null, type: 'user' | 'admin' | 'guest' | 'system' = userId ? 'user' : 'guest') => ({
    prisma: db,
    actor: type === 'guest' ? { type: 'guest' as const } : type === 'system' ? { type: 'system' as const } : { type, userId: userId! } as any,
    now: () => new Date('2026-06-12T12:00:00Z'),
    db: { read: db, writeTransaction: async (fn: any) => fn(db) },
  });

  const seedUser = (id: string, overrides: Partial<UserRecord> = {}) => {
    const user: UserRecord = {
      id,
      email: `${id}@example.test`,
      language: 'pl',
      isDeleted: false,
      isPatron: false,
      patronSince: null,
      patronSource: null,
      ...overrides,
    };
    state.users.set(id, user);
    return user;
  };

  const seedPayment = (id: string, userId: string, amountMinor = 1000, status: PaymentStatus = PaymentStatus.PENDING) => {
    const payment: PaymentRecord = {
      id,
      userId,
      creatorId: creator.id,
      stripeIntentId: `pi_${id}`,
      amountMinor,
      refundedAmountMinor: 0,
      currency: 'PLN',
      status,
    };
    state.payments.set(id, payment);
    return payment;
  };

  const seedGrant = (id: string, userId: string, paymentId: string | null, overrides: Partial<GrantRecord> = {}) => {
    const grant: GrantRecord = {
      id,
      userId,
      source: paymentId ? PatronGrantSource.STRIPE_TIP : PatronGrantSource.ADMIN,
      paymentId,
      referralId: null,
      grantedById: null,
      reason: paymentId ? 'seed payment grant' : 'seed manual grant',
      createdAt: new Date(`2026-06-01T00:00:${String(state.grants.length).padStart(2, '0')}Z`),
      revokedAt: null,
      ...overrides,
    };
    state.grants.push(grant);
    return grant;
  };

  const seedVideo = (id: string, asset?: Partial<AssetRecord> | null, overrides: Partial<VideoRecord> = {}) => {
    const video: VideoRecord = {
      id,
      creatorId: creator.id,
      title: `Video ${id}`,
      slug: id,
      videoUrl: 'https://legacy.example.test/private.mp4?signature=secret',
      thumbnailUrl: '/thumb.jpg',
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      publishedAt: new Date('2026-06-01T00:00:00Z'),
      views: 0,
      ...overrides,
    };
    state.videos.set(id, video);
    if (asset !== null) {
      state.assets.set(id, {
        id: `asset_${id}`,
        videoId: id,
        provider: StorageProvider.CLOUDFLARE_STREAM,
        objectKey: `private/${id}`,
        bucket: null,
        providerAssetId: `cf-asset-${id}`,
        providerPlaybackId: `cf-playback-${id}`,
        processingState: VideoAssetProcessingState.READY,
        isPrimary: true,
        mimeType: 'video/mp4',
        sizeBytes: 12345,
        ...asset,
      });
    }
    return video;
  };

  const activeGrants = (userId: string) => state.grants.filter((grant) => grant.userId === userId && grant.revokedAt === null);
  const attemptPlayback = (userId: string | null, videoId = 'video_ready') =>
    PlaybackService.createPlaybackPlanWithContext(videoId, ctx(userId), 'ip_hash', 'ua_hash');
  const assertNoPlaybackSideEffects = () => {
    expect(cloudflareTokenCalls).toHaveLength(0);
    expect(state.sessions).toHaveLength(0);
    expect(state.playbackEvents).toHaveLength(0);
    expect(state.views).toHaveLength(0);
  };

  seedVideo('video_ready');

  return { state, events, ctx, seedUser, seedPayment, seedGrant, seedVideo, activeGrants, attemptPlayback, assertNoPlaybackSideEffects };
}

describe('LAUNCH-CANDIDATE-001 integrated money-to-access-to-playback rehearsal', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    vi.clearAllMocks();
    cloudflareTokenCalls.length = 0;
    rateLimitLocks.clear();
    harness = createHarness();
  });

  it('Scenario A: qualifying one-time support creates one payment-linked active grant and resolves Cloudflare playback only after access/readiness', async () => {
    harness.seedUser('user_a');
    harness.seedPayment('pay_a', 'user_a', 1000);

    const first = await fulfillPayment({ paymentId: 'pay_a', userId: 'user_a', amountMinor: 1000, currency: 'pln' }, harness.ctx(null, 'system'));
    expect(first.ok && first.data.isFirstFulfillment).toBe(true);
    expect(harness.state.payments.get('pay_a')?.status).toBe(PaymentStatus.SUCCEEDED);
    expect(harness.activeGrants('user_a')).toHaveLength(1);
    expect(harness.activeGrants('user_a')[0].paymentId).toBe('pay_a');

    const patronStatus = await getPatronStatus('user_a', harness.ctx('user_a'));
    expect(patronStatus.ok && patronStatus.data.isPatron).toBe(true);
    expect(patronStatus.ok && patronStatus.data.activeGrants).toHaveLength(1);

    const access = await checkVideoAccess({ videoIdOrSlug: 'video_ready' }, harness.ctx('user_a'));
    expect(access.ok && access.data.hasAccess).toBe(true);

    const plan = await harness.attemptPlayback('user_a');
    expect(plan.status).toBe('READY');
    expect(plan.canPlay).toBe(true);
    expect(plan.source?.provider).toBe('CLOUDFLARE_STREAM');
    expect(plan.source?.playbackUrl).toBe('https://iframe.videodelivery.net/signed-token-for-cf-playback-video_ready');
    expect(plan.tracking.playbackSessionId).toBe('session_1');
    expect(cloudflareTokenCalls).toEqual(['cf-playback-video_ready']);
    expect(harness.events).toEqual(['session:create']);

    const replay = await fulfillPayment({ paymentId: 'pay_a', userId: 'user_a', amountMinor: 1000, currency: 'PLN' }, harness.ctx(null, 'system'));
    expect(replay.ok && replay.data.isFirstFulfillment).toBe(false);
    expect(harness.state.grants.filter((grant) => grant.paymentId === 'pay_a')).toHaveLength(1);

    const viewed = await recordPlaybackEventUseCase({
      videoId: 'video_ready',
      sessionId: plan.tracking.playbackSessionId,
      type: 'WATCHED_10_SECONDS',
      positionMs: 10000,
      durationMs: 60000,
      ipHash: 'ip_hash',
      uaHash: 'ua_hash',
      fingerprint: 'fingerprint_a',
      metadata: { playbackUrl: 'must be removed', token: 'must be removed', quality: '720p' },
    }, harness.ctx('user_a'));
    expect(viewed.ok).toBe(true);
    expect(harness.state.views).toHaveLength(1);
    expect(harness.state.playbackEvents[0].metadata).toEqual({ quality: '720p' });
  });

  it('Scenario B/C/D: below-threshold, cache/payment/subscription-only, guest and non-patron signals remain denied with zero playback side effects', async () => {
    harness.seedUser('below');
    harness.seedPayment('pay_below', 'below', 999);
    const below = await fulfillPayment({ paymentId: 'pay_below', userId: 'below', amountMinor: 999, currency: 'PLN' }, harness.ctx(null, 'system'));
    expect(below.ok).toBe(true);
    expect(harness.state.payments.get('pay_below')?.status).toBe(PaymentStatus.SUCCEEDED);
    expect(harness.activeGrants('below')).toHaveLength(0);
    expect((await harness.attemptPlayback('below')).status).toBe('PATRON_REQUIRED');

    harness.seedUser('signals', { isPatron: true, publicMetadata: { isPatron: true } });
    harness.seedPayment('pay_signals', 'signals', 2500, PaymentStatus.SUCCEEDED);
    harness.seedGrant('revoked_signal', 'signals', 'pay_signals', { revokedAt: new Date('2026-06-10T00:00:00Z'), reason: 'historical revoked' });
    harness.state.subscriptions.push({ userId: 'signals', creatorId: 'creator_main' });
    const signalsStatus = await getPatronStatus('signals', harness.ctx('signals'));
    expect(signalsStatus.ok && signalsStatus.data.isPatron).toBe(false);
    expect((await harness.attemptPlayback('signals')).status).toBe('PATRON_REQUIRED');

    expect((await harness.attemptPlayback(null)).status).toBe('PATRON_REQUIRED');
    expect((await harness.attemptPlayback('missing-user')).status).toBe('ERROR');
    harness.seedUser('nonpatron');
    expect((await harness.attemptPlayback('nonpatron')).status).toBe('PATRON_REQUIRED');

    harness.assertNoPlaybackSideEffects();
  });

  it('Scenario E: non-ready and missing primary assets block playback without Cloudflare calls, sessions, views, legacy fallback, or provider id leakage', async () => {
    harness.seedUser('patron');
    harness.seedPayment('pay_patron', 'patron', 1000, PaymentStatus.SUCCEEDED);
    harness.seedGrant('grant_patron', 'patron', 'pay_patron');

    const cases: Array<[string, Partial<AssetRecord> | null, string]> = [
      ['pending', { processingState: VideoAssetProcessingState.PENDING }, 'PROCESSING'],
      ['processing', { processingState: VideoAssetProcessingState.PROCESSING }, 'PROCESSING'],
      ['failed', { processingState: VideoAssetProcessingState.FAILED }, 'UNAVAILABLE'],
      ['missing-primary', { isPrimary: false }, 'NO_PRIMARY_ASSET'],
      ['no-asset', null, 'NO_PRIMARY_ASSET'],
    ];

    for (const [id, asset, expectedStatus] of cases) {
      cloudflareTokenCalls.length = 0;
      harness.state.sessions.length = 0;
      harness.seedVideo(id, asset);
      const plan = await harness.attemptPlayback('patron', id);
      expect(plan.status).toBe(expectedStatus);
      expect(plan.canPlay).toBe(false);
      expect(plan.source).toBeUndefined();
      expect(plan.tracking.playbackSessionId).toBe('');
      expect(JSON.stringify(plan)).not.toContain('legacy.example.test');
      expect(JSON.stringify(plan)).not.toContain('cf-asset-');
      expect(JSON.stringify(plan)).not.toContain('cf-playback-');
      expect(cloudflareTokenCalls).toHaveLength(0);
      expect(harness.state.sessions).toHaveLength(0);
    }
  });

  it('Scenario F/G/H/I/J/K: refund/dispute ordering is idempotent, same-dispute restore is narrow, terminal/manual states do not revive, and grants are isolated', async () => {
    harness.seedUser('user_a');
    harness.seedUser('user_b');
    harness.seedPayment('pay_a', 'user_a', 1000, PaymentStatus.SUCCEEDED);
    harness.seedPayment('pay_b', 'user_b', 1000, PaymentStatus.SUCCEEDED);
    const grantA = harness.seedGrant('grant_a', 'user_a', 'pay_a');
    const grantB = harness.seedGrant('grant_b', 'user_b', 'pay_b');
    const manualA = harness.seedGrant('grant_manual_a', 'user_a', null);

    await handleDispute({ stripeIntentId: 'pi_pay_a', disputeId: 'dp_same', status: 'needs_response', isLost: false, isWon: false }, harness.ctx('user_a'));
    expect(harness.state.payments.get('pay_a')?.status).toBe(PaymentStatus.DISPUTED);
    expect(grantA.revokedAt).toBeInstanceOf(Date);
    expect(grantA.reason).toContain('dp_same');
    expect(grantB.revokedAt).toBeNull();
    expect(manualA.revokedAt).toBeNull();
    expect((await harness.attemptPlayback('user_a')).status).toBe('READY'); // manual unrelated grant still keeps user A active

    const firstSuspension = grantA.revokedAt;
    await handleDispute({ stripeIntentId: 'pi_pay_a', disputeId: 'dp_same', status: 'needs_response', isLost: false, isWon: false }, harness.ctx('user_a'));
    expect(grantA.revokedAt).toBe(firstSuspension);

    await handleDispute({ stripeIntentId: 'pi_pay_a', disputeId: 'dp_other', status: 'won', isLost: false, isWon: true }, harness.ctx('user_a'));
    expect(grantA.revokedAt).toBe(firstSuspension);

    await handleDispute({ stripeIntentId: 'pi_pay_a', disputeId: 'dp_same', status: 'won', isLost: false, isWon: true }, harness.ctx('user_a'));
    expect(grantA.revokedAt).toBeNull();
    expect(grantB.revokedAt).toBeNull();
    expect(manualA.revokedAt).toBeNull();

    await handleRefund({ paymentId: 'pay_a', reportedRefundedMinor: 1000 }, harness.ctx(null, 'system'));
    expect(harness.state.payments.get('pay_a')?.status).toBe(PaymentStatus.REFUNDED);
    expect(grantA.revokedAt).toBeInstanceOf(Date);
    expect(manualA.revokedAt).toBeNull();
    await handleRefund({ paymentId: 'pay_a', reportedRefundedMinor: 1000 }, harness.ctx(null, 'system'));
    expect(harness.activeGrants('user_a')).toEqual([manualA]);

    await revokePatron({ userId: 'user_a', paymentId: null as any, note: 'Manual owner revoke' }, { ...harness.ctx('admin_1', 'admin') });
    cloudflareTokenCalls.length = 0;
    harness.state.sessions.length = 0;
    expect(harness.activeGrants('user_a')).toHaveLength(0);
    await handleDispute({ stripeIntentId: 'pi_pay_a', disputeId: 'dp_same', status: 'won', isLost: false, isWon: true }, harness.ctx('user_a'));
    expect(harness.activeGrants('user_a')).toHaveLength(0);
    expect((await harness.attemptPlayback('user_a')).status).toBe('PATRON_REQUIRED');
    expect(cloudflareTokenCalls).toHaveLength(0);
    expect(harness.state.sessions).toHaveLength(0);

    await handleDispute({ stripeIntentId: 'pi_pay_b', disputeId: 'dp_lost', status: 'lost', isLost: true, isWon: false }, harness.ctx('user_b'));
    expect(harness.state.payments.get('pay_b')?.status).toBe(PaymentStatus.CHARGEBACK_LOST);
    const lostRevokedAt = grantB.revokedAt;
    await handleDispute({ stripeIntentId: 'pi_pay_b', disputeId: 'dp_lost', status: 'lost', isLost: true, isWon: false }, harness.ctx('user_b'));
    await handleDispute({ stripeIntentId: 'pi_pay_b', disputeId: 'dp_lost', status: 'won', isLost: false, isWon: true }, harness.ctx('user_b'));
    await handleDispute({ stripeIntentId: 'pi_pay_b', disputeId: 'dp_old', status: 'needs_response', isLost: false, isWon: false }, harness.ctx('user_b'));
    expect(grantB.revokedAt).toBe(lostRevokedAt);
    expect(harness.activeGrants('user_b')).toHaveLength(0);
  });

  it('UI and route contract regression evidence stays source-based because no existing non-production Playwright route exercises these private states', () => {
    const actionsSource = readFileSync('app/admin/users/UserPatronActions.tsx', 'utf8');
    const diagnosticsSource = readFileSync('app/admin/users/AdminAccessDiagnostics.tsx', 'utf8');
    const wrapperSource = readFileSync('app/components/PremiumWrapper.tsx', 'utf8');

    expect(actionsSource).not.toContain('prompt(');
    expect(actionsSource).toContain('Dialog');
    expect(actionsSource).toContain('trimmedReason');
    expect(actionsSource).toContain('pendingRequestRef.current');
    expect(actionsSource).toContain('variant={dialogAction === "revoke" ? "destructive" : "default"}');
    expect(actionsSource).toContain('użytkownik straci dostęp Patrona');
    expect(actionsSource).toContain('Źródłem prawdy dostępu pozostaje aktywne uprawnienie PatronGrant');
    expect(diagnosticsSource).toContain('Prawda dostępu PatronGrant');
    expect(diagnosticsSource).toContain('Fakty płatności (nie prawda dostępu)');
    expect(diagnosticsSource).toContain('Cache User.isPatron');
    expect(diagnosticsSource).toContain('Newsletter/subskrypcja (niezwiązane z dostępem)');

    for (const state of ['LOGIN_REQUIRED', 'PATRON_REQUIRED', 'VIDEO_NOT_READY', 'PROCESSING', 'NO_PRIMARY_ASSET', 'UNAVAILABLE', 'ERROR']) {
      expect(wrapperSource).toContain(`${state}: {`);
      expect(wrapperSource).toContain(`  "${state}",`);
    }
    expect(wrapperSource).toContain('Dostęp patrona jest nagrodą za kwalifikujące jednorazowe wsparcie. To nie jest subskrypcja cykliczna.');
    expect(wrapperSource).toContain('if (!isPlayablePlaybackPlan(playbackPlan))');
    expect(wrapperSource).toContain('<PlaybackPlanStateOverlay');
    expect(wrapperSource).toContain('{children}');
    expect(wrapperSource).toContain('focus-visible:outline');
    const overlaySource = wrapperSource.slice(wrapperSource.indexOf('function PlaybackPlanStateOverlay'));
    expect(overlaySource).not.toContain('/api/media-source');
    expect(overlaySource).not.toContain('playbackUrl');
    expect(overlaySource).not.toContain('providerPlaybackId');
  });
});
