import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { buildPatronDiagnosticsReadModel } from '@/lib/modules/users/application/patron-read-model';
import { CommentPolicy } from '@/lib/modules/comments/domain/comment.policy';
import { handleApiError } from '@/lib/errors';

const repoRoot = process.cwd();
const source = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const mockRequireAdminForApi = vi.fn();
const mockGrantPatron = vi.fn();
const mockRevokePatron = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: mockRequireAdminForApi,
}));

vi.mock('@/lib/modules/patron', () => ({
  grantPatron: mockGrantPatron,
  revokePatron: mockRevokePatron,
}));


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
  // Warm the route modules once: their cold import graph is large and would otherwise
  // eat the first tests' 5s budget under a fully parallel suite run.
  beforeAll(async () => {
    await import('@/app/api/admin/users/[userId]/patron/route');
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('denies an unauthenticated admin patron mutation before grant/revoke side effects', async () => {
    mockRequireAdminForApi.mockResolvedValue({
      adminUserId: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const { PATCH } = await import('@/app/api/admin/users/[userId]/patron/route');
    const request = new NextRequest('http://localhost/api/admin/users/user-1/patron', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'grant', reason: 'manual verification' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ userId: 'user-1' }) });

    expect(response.status).toBe(401);
    expect(mockRequireAdminForApi).toHaveBeenCalledWith('PATCH_ADMIN_USER_PATRON');
    expect(mockGrantPatron).not.toHaveBeenCalled();
    expect(mockRevokePatron).not.toHaveBeenCalled();
  });

  it('denies a non-admin admin patron mutation before grant/revoke side effects', async () => {
    mockRequireAdminForApi.mockResolvedValue({
      adminUserId: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const { PATCH } = await import('@/app/api/admin/users/[userId]/patron/route');
    const request = new NextRequest('http://localhost/api/admin/users/user-1/patron', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'revoke', reason: 'manual verification' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ userId: 'user-1' }) });

    expect(response.status).toBe(403);
    expect(mockRevokePatron).not.toHaveBeenCalled();
    expect(mockGrantPatron).not.toHaveBeenCalled();
  });

  it('requires a valid manual patron action and non-empty reason before mutation', async () => {
    mockRequireAdminForApi.mockResolvedValue({ adminUserId: 'admin-1', response: null });
    const { PATCH } = await import('@/app/api/admin/users/[userId]/patron/route');

    const missingReason = await PATCH(new NextRequest('http://localhost/api/admin/users/user-1/patron', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'grant', reason: '   ' }),
    }), { params: Promise.resolve({ userId: 'user-1' }) });

    expect(missingReason.status).toBe(400);
    expect(mockGrantPatron).not.toHaveBeenCalled();

    const invalidAction = await PATCH(new NextRequest('http://localhost/api/admin/users/user-1/patron', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'promote', reason: 'manual verification' }),
    }), { params: Promise.resolve({ userId: 'user-1' }) });

    expect(invalidAction.status).toBe(400);
    expect(mockGrantPatron).not.toHaveBeenCalled();
    expect(mockRevokePatron).not.toHaveBeenCalled();
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
    expect(CommentPolicy.canDeleteComment({ type: 'admin', userId: 'admin-1' }, 'u2', false)).toBe(true);
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

    expect(denialBlock).toContain('return unavailablePlan');
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
    const refundIndex = stripeUseCase.indexOf('handleRefund({');
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
