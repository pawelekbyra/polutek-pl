import { describe, expect, it } from 'vitest';
import {
  getCanonicalVideoDescription,
  getCanonicalVideoTitle,
  getVideoDisplayDescription,
  getVideoDisplayTitle,
} from '@/lib/video-title-overrides';

describe('video display copy helpers', () => {
  it('uses English title and description only for English display when translations exist', () => {
    const video = {
      title: 'Polski tytuł',
      titleEn: 'English title',
      description: 'Polski opis',
      descriptionEn: 'English description',
    };

    expect(getVideoDisplayTitle(video, 'en')).toBe('English title');
    expect(getVideoDisplayDescription(video, 'en')).toBe('English description');
    expect(getVideoDisplayTitle(video, 'pl')).toBe('Polski tytuł');
    expect(getVideoDisplayDescription(video, 'pl')).toBe('Polski opis');
  });

  it('keeps PL/base fields canonical and falls back only when base copy is missing', () => {
    expect(getCanonicalVideoTitle({ title: 'PL', titleEn: 'EN' })).toBe('PL');
    expect(getCanonicalVideoDescription({ description: 'Opis PL', descriptionEn: 'Desc EN' })).toBe('Opis PL');
    expect(getCanonicalVideoTitle({ title: null, titleEn: 'EN only' })).toBe('EN only');
    expect(getCanonicalVideoDescription({ description: null, descriptionEn: 'EN desc only' })).toBe('EN desc only');
  });
});
