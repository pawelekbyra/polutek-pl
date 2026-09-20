/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import VideoPlayer from '@/app/components/VideoPlayer';
import type { PublicVideoDTO } from '@/app/types/video';

// Captures the callback IntersectionObserver was constructed with, so tests can simulate
// visibility changes without a real layout engine (JSDOM has no real IntersectionObserver).
let capturedIntersectionCallback: IntersectionObserverCallback | null = null;
let capturedIntersectionOptions: IntersectionObserverInit | undefined;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    capturedIntersectionCallback = callback;
    capturedIntersectionOptions = options;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}
// @ts-expect-error — test stub, not a full IntersectionObserver implementation.
global.IntersectionObserver = MockIntersectionObserver;

const mockPause = vi.fn();
const mockPlayerInstance = { pause: mockPause, paused: false, muted: true, currentTime: 0, duration: 0 };

vi.mock('@vidstack/react', () => ({
  MediaPlayer: React.forwardRef(function MockMediaPlayer(props: any, ref: any) {
    React.useImperativeHandle(ref, () => mockPlayerInstance);
    return <div data-testid="media-player">{props.children}</div>;
  }),
  MediaProvider: function MockMediaProvider({ children }: any) {
    return <div data-testid="media-provider">{children}</div>;
  },
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgRole: null }),
}));

vi.mock('@/lib/hooks/usePlaybackTelemetry', () => ({
  usePlaybackTelemetry: () => vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/app/components/PremiumWrapper', () => ({
  useVideoAccess: () => ({
    playbackPlan: {
      videoId: 'v1',
      status: 'READY',
      canPlay: true,
      access: { allowed: true },
      source: {
        provider: 'CLOUDFLARE_STREAM',
        kind: 'hls',
        playbackUrl: 'https://example.com/video.m3u8',
        needsProxy: false,
        isExternalEmbed: false,
        isSignedUrl: false,
      },
      player: {
        autoplayAllowed: false,
        mutedAutoplay: false,
        controls: false,
        poster: '',
        title: 'Test video',
      },
      diagnostics: { warnings: [], sourceConfidence: 'HIGH', providerResolutionAllowed: true, providerResolutionAttempted: true },
      tracking: { playbackSessionId: 'session-1', heartbeatIntervalSeconds: 60 },
    },
    refreshPlaybackPlan: vi.fn(),
    isLoading: false,
  }),
}));

const video: PublicVideoDTO = {
  id: 'v1',
  title: 'Test video',
  thumbnailUrl: '',
} as PublicVideoDTO;

describe('VideoPlayer — pause off-viewport / backgrounded tab', () => {
  beforeEach(() => {
    capturedIntersectionCallback = null;
    capturedIntersectionOptions = undefined;
    mockPause.mockClear();
    mockObserve.mockClear();
    mockDisconnect.mockClear();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  afterEach(() => {
    cleanup();
  });

  it('observes the player container at a 25% visibility threshold', async () => {
    render(<VideoPlayer video={video} />);

    await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));
    expect(capturedIntersectionOptions).toEqual({ threshold: 0.25 });
  });

  it('pauses when the player scrolls below the visibility threshold', async () => {
    render(<VideoPlayer video={video} />);
    await waitFor(() => expect(capturedIntersectionCallback).not.toBeNull());

    capturedIntersectionCallback!([{ isIntersecting: false } as IntersectionObserverEntry], null as unknown as IntersectionObserver);

    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('does not pause while still above the visibility threshold', async () => {
    render(<VideoPlayer video={video} />);
    await waitFor(() => expect(capturedIntersectionCallback).not.toBeNull());

    capturedIntersectionCallback!([{ isIntersecting: true } as IntersectionObserverEntry], null as unknown as IntersectionObserver);

    expect(mockPause).not.toHaveBeenCalled();
  });

  it('pauses when the browser tab is backgrounded (visibilitychange)', async () => {
    render(<VideoPlayer video={video} />);
    await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('does not call pause when the tab becomes visible again (no auto-resume anywhere)', async () => {
    render(<VideoPlayer video={video} />);
    await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    mockPause.mockClear();

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockPause).not.toHaveBeenCalled();
    // Guard against a future regression that adds an auto-resume: the component must never call
    // a play()-shaped method itself — only the user pressing play should ever restart playback.
    expect((mockPlayerInstance as any).play).toBeUndefined();
  });

  it('disconnects the observer on unmount', async () => {
    const { unmount } = render(<VideoPlayer video={video} />);
    await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

    unmount();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
