/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';
import type { AccessTier, VideoStatus } from '@prisma/client';
import ChannelHome from '@/app/components/ChannelHome';
import type { PublicVideoDTO } from '@/app/types/video';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
// This file covers the sidebar tip-gate handoff, i.e. the non-modal path of the
// TEMP_SUPPORT_AS_MODAL experiment (the modal path is covered in channel-home-support-modal).
vi.mock('@/lib/temp-support-modal', () => ({ TEMP_SUPPORT_AS_MODAL: false }));
vi.mock('@/app/components/preload/AppPreloadProvider', () => ({
  AppPreloadProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAppPreload: () => ({ warmVideo: vi.fn() }),
}));

vi.mock('@/app/components/preload/PreloadProgressBar', () => ({
  PreloadProgressBar: () => null,
}));

vi.mock('@/components/skeletons', () => ({
  CommentLoadingSkeleton: () => <div>loading-comments-skeleton</div>,
}));

vi.mock('@/app/components/comments/EmbeddedComments', () => ({
  default: () => <div>comments-stub</div>,
}));

// The mobile "videos" tab panel is now always mounted (only hidden via a CSS class
// when inactive — see ChannelHome.tsx), so #donations should always exist once
// signed in, regardless of which tab is showing. Distinguishes the two
// SidebarPlaylist call sites in ChannelHome.tsx: the always-mounted mobile "videos"
// tab panel (showSupportBox defaults true, renders #donations) vs. the always-rendered
// desktop aside (explicit showSupportBox={false}, renders nothing) — the desktop
// aside's OWN separate #donations comes from SidebarSupportBox below, matching real
// production markup where BOTH copies exist in the DOM simultaneously (one hidden via
// CSS depending on viewport) with the same id.
vi.mock('@/app/components/channel/SidebarPlaylist', () => ({
  SidebarPlaylist: (props: { showSupportBox?: boolean }) =>
    props.showSupportBox === false ? null : <div id="donations" data-variant="mobile">donation-box-stub-mobile</div>,
  SidebarSupportBox: () => <div id="donations" data-variant="desktop">donation-box-stub-desktop</div>,
}));

vi.mock('@/app/components/Hero', () => ({
  default: () => <div>hero-stub</div>,
}));

vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pl',
    t: { comments: 'Komentarze', videosTab: 'Filmy' },
  }),
}));

vi.mock('@/app/hooks/useClientEnvironment', () => ({
  useClientReady: () => true,
}));

// jsdom never computes real layout, so offsetParent is always null by default —
// stub it per element to simulate which of the two #donations copies is actually
// visible (offsetParent is null for display:none elements and their descendants).
function stubOffsetParent(el: Element, visible: boolean) {
  Object.defineProperty(el, 'offsetParent', {
    configurable: true,
    get: () => (visible ? document.body : null),
  });
}

function mockMatchMedia({ isMobile, reducedMotion }: { isMobile: boolean; reducedMotion: boolean }) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    let matches = false;
    if (query.includes('min-width: 1024px')) matches = !isMobile;
    if (query.includes('prefers-reduced-motion')) matches = reducedMotion;
    return {
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  });
}

const mainVideo = {
  id: 'video_1',
  slug: 'video-1',
  title: 'Test Video',
  tier: 'PUBLIC' as AccessTier,
  status: 'PUBLISHED' as VideoStatus,
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
} as unknown as PublicVideoDTO;

describe('ChannelHome mobile "Wspieraj" tab handoff', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('reveals the mobile "videos" tab panel and scrolls to the mobile #donations copy, from the comments tab', () => {
    mockMatchMedia({ isMobile: true, reducedMotion: false });
    vi.useFakeTimers();

    const { getByTestId, container } = render(
      <ChannelHome mainVideo={mainVideo} allVideos={[mainVideo]} userProfile={null} />,
    );

    // Simulate the real CSS: at mobile widths the mobile copy is the one actually
    // laid out; the desktop aside is "hidden lg:flex", so its copy is not.
    const mobileEl = container.querySelector('[data-variant="mobile"]')!;
    const desktopEl = container.querySelector('[data-variant="desktop"]')!;
    stubOffsetParent(mobileEl, true);
    stubOffsetParent(desktopEl, false);

    // #donations always exists (the panel is always mounted), but starts hidden
    // since the initial tab is "comments".
    const panel = getByTestId('mobile-videos-panel');
    const classTokens = () => panel.className.split(/\s+/);
    expect(classTokens()).toContain('hidden');

    act(() => {
      window.dispatchEvent(new CustomEvent('polutek:open-support'));
    });

    // The tab switch is a synchronous class toggle — no mount to wait for.
    // (Checking the exact "hidden" token, not a substring — "lg:hidden" is
    // always present and would otherwise give a false negative.)
    expect(classTokens()).not.toContain('hidden');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect((Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.instances[0]).toBe(mobileEl);
  });

  it('scrolls to the desktop #donations copy on desktop, ignoring the hidden mobile one', () => {
    // Regression test: both #donations copies exist in the DOM at once (the mobile
    // "videos" panel is always mounted). document.getElementById always returns the
    // FIRST match in DOM order — the mobile copy, which is CSS-hidden at lg: and up —
    // so on desktop the scroll used to silently target a display:none element and do
    // nothing. getVisibleDonationsElement() must pick the desktop copy instead.
    mockMatchMedia({ isMobile: false, reducedMotion: false });
    vi.useFakeTimers();

    const { getByTestId, container } = render(
      <ChannelHome mainVideo={mainVideo} allVideos={[mainVideo]} userProfile={null} />,
    );

    const mobileEl = container.querySelector('[data-variant="mobile"]')!;
    const desktopEl = container.querySelector('[data-variant="desktop"]')!;
    stubOffsetParent(mobileEl, false);
    stubOffsetParent(desktopEl, true);

    const panel = getByTestId('mobile-videos-panel');
    const initialClassName = panel.className;

    act(() => {
      window.dispatchEvent(new CustomEvent('polutek:open-support'));
    });

    // Desktop never touches the mobile tab state.
    expect(panel.className).toBe(initialClassName);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect((Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.instances[0]).toBe(desktopEl);
  });
});
