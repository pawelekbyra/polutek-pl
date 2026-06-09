import { describe, it, expect } from 'vitest';
import { VideoPolicy } from '@/lib/modules/video/domain/video.policy';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('VideoPolicy', () => {
  describe('canBeHero', () => {
    it('returns true for PUBLIC and PUBLISHED', () => {
      expect(VideoPolicy.canBeHero({ tier: AccessTier.PUBLIC, status: VideoStatus.PUBLISHED })).toBe(true);
    });

    it('returns false for PATRON tier', () => {
      expect(VideoPolicy.canBeHero({ tier: AccessTier.PATRON, status: VideoStatus.PUBLISHED })).toBe(false);
    });

    it('returns false for non-PUBLISHED status', () => {
      expect(VideoPolicy.canBeHero({ tier: AccessTier.PUBLIC, status: VideoStatus.DRAFT })).toBe(false);
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
