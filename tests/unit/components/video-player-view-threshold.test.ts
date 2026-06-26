import { describe, expect, it } from 'vitest';
import { getViewThresholdMs, shouldSendViewForPlaybackPosition } from '@/app/components/video-view-threshold';

describe('VideoPlayer view threshold', () => {
  it('counts an around-10-second video before an exact 10s timeupdate is emitted', () => {
    expect(getViewThresholdMs(10)).toBe(9000);
    expect(shouldSendViewForPlaybackPosition(8.9, 10)).toBe(false);
    expect(shouldSendViewForPlaybackPosition(9, 10)).toBe(true);
    expect(shouldSendViewForPlaybackPosition(9.8, 10)).toBe(true);
  });

  it('counts a 5-second video after approximately 90% watched or on ended', () => {
    expect(getViewThresholdMs(5)).toBe(4500);
    expect(shouldSendViewForPlaybackPosition(4.49, 5)).toBe(false);
    expect(shouldSendViewForPlaybackPosition(4.5, 5)).toBe(true);
    expect(shouldSendViewForPlaybackPosition(5, 5)).toBe(true);
  });

  it('keeps normal long videos on the 10-second threshold instead of 90%', () => {
    expect(getViewThresholdMs(60)).toBe(10000);
    expect(shouldSendViewForPlaybackPosition(9.9, 60)).toBe(false);
    expect(shouldSendViewForPlaybackPosition(10, 60)).toBe(true);
  });

  it('falls back to 10 seconds when duration is unknown', () => {
    expect(getViewThresholdMs()).toBe(10000);
    expect(shouldSendViewForPlaybackPosition(9.9)).toBe(false);
    expect(shouldSendViewForPlaybackPosition(10)).toBe(true);
  });
});
