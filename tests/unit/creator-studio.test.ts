import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ContentService } from '@/lib/services/content.service';
import { AccessTier, VideoStatus } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Creator Studio: ContentService Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMainFeaturedVideo fallback logic', () => {
    it('returns the main featured video if it is PUBLIC and PUBLISHED', async () => {
        const mockFeatured = { id: 'v1', isMainFeatured: true, tier: AccessTier.PUBLIC, status: VideoStatus.PUBLISHED };
        vi.mocked(prisma.video.findFirst).mockResolvedValueOnce(mockFeatured as any);

        const result = await ContentService.getMainFeaturedVideo();
        expect(result?.id).toBe('v1');
    });

    it('falls back to the first PUBLIC + PUBLISHED video if no featured video exists', async () => {
        vi.mocked(prisma.video.findFirst)
            .mockResolvedValueOnce(null) // No featured
            .mockResolvedValueOnce({ id: 'v2', tier: AccessTier.PUBLIC, status: VideoStatus.PUBLISHED } as any); // First public

        const result = await ContentService.getMainFeaturedVideo();
        expect(result?.id).toBe('v2');
    });

    it('returns null if no public + published videos exist at all', async () => {
        vi.mocked(prisma.video.findFirst).mockResolvedValue(null);
        const result = await ContentService.getMainFeaturedVideo();
        expect(result).toBeNull();
    });
  });
});
