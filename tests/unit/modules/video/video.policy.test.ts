import { describe, it, expect } from 'vitest';
import { VideoPolicy } from '@/lib/modules/video/domain/video.policy';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('VideoPolicy', () => {
  const validAsset = {
    isPrimary: true,
    processingState: 'READY',
    provider: 'CLOUDFLARE_STREAM',
    providerAssetId: 'v123'
  };

  describe('canBeHero', () => {
    it('returns true for PUBLIC and PUBLISHED with required fields', () => {
      expect(VideoPolicy.canBeHero({
        title: 'Title',
        slug: 'slug',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        asset: validAsset
      })).toBe(true);
    });

    it('returns false for PATRON tier', () => {
      expect(VideoPolicy.canBeHero({
        title: 'Title',
        slug: 'slug',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        asset: validAsset
      })).toBe(false);
    });

    it('returns false for non-PUBLISHED status', () => {
      expect(VideoPolicy.canBeHero({
        title: 'Title',
        slug: 'slug',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
        asset: validAsset
      })).toBe(false);
    });

    it('returns correct Polish blocker messages for hero', () => {
      const video = {
        title: 'Title',
        slug: 'slug',
        tier: AccessTier.PATRON,
        status: VideoStatus.DRAFT,
        asset: validAsset
      };
      const blockers = VideoPolicy.getHeroBlockers(video);
      expect(blockers).toContainEqual({ code: 'VIDEO_HERO_NOT_PUBLISHED', message: 'Film Hero musi być OPUBLIKOWANY.', field: 'status' });
      expect(blockers).toContainEqual({ code: 'VIDEO_HERO_NOT_PUBLIC', message: 'Film Hero musi być PUBLICZNY.', field: 'tier' });
    });

    it('returns correct Polish blocker message for archived hero', () => {
        const video = {
          title: 'Title',
          slug: 'slug',
          tier: AccessTier.PUBLIC,
          status: VideoStatus.ARCHIVED,
          asset: validAsset
        };
        const blockers = VideoPolicy.getHeroBlockers(video);
        expect(blockers).toContainEqual({ code: 'VIDEO_HERO_ARCHIVED', message: 'Zarchiwizowany film nie może być filmem Hero.', field: 'status' });
    });
  });

  describe('getSidebarBlockers', () => {
    it('returns correct Polish message for ARCHIVED status', () => {
        const blockers = VideoPolicy.getSidebarBlockers({ status: VideoStatus.ARCHIVED });
        expect(blockers).toEqual([{ code: 'VIDEO_SIDEBAR_ARCHIVED', message: 'Zarchiwizowany film nie może być widoczny w panelu bocznym.', field: 'status' }]);
    });

    it('returns correct Polish message for non-PUBLISHED status', () => {
        const blockers = VideoPolicy.getSidebarBlockers({ status: VideoStatus.DRAFT });
        expect(blockers).toEqual([{ code: 'VIDEO_SIDEBAR_NOT_PUBLISHED', message: 'Tylko opublikowane filmy mogą być widoczne w panelu bocznym.', field: 'status' }]);
    });
  });

  describe('isOnMainChannel', () => {
    it('returns true if creatorId matches', () => {
      expect(VideoPolicy.isOnMainChannel({ creatorId: 'c1' }, 'c1')).toBe(true);
    });

    it('returns false if creatorId mismatch', () => {
      expect(VideoPolicy.isOnMainChannel({ creatorId: 'c1' }, 'other')).toBe(false);
    });
  });

  describe('isPubliclyVisible', () => {
    const now = new Date('2024-01-01T12:00:00Z');

    it('returns true for published video in the past', () => {
      expect(VideoPolicy.isPubliclyVisible({
          status: VideoStatus.PUBLISHED,
          publishedAt: new Date('2023-12-31')
      }, now)).toBe(true);
    });

    it('returns false for draft', () => {
      expect(VideoPolicy.isPubliclyVisible({
          status: VideoStatus.DRAFT,
          publishedAt: new Date('2023-12-31')
      }, now)).toBe(false);
    });

    it('returns false for future publication', () => {
        expect(VideoPolicy.isPubliclyVisible({
            status: VideoStatus.PUBLISHED,
            publishedAt: new Date('2024-01-02')
        }, now)).toBe(false);
      });
  });
});
