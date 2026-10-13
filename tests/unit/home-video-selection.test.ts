import { describe, it, expect } from 'vitest';
import { needsExtraVideoLookup, pickHomeVideo } from '@/lib/home-video-selection';

const v = (id: string, slug: string) => ({ id, slug });
const hero = v('hero', 'hero-slug');
const inList = v('a', 'in-list');
const outside = v('x', 'other-channel-video');
const allVideos = [hero, inList];

describe('pickHomeVideo', () => {
  it('returns the hero when no video is requested', () => {
    expect(pickHomeVideo(undefined, { allVideos, mainVideo: hero })).toBe(hero);
  });

  it('finds a video of the list by id and by slug', () => {
    expect(pickHomeVideo('a', { allVideos, mainVideo: hero })).toBe(inList);
    expect(pickHomeVideo('in-list', { allVideos, mainVideo: hero })).toBe(inList);
  });

  it('uses the extra video for a slug (or id) outside the list', () => {
    expect(pickHomeVideo('other-channel-video', { allVideos, mainVideo: hero, extraVideo: outside })).toBe(outside);
    expect(pickHomeVideo('x', { allVideos, mainVideo: hero, extraVideo: outside })).toBe(outside);
  });

  it('prefers the list over the extra video', () => {
    expect(pickHomeVideo('in-list', { allVideos, mainVideo: hero, extraVideo: outside })).toBe(inList);
  });

  it('falls back to the hero for a video that does not exist', () => {
    expect(pickHomeVideo('nope', { allVideos, mainVideo: hero, extraVideo: null })).toBe(hero);
  });

  it('falls back to the hero for a forbidden video (the server loads no extra video for it)', () => {
    expect(pickHomeVideo('secret-draft', { allVideos, mainVideo: hero, extraVideo: null })).toBe(hero);
  });

  it('does not use an extra video that was loaded for a different request value', () => {
    expect(pickHomeVideo('something-else', { allVideos, mainVideo: hero, extraVideo: outside })).toBe(hero);
  });

  it('returns null when there is neither a match nor a hero', () => {
    expect(pickHomeVideo('nope', { allVideos: [], mainVideo: null })).toBeNull();
  });
});

describe('needsExtraVideoLookup', () => {
  it('is false without a request value or when the list has the video', () => {
    expect(needsExtraVideoLookup(undefined, allVideos)).toBe(false);
    expect(needsExtraVideoLookup('in-list', allVideos)).toBe(false);
    expect(needsExtraVideoLookup('a', allVideos)).toBe(false);
  });

  it('is true for a value outside the list', () => {
    expect(needsExtraVideoLookup('other-channel-video', allVideos)).toBe(true);
  });
});
