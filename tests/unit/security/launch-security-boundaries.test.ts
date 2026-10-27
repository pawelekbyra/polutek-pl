import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { buildPatronDiagnosticsReadModel } from '@/lib/modules/users/application/patron-read-model';
import { CommentPolicy } from '@/lib/modules/comments/domain/comment.policy';
import { handleApiError } from '@/lib/errors';

const repoRoot = process.cwd();
const source = (path: string) => readFileSync(join(repoRoot, path), 'utf8');


vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>();
  return {
    ...actual,
    handleApiError: vi.fn((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json({ error: message }, { status: 500 });
    }),
  };
});

vi.mock('@/lib/observability', () => ({
  recordAlert: vi.fn(),
  recordDurationMetric: vi.fn(),
  recordMetric: vi.fn(),
  startTimer: vi.fn(() => Date.now()),
}));

describe('LAUNCH-SECURITY-001 security boundary regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('has no Cloudflare Stream or Mux webhook route any more (own HLS is the only video source)', () => {
    expect(() => source('app/api/webhooks/cloudflare-stream/route.ts')).toThrow();
    expect(() => source('app/api/webhooks/mux/route.ts')).toThrow();
  });

  it('preserves Active PatronGrant as access truth over stale user cache signals', () => {
    const staleCache = buildPatronDiagnosticsReadModel([]);

    expect(staleCache.finalPatronStatus).toBe('NO_ACTIVE_GRANT');
    expect(staleCache.finalPatronStatusSource).toBe('ACTIVE_PATRON_GRANT');
    expect(staleCache.truth.isPatron).toBe(false);

    const activeGrant = buildPatronDiagnosticsReadModel(
      [
        {
          id: 'grant-1',
          source: 'stripe',
          createdAt: new Date('2025-02-01T00:00:00Z'),
          revokedAt: null,
        },
      ]
    );

    expect(activeGrant.finalPatronStatus).toBe('ACTIVE_GRANT');
    expect(activeGrant.truth.activeGrantIds).toEqual(['grant-1']);
  });

  it('keeps comment/community mutations tied to authenticated access and object ownership/admin rules', () => {
    expect(CommentPolicy.canCreateComment({ type: 'guest' }, { hasAccess: true })).toBe(false);
    expect(CommentPolicy.canReactToComment({ type: 'user', userId: 'u1' }, { hasAccess: false, reason: 'LOGIN_REQUIRED' })).toBe(false);
    expect(CommentPolicy.canUpdateComment({ type: 'user', userId: 'u1' }, 'u2')).toBe(false);
    expect(CommentPolicy.canUpdateComment({ type: 'user', userId: 'u1' }, 'u1')).toBe(true);
    // Platform ADMIN alone is not a public-site moderator; only a channel moderator (isModeratorOfVideo) deletes others' comments.
    expect(CommentPolicy.canDeleteComment({ type: 'admin', userId: 'admin-1' }, 'u2', false)).toBe(false);
    expect(CommentPolicy.canDeleteComment({ type: 'user', userId: 'mod-1' }, 'u2', true)).toBe(true);
    expect(CommentPolicy.canDeleteComment({ type: 'user', userId: 'u1' }, 'u2', false)).toBe(false);
    expect(CommentPolicy.canReportComment({ type: 'guest' }, { hasAccess: true })).toBe(false);
  });

  it('keeps denied and non-ready playback source-contracts free of URLs, tokens, sessions and views', () => {
    const playbackSource = source('lib/modules/playback/application/playback.service.ts');
    const denialBlock = playbackSource.slice(
      playbackSource.indexOf('if (!decision.hasAccess)'),
      playbackSource.indexOf('// At this point decision.hasAccess is true')
    );
    const processingBlock = playbackSource.slice(
      playbackSource.indexOf('if (!primaryAsset.canResolveProviderSource)'),
      playbackSource.indexOf('if (!SelfHlsTokenService.isConfigured())')
    );
    const unconfiguredBlock = playbackSource.slice(
      playbackSource.indexOf('if (!SelfHlsTokenService.isConfigured())'),
      playbackSource.indexOf('const plan = await buildSelfHlsPlan')
    );

    // The denial returns the unavailable plan (optionally with offer data: prices only, no source/token).
    expect(denialBlock).toContain('unavailablePlan(');
    expect(denialBlock).toContain('deniedPlan');
    expect(denialBlock).not.toContain('SelfHlsTokenService.sign');
    expect(denialBlock).not.toContain('buildSelfHlsPlan');
    expect(denialBlock).not.toContain('videoPlaybackSession.create');
    expect(processingBlock).toContain('return unavailablePlan');
    expect(processingBlock).not.toContain('buildSelfHlsPlan');
    expect(processingBlock).not.toContain('videoPlaybackSession.create');
    expect(unconfiguredBlock).toContain('return unavailablePlan');
    // The only place a delivery URL and a session are made is the own-HLS plan builder, after every gate.
    expect(playbackSource).not.toContain('videoPlaybackSession.create');
    expect(playbackSource.indexOf('buildSelfHlsPlan({')).toBeGreaterThan(playbackSource.indexOf('if (!decision.hasAccess)'));
    expect(playbackSource.indexOf('buildSelfHlsPlan({')).toBeGreaterThan(playbackSource.indexOf('isUpcomingPremiere(video)'));
  });

  it('keeps Stripe webhook verification and idempotency before fulfillment side effects', () => {
    const stripeUseCase = source('lib/modules/payments/application/handle-stripe-webhook.use-case.ts');
    const constructIndex = stripeUseCase.indexOf('Stripe.webhooks.constructEvent');
    const lockIndex = stripeUseCase.indexOf('lockService.acquireLock');
    const fulfillIndex = stripeUseCase.indexOf('fulfillPayment({');
    const refundIndex = stripeUseCase.indexOf('syncRefundsFromStripe({');
    const disputeIndex = stripeUseCase.indexOf('handleDispute({');

    expect(stripeUseCase).toContain('if (!endpointSecret)');
    expect(constructIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(constructIndex);
    expect(fulfillIndex).toBeGreaterThan(lockIndex);
    expect(refundIndex).toBeGreaterThan(lockIndex);
    expect(disputeIndex).toBeGreaterThan(lockIndex);
  });

  it('keeps public webhook and playback error responses free of stack traces in route contracts', () => {
    const stripeRoute = source('app/api/webhooks/stripe/route.ts');
    const mediaRoute = source('app/api/media-source/[videoId]/route.ts');

    // Behaviour is covered with real signatures in tests/unit/modules/payments/stripe-webhook-signed.test.ts.
    expect(stripeRoute).toContain("message: 'Webhook processing failed'");
    expect(stripeRoute).not.toContain('err.stack');
    expect(stripeRoute).not.toContain('.stack');
    // The raw-URL safety net is the shared sanitizer (also used by the server-rendered home page);
    // its behaviour is tested in tests/unit/api/media-source-route.test.ts.
    expect(mediaRoute).toContain('toPublicPlaybackPlan');
    expect(source('lib/modules/playback/application/public-playback-plan.ts')).toContain('MediaPolicy.isProbablyRawMediaUrl');
    expect(mediaRoute).not.toContain('playbackToken');
    expect(handleApiError).toBeDefined();
  });
});
