/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ChannelHome from '@/app/components/ChannelHome';
import type { PublicVideoDTO } from '@/app/types/video';

const mocks = vi.hoisted(() => ({
  heroProps: [] as Array<{ videoId: string; initialInteraction: unknown }>,
}));

vi.mock('@/app/components/preload/AppPreloadProvider', () => ({
  AppPreloadProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAppPreload: () => ({ warmVideo: vi.fn() }),
}));
vi.mock('@/app/components/preload/PreloadProgressBar', () => ({ PreloadProgressBar: () => null }));
vi.mock('@/components/skeletons', () => ({ CommentLoadingSkeleton: () => null }));
vi.mock('@/app/components/comments/EmbeddedComments', () => ({ default: () => null }));
vi.mock('@/app/components/channel/SidebarPlaylist', () => ({
  SidebarPlaylist: (props: { showSupportBox?: boolean; onVideoSelect?: (id: string) => void }) =>
    props.showSupportBox === false ? null : (
      <button type="button" onClick={() => props.onVideoSelect?.('video_2')}>pick-video-2</button>
    ),
  SidebarSupportBox: () => null,
}));
vi.mock('@/app/components/Hero', () => ({
  default: (props: { video: PublicVideoDTO; initialInteraction?: unknown }) => {
    mocks.heroProps.push({ videoId: props.video.id, initialInteraction: props.initialInteraction });
    return <div data-testid="hero">{props.video.id}</div>;
  },
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pl', t: { comments: 'Komentarze', videosTab: 'Filmy' } }),
}));
vi.mock('@/app/hooks/useClientEnvironment', () => ({ useClientReady: () => true }));

const makeVideo = (id: string, slug: string) =>
  ({ id, slug, title: id, tier: 'PUBLIC', status: 'PUBLISHED', views: 0, likesCount: 0, dislikesCount: 0 }) as unknown as PublicVideoDTO;

const main = makeVideo('video_1', 'first');
const second = makeVideo('video_2', 'second');

describe('ChannelHome shallow video switching', () => {
  beforeEach(() => {
    mocks.heroProps.length = 0;
    window.scrollTo = vi.fn() as never;
    window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('switches the video locally and records it with history.pushState instead of a server navigation', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    render(
      <ChannelHome
        mainVideo={main}
        allVideos={[main, second]}
        userProfile={{ id: 'u', email: '', totalPaid: 0, initialInteraction: { liked: true, disliked: false } }}
      />,
    );
    expect(screen.getByTestId('hero')).toHaveTextContent('video_1');

    fireEvent.click(screen.getByText('pick-video-2'));

    expect(screen.getByTestId('hero')).toHaveTextContent('video_2');
    expect(pushState).toHaveBeenCalledTimes(1);
    const [state, , url] = pushState.mock.calls[0];
    expect(state).toEqual({ polutekVideoId: 'video_2' });
    expect(url).toBe('/?v=second');

    // The server-rendered like state belongs to video_1 only; video_2 gets none,
    // so Hero fetches it instead of showing video_1's like.
    expect(mocks.heroProps.find((p) => p.videoId === 'video_1')?.initialInteraction).toEqual({ liked: true, disliked: false });
    expect(mocks.heroProps.filter((p) => p.videoId === 'video_2').every((p) => p.initialInteraction === undefined)).toBe(true);
  });

  it('restores the video recorded in the history entry on Back/Forward', () => {
    render(<ChannelHome mainVideo={main} allVideos={[main, second]} />);
    fireEvent.click(screen.getByText('pick-video-2'));
    expect(screen.getByTestId('hero')).toHaveTextContent('video_2');

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { polutekVideoId: 'video_1' } }));
    });
    expect(screen.getByTestId('hero')).toHaveTextContent('video_1');
  });
});
