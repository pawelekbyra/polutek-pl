import { describe, expect, it } from 'vitest';
import { getCanonicalVideoTitle, getVideoDisplayTitle } from '@/lib/video-title-overrides';

describe('video title overrides', () => {
  it('respects database titles and ignores legacy overrides', () => {
    const video = { slug: 'wuthering-heights-cover', title: 'Wuthering Heights' };

    expect(getVideoDisplayTitle(video, 'pl')).toBe('Wuthering Heights');
    expect(getVideoDisplayTitle(video, 'en')).toBe("Wuthering Heights");
  });

  it('returns the title as is for all tiers', () => {
    expect(getCanonicalVideoTitle({ slug: 'historia-powstania-osady', title: 'Historia powstania osady' })).toBe('Historia powstania osady');
    expect(getCanonicalVideoTitle({ slug: 'intencja-swiadomosc-sprawczosci', title: 'Intencja' })).toBe('Intencja');
  });
});
