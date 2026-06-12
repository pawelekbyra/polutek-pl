import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { buildPatronDiagnosticsReadModel } from '@/lib/modules/users/application/patron-read-model';
import { CommentPolicy } from '@/lib/modules/comments/domain/comment.policy';
import { handleApiError } from '@/lib/errors';
import { ok } from '@/lib/modules/shared/result';

const repoRoot = process.cwd();
const source = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const mockRequireAdminForApi = vi.fn();
const mockGrantPatron = vi.fn();
const mockRevokePatron = vi.fn();
const mockSyncClerkAccess = vi.fn();
const mockHandleCloudflareStreamWebhook = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: mockRequireAdminForApi,
}));

vi.mock('@/lib/modules/patron', () => ({
  grantPatron: mockGrantPatron,
  revokePatron: mockRevokePatron,
}));

vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: {
    syncClerkAccess: mockSyncClerkAccess,
  },
}));

vi.mock('@/lib/modules/video', () => ({
  handleCloudflareStreamWebhook: mockHandleCloudflareStreamWebhook,
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
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLOUDFLARE_WEBHOOK_SECRET;
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

    const response = await PATCH(request, { params: { userId: 'user-1' } });

    expect(response.status).toBe(401);
    expect(mockRequireAdminForApi).toHaveBeenCalledWith('PATCH_ADMIN_USER_PATRON');
    expect(mockGrantPatron).not.toHaveBeenCalled();
    expect(mockRevokePatron).not.toHaveBeenCalled();
    expect(mockSyncClerkAccess).not.toHaveBeenCalled();
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

    const response = await PATCH(request, { params: { userId: 'user-1' } });

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
    }), { params: { userId: 'user-1' } });

    expect(missingReason.status).toBe(400);
    expect(mockGrantPatron).not.toHaveBeenCalled();

    const invalidAction = await PATCH(new NextRequest('http://localhost/api/admin/users/user-1/patron', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'promote', reason: 'manual verification' }),
    }), { params: { userId: 'user-1' } });

    expect(invalidAction.status).toBe(400);
    expect(mockGrantPatron).not.toHaveBeenCalled();
    expect(mockRevokePatron).not.toHaveBeenCalled();
  });

  it('rejects invalid Cloudflare Stream official HMAC webhook signatures with zero side effects', async () => {
    const secret = 'expected-cloudflare-signing-secret';
    const rawBody = JSON.stringify({ uid: 'cf-asset', status: { state: 'ready' } });
    const timestamp = Math.floor(Date.now() / 1000);
    const invalidSignature = createHmac('sha256', 'wrong-secret')
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');
    vi.stubEnv('CLOUDFLARE_WEBHOOK_SECRET', secret);
    mockHandleCloudflareStreamWebhook.mockResolvedValue(ok({ assetId: 'asset-1', status: 'READY' }));

    const { POST } = await import('@/app/api/webhooks/cloudflare-stream/route');
    const response = await POST(new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
      method: 'POST',
      headers: { 'Webhook-Signature': `time=${timestamp},sig1=${invalidSignature}` },
      body: rawBody,
    }));

    expect(response.status).toBe(401);
    expect(mockHandleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('does not accept the obsolete cf-webhook-signature shared-secret equality scheme', async () => {
    vi.stubEnv('CLOUDFLARE_WEBHOOK_SECRET', 'expected-cloudflare-signing-secret');

    const { POST } = await import('@/app/api/webhooks/cloudflare-stream/route');
    const response = await POST(new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
      method: 'POST',
      headers: { 'cf-webhook-signature': 'expected-cloudflare-signing-secret' },
      body: JSON.stringify({ uid: 'cf-asset', status: { state: 'ready' } }),
    }));

    expect(response.status).toBe(401);
    expect(mockHandleCloudflareStreamWebhook).not.toHaveBeenCalled();
  });

  it('fails Cloudflare Stream webhook closed in production when the signing secret is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLOUDFLARE_WEBHOOK_SECRET', '');

    const { POST } = await import('@/app/api/webhooks/cloudflare-stream/route');
    const response = await POST(new NextRequest('http://localhost/api/webhooks/cloudflare-stream', {
      method: 'POST',
      headers: { 'Webhook-Signature': 'time=1735689600,sig1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      body: JSON.stringify({ uid: 'cf-asset', status: { state: 'ready' } }),
    }));

    expect(response.status).toBe(500);
    expect(mockHandleCloudflareStreamWebhook).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('preserves Active PatronGrant as access truth over stale user cache signals', () => {
    const staleCache = buildPatronDiagnosticsReadModel({
      isPatron: true,
      patronSince: new Date('2024-01-01T00:00:00Z'),
      patronSource: 'legacy-cache',
    }, []);

    expect(staleCache.finalPatronStatus).toBe('NO_ACTIVE_GRANT');
    expect(staleCache.finalPatronStatusSource).toBe('ACTIVE_PATRON_GRANT');
    expect(staleCache.truth.isPatron).toBe(false);
    expect(staleCache.cacheTruthMismatch.hasMismatch).toBe(true);

    const activeGrant = buildPatronDiagnosticsReadModel({
      isPatron: false,
      patronSince: null,
      patronSource: null,
    }, [{
      id: 'grant-1',
      source: 'stripe',
      createdAt: new Date('2025-02-01T00:00:00Z'),
      revokedAt: null,
    }]);

    expect(activeGrant.finalPatronStatus).toBe('ACTIVE_GRANT');
    expect(activeGrant.truth.activeGrantIds).toEqual(['grant-1']);
  });

  it('keeps comment/community mutations tied to authenticated access and object ownership/admin rules', () => {
    expect(CommentPolicy.canCreateComment({ type: 'guest' }, { hasAccess: true })).toBe(false);
    expect(CommentPolicy.canReactToComment({ type: 'user', userId: 'u1', isPatron: false }, { hasAccess: false, reason: 'PATRON_REQUIRED' })).toBe(false);
    expect(CommentPolicy.canUpdateComment({ type: 'user', userId: 'u1', isPatron: true }, 'u2')).toBe(false);
    expect(CommentPolicy.canUpdateComment({ type: 'user', userId: 'u1', isPatron: true }, 'u1')).toBe(true);
    expect(CommentPolicy.canDeleteComment({ type: 'admin', userId: 'admin-1' }, 'u2', false)).toBe(true);
    expect(CommentPolicy.canReportComment({ type: 'guest' }, { hasAccess: true })).toBe(false);
  });

  it('keeps denied and non-ready playback source-contracts free of provider calls, URLs, tokens, sessions and views', () => {
    const playbackSource = source('lib/services/playback/playback.service.ts');
    const denialBlock = playbackSource.slice(
      playbackSource.indexOf('if (!decision.hasAccess)'),
      playbackSource.indexOf('// At this point decision.hasAccess is true')
    );
    const processingBlock = playbackSource.slice(
      playbackSource.indexOf("if (asset.processingState === 'PENDING'"),
      playbackSource.indexOf("if (asset.processingState !== 'READY')")
    );

    expect(denialBlock).toContain('return unavailablePlan');
    expect(denialBlock).not.toContain('CloudflareStreamClient');
    expect(denialBlock).not.toContain('createSignedPlaybackToken');
    expect(denialBlock).not.toContain('videoPlaybackSession.create');
    expect(processingBlock).toContain('return unavailablePlan');
    expect(processingBlock).not.toContain('createSignedPlaybackToken');
    expect(processingBlock).not.toContain('videoPlaybackSession.create');
  });

  it('keeps Stripe webhook verification and idempotency before fulfillment side effects', () => {
    const stripeUseCase = source('lib/modules/payments/application/handle-stripe-webhook.use-case.ts');
    const constructIndex = stripeUseCase.indexOf('stripe.webhooks.constructEvent');
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
    const clerkRoute = source('app/api/webhooks/clerk/route.ts');
    const mediaRoute = source('app/api/media-source/[videoId]/route.ts');

    expect(stripeRoute).toContain('return handleApiError(err)');
    expect(stripeRoute).not.toContain('err.stack');
    expect(clerkRoute).toContain('safeErrorMessage(error)');
    expect(clerkRoute).not.toContain('stack');
    expect(mediaRoute).toContain('MediaPolicy.isProbablyRawMediaUrl');
    expect(mediaRoute).not.toContain('playbackToken');
    expect(handleApiError).toBeDefined();
  });
});
