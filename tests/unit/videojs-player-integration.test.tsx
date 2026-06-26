/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import VideoPlayer from '@/app/components/VideoPlayer';
import * as PremiumWrapper from '@/app/components/PremiumWrapper';
import { AccessTier, VideoStatus } from '@prisma/client';

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as any;

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgRole: 'user' }),
}));

// Mock VideoJsPlayer to capture callbacks
let capturedCallbacks: any = {};
vi.mock('@/app/components/VideoJsPlayer', () => ({
  default: (props: any) => {
    capturedCallbacks = props;
    return <div data-testid="videojs-player" data-src={props.src} />;
  }
}));

const mockVideo: any = {
  id: 'v1',
  title: 'Test Video',
  slug: 'test-video',
  status: VideoStatus.PUBLISHED,
  tier: AccessTier.PUBLIC,
  thumbnailUrl: '/test.jpg',
  textTracks: [],
};

describe('VideoPlayer Video.js Integration', () => {
  it('renders VideoJsPlayer for custom-player sources and feeds events to tracking', async () => {
    const mockPlaybackPlan: any = {
      source: {
        kind: 'hls',
        playbackUrl: 'https://example.com/video.m3u8',
      },
      tracking: {
        playbackSessionId: 's1',
        heartbeatIntervalSeconds: 15
      },
      player: {
        title: 'Custom Title',
      },
      hasAccess: true,
      effectiveTier: AccessTier.PUBLIC
    };

    vi.spyOn(PremiumWrapper, 'useVideoAccess').mockReturnValue({
      playbackPlan: mockPlaybackPlan,
      refreshPlaybackPlan: vi.fn() as any,
      isLoading: false,
      hasAccess: true,
      effectiveTier: AccessTier.PUBLIC
    });

    render(<VideoPlayer video={mockVideo} />);

    expect(screen.getByTestId('videojs-player')).toBeDefined();

    // Simulate playback events through the adapter's callbacks
    await act(async () => {
      capturedCallbacks.onPlay();
    });

    expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/videos/v1/playback-event'),
        expect.objectContaining({
            body: expect.stringContaining('"type":"PLAY_STARTED"')
        })
    );

    // Simulate time update and verify ref-based tracking
    await act(async () => {
      capturedCallbacks.onTimeUpdate(10, 100);
    });

    await act(async () => {
      capturedCallbacks.onPause();
    });

    expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/videos/v1/playback-event'),
        expect.objectContaining({
            body: expect.stringContaining('"type":"PLAY_PAUSED"')
        })
    );

    // Check if position was included (10s = 10000ms)
    expect(global.fetch).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
            body: expect.stringContaining('"positionMs":10000')
        })
    );
  });

  it('renders iframe for embed sources', () => {
    const mockPlaybackPlan: any = {
      source: {
        kind: 'youtube',
        embedUrl: 'https://www.youtube.com/embed/123',
      },
      tracking: {
        playbackSessionId: 's1',
      },
      hasAccess: true,
      effectiveTier: AccessTier.PUBLIC
    };

    vi.spyOn(PremiumWrapper, 'useVideoAccess').mockReturnValue({
      playbackPlan: mockPlaybackPlan,
      refreshPlaybackPlan: vi.fn() as any,
      isLoading: false,
      hasAccess: true,
      effectiveTier: AccessTier.PUBLIC
    });

    render(<VideoPlayer video={mockVideo} />);

    const iframe = screen.getByTitle('Test Video');
    expect(iframe).toBeDefined();
    expect(iframe.tagName).toBe('IFRAME');
  });
});
