import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('thumbnail media-source fan-out guard', () => {
  it('does not wrap list thumbnails in PremiumWrapper fetch logic', () => {
    const channelCard = readFileSync('app/components/ChannelVideoCard.tsx', 'utf8');
    const channelHome = readFileSync('app/components/ChannelHome.tsx', 'utf8');

    expect(channelCard).not.toContain('PremiumWrapper');
    expect(channelHome).not.toContain('PremiumWrapper');
    expect(channelCard).not.toContain('/api/media-source');
    expect(channelHome).not.toContain('/api/media-source');
  });
});
