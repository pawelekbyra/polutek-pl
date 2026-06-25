import { describe, expect, it } from 'vitest';
import { getCanonicalVideoTitle, getVideoDisplayTitle } from '@/lib/video-title-overrides';

describe('video title overrides', () => {
  it('respects database titles and ignores legacy overrides', () => {
    const video = { slug: 'wuthering-heights-cover', title: 'Wuthering Heights' };

    expect(getVideoDisplayTitle(video, 'pl')).toBe('Wuthering Heights');
    expect(getVideoDisplayTitle(video, 'en')).toBe("Wuthering Heights");
  });

  it('returns the base title as canonical when an English translation exists', () => {
    const video = {
      slug: 'film-z-polskim-i-angielskim-tytulem',
      title: 'Polski tytuł',
      titleEn: 'English title',
    };

    expect(getCanonicalVideoTitle(video)).toBe('Polski tytuł');
    expect(getVideoDisplayTitle(video, 'pl')).toBe('Polski tytuł');
    expect(getVideoDisplayTitle(video, 'en')).toBe('English title');
  });

  it('falls back to English title only when base title is missing', () => {
    expect(getCanonicalVideoTitle({ title: null, titleEn: 'English fallback' })).toBe('English fallback');
  });

  it('returns the title as is for all tiers', () => {
    expect(getCanonicalVideoTitle({ slug: 'historia-powstania-osady', title: 'Historia powstania osady' })).toBe('Historia powstania osady');
    expect(getCanonicalVideoTitle({ slug: 'intencja-swiadomosc-sprawczosci', title: 'Intencja' })).toBe('Intencja');
  });
});
