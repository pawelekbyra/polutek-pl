import { describe, expect, it } from 'vitest';
import { AccessTier } from '@prisma/client';
import { createSeedVideosData } from '@/prisma/seed-data';

describe('seed data smoke checks', () => {
  it('creates at least one public featured video for the homepage', () => {
    const videos = createSeedVideosData({
      mediaUrl: 'https://media.example.com/video.mp4',
      thumbnailUrl: '/thumb.jpg',
    });

    expect(videos.length).toBeGreaterThan(0);
    expect(videos.some((video) => video.tier === AccessTier.PUBLIC && video.isMainFeatured)).toBe(true);
    expect(videos.every((video) => video.videoUrl === 'https://media.example.com/video.mp4')).toBe(true);
  });
});
