/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import VideoPlayer from '@/app/components/VideoPlayer';
import * as PremiumWrapper from '@/app/components/PremiumWrapper';
import { AccessTier, VideoStatus } from '@prisma/client';

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgRole: 'user' }),
}));

// Mock VideoJsPlayer
vi.mock('@/app/components/VideoJsPlayer', () => ({
  default: (props: any) => <div data-testid="videojs-player" data-src={props.src} />
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
  it('renders VideoJsPlayer for custom-player sources', () => {
    const mockPlaybackPlan: any = {
      source: {
        kind: 'hls',
        playbackUrl: 'https://example.com/video.m3u8',
      },
      tracking: {
        playbackSessionId: 's1',
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

    const player = screen.getByTestId('videojs-player');
    expect(player).toBeDefined();
    expect(player.getAttribute('data-src')).toBe('https://example.com/video.m3u8');
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
    expect(iframe.getAttribute('src')).toBe('https://www.youtube.com/embed/123');
  });
});
