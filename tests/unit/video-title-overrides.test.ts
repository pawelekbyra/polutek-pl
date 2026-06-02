import { describe, expect, it } from 'vitest';
import { getCanonicalVideoTitle, getVideoDisplayTitle } from '@/lib/video-title-overrides';

describe('video title overrides', () => {
  it('localizes the Wuthering placeholder title by slug', () => {
    const video = { slug: 'wuthering-heights-cover', title: 'Wuthering Heights' };

    expect(getVideoDisplayTitle(video, 'pl')).toBe('Nie masz psychy się zalogować');
    expect(getVideoDisplayTitle(video, 'en')).toBe("You don't have the guts to log in");
  });

  it('keeps known logged-in and patron placeholders visible with requested titles', () => {
    expect(getCanonicalVideoTitle({ slug: 'historia-powstania-osady', title: 'Historia powstania osady' })).toBe('Secret Project');
    expect(getCanonicalVideoTitle({ slug: 'intencja-swiadomosc-sprawczosci', title: 'Intencja świadomość sprawczości' })).toBe('Udało się!!!');
  });

  it('still catches the old homepage special slug', () => {
    expect(getVideoDisplayTitle({ slug: 'independency-2024', title: 'Old title' }, 'pl')).toBe('Nie masz psychy się zalogować');
  });
});
