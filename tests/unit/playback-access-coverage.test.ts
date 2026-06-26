import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { AccessTier, VideoStatus, WebhookEventStatus } from '@prisma/client';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/services/playback/cloudflare-signed-playback-token.service', () => ({
  CloudflareSignedPlaybackTokenService: {
    createSignedPlaybackToken: vi.fn(() => ({
      token: 'mock-token',
      expiresAt: new Date('2026-01-01T13:00:00.000Z'),
      expiresInSeconds: 3600,
    })),
  },
}));

vi.mock('@/lib/blob', () => ({
  isAllowedVideoSourceUrl: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/services/storage/storage.service', () => ({
  StorageService: {
    getPresignedUrl: vi.fn().mockResolvedValue({
      url: 'https://signed-url.com/video.mp4',
      expiresAt: new Date(Date.now() + 900000),
    }),
  },
}));

describe('PlaybackService Access Control Coverage', () => {
  let mockPrisma: any;
  const now = new Date('2026-01-01T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      video: {
        findUnique: vi.fn(),
      },
      videoPlaybackSession: {
        create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
    };
  });

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma, now: () => now });

  const baseVideo = {
    id: 'v1',
    title: 'Test Video',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    status: VideoStatus.PUBLISHED,
    tier: AccessTier.PUBLIC,
    videoUrl: 'https://example.com/video.mp4',
    asset: null,
  };

  describe('Guest Access', () => {
    it('Guest + PUBLIC video returns READY state', async () => {
      mockPrisma.video.findUnique.mockResolvedValue(baseVideo);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: true }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'guest' }));

      expect(plan.status).toBe('READY');
      expect(plan.canPlay).toBe(true);
      expect(plan.access.allowed).toBe(true);
      expect(plan.source?.playbackUrl).toBeDefined();
    });

    it('Guest + LOGGED_IN video returns LOGIN_REQUIRED state and redacts source', async () => {
      const video = { ...baseVideo, tier: AccessTier.LOGGED_IN };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: false, reason: 'LOGIN_REQUIRED', requiredTier: 'LOGGED_IN' }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'guest' }));

      expect(plan.status).toBe('LOGIN_REQUIRED');
      expect(plan.canPlay).toBe(false);
      expect(plan.access.allowed).toBe(false);
      expect(plan.access.reason).toBe('LOGIN_REQUIRED');
      expect(plan.source).toBeUndefined();
    });

    it('Guest + PATRON video returns PATRON_REQUIRED state and redacts source', async () => {
      const video = { ...baseVideo, tier: AccessTier.PATRON };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'guest' }));

      expect(plan.status).toBe('PATRON_REQUIRED');
      expect(plan.canPlay).toBe(false);
      expect(plan.access.allowed).toBe(false);
      expect(plan.access.reason).toBe('PATRON_REQUIRED');
      expect(plan.source).toBeUndefined();
    });
  });

  describe('Logged-in Non-Patron Access', () => {
    it('Non-patron + PATRON video returns PATRON_REQUIRED state and redacts source', async () => {
      const video = { ...baseVideo, tier: AccessTier.PATRON };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'user', userId: 'u1', isPatron: false }));

      expect(plan.status).toBe('PATRON_REQUIRED');
      expect(plan.canPlay).toBe(false);
      expect(plan.access.allowed).toBe(false);
      expect(plan.source).toBeUndefined();
    });
  });

  describe('Patron Access', () => {
    it('Active patron grant + PATRON video (with READY asset) returns READY state', async () => {
      const video = {
        ...baseVideo,
        tier: AccessTier.PATRON,
        videoUrl: 'https://example.com/video.mp4',
        asset: {
          provider: 'CLOUDFLARE_STREAM',
          isPrimary: true,
          processingState: 'READY',
          providerPlaybackId: 'mock-id'
        }
      };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: true }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'user', userId: 'u1', isPatron: true }));

      expect(plan.status).toBe('READY');
      expect(plan.canPlay).toBe(true);
      expect(plan.access.allowed).toBe(true);
      expect(plan.source?.playbackUrl).toBe('https://videodelivery.net/mock-token/manifest/video.m3u8');
      expect(plan.source?.embedUrl).toBe('https://iframe.videodelivery.net/mock-token');
    });

    it('Revoked/Expired patron grant + PATRON video returns PATRON_REQUIRED', async () => {
      const video = { ...baseVideo, tier: AccessTier.PATRON };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      // checkVideoAccess handles the grant check, we mock its result
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'user', userId: 'u1', isPatron: false }));

      expect(plan.status).toBe('PATRON_REQUIRED');
      expect(plan.canPlay).toBe(false);
      expect(plan.access.allowed).toBe(false);
      expect(plan.source).toBeUndefined();
    });
  });

  describe('Leak Prevention', () => {
    it('Missing video returns UNAVAILABLE and redacts sensitive data', async () => {
      mockPrisma.video.findUnique.mockResolvedValue(null);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: false, reason: 'NOT_FOUND' }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v-missing', createCtx({ type: 'guest' }));

      expect(plan.status).toBe('UNAVAILABLE');
      expect(plan.canPlay).toBe(false);
      expect(plan.source).toBeUndefined();
      expect(plan.player.title).toBe('');
    });

    it('Unpublished video for non-admin returns UNAVAILABLE and redacts source', async () => {
      const video = { ...baseVideo, status: VideoStatus.DRAFT };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: false, reason: 'NOT_FOUND' }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'user', userId: 'u1' }));

      expect(plan.status).toBe('UNAVAILABLE');
      expect(plan.canPlay).toBe(false);
      expect(plan.source).toBeUndefined();
    });

    it('Cloudflare provider identifiers are redacted in public diagnostics even if allowed', async () => {
      const video = {
        ...baseVideo,
        asset: {
          provider: 'CLOUDFLARE_STREAM',
          providerAssetId: 'secret-asset-id',
          providerPlaybackId: 'secret-playback-id',
          isPrimary: true,
          processingState: 'READY'
        }
      };
      mockPrisma.video.findUnique.mockResolvedValue(video);
      (checkVideoAccess as any).mockResolvedValue(ok({ hasAccess: true }));

      const plan = await PlaybackService.createPlaybackPlanWithContext('v1', createCtx({ type: 'user', userId: 'u1' }));

      expect(plan.status).toBe('READY');
      expect(plan.diagnostics.asset?.providerAssetId).toBeNull();
      expect(plan.diagnostics.asset?.providerPlaybackId).toBeNull();
    });
  });
});
