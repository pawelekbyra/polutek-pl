/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ChannelHome from '@/app/components/ChannelHome';
import type { PublicVideoDTO } from '@/app/types/video';
import { txFor } from "../i18n/mock-language";

const mocks = vi.hoisted(() => ({ search: '', tipGate: true, passState: 'active' as 'active' | 'none' }));

// Keep the feature flag on and control the server re-check of the viewer's own pass.
vi.mock('@/app/components/channel/tip-gate', () => ({
  get TIP_GATE_ENABLED() {
    return mocks.tipGate;
  },
}));
vi.mock('@/app/components/premium-pass/usePremiumPass', () => ({
  fetchPassStatus: async () => ({ offer: {}, pass: { state: mocks.passState } }),
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock('next/dynamic', () => ({
  // Resolve the dynamically imported SupportModal synchronously in tests.
  default: (loader: () => Promise<unknown>) => {
    const src = loader.toString();
    if (src.includes('SupportModal')) {
      const SupportModalStub = (props: { onClose: () => void }) => (
        <div data-testid="support-modal">
          support-modal-stub
          <button type="button" onClick={props.onClose}>close-support</button>
        </div>
      );
      return SupportModalStub;
    }
    const Empty = () => null;
    return Empty;
  },
}));
vi.mock('@/app/components/preload/AppPreloadProvider', () => ({
  AppPreloadProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAppPreload: () => ({ warmVideo: vi.fn(), selectVideo: vi.fn() }),
}));
vi.mock('@/app/components/preload/PreloadProgressBar', () => ({ PreloadProgressBar: () => null }));
vi.mock('@/components/skeletons', () => ({ CommentLoadingSkeleton: () => null }));
vi.mock('@/app/components/comments/EmbeddedComments', () => ({ default: () => null }));
vi.mock('@/app/components/channel/SidebarPlaylist', () => ({
  SidebarPlaylist: () => null,
}));
vi.mock('@/app/components/Hero', () => ({ default: () => <div>hero-stub</div> }));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: { comments: 'Komentarze', videosTab: 'Filmy' } }),
}));
vi.mock('@/app/hooks/useClientEnvironment', () => ({ useClientReady: () => true }));

const video = { id: 'video_1', slug: 'first', title: 'Video', tier: 'PUBLIC', status: 'PUBLISHED', views: 0 } as unknown as PublicVideoDTO;
const signedIn = { id: 'u', email: '', totalPaid: 0, hasActivePremiumPass: true };

describe('ChannelHome tip gate (SupportModal)', () => {
  beforeEach(() => {
    mocks.search = '';
    mocks.tipGate = true;
    mocks.passState = 'active';
    window.scrollTo = vi.fn() as never;
    window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
  });
  afterEach(() => cleanup());

  it('opens the full-page support modal on polutek:open-support instead of switching tabs, and closes it', async () => {
    render(<ChannelHome mainVideo={video} allVideos={[video]} userProfile={signedIn} />);
    expect(screen.queryByTestId('support-modal')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('polutek:open-support'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('support-modal')).toBeInTheDocument();
    // The comments tab stays active: the gate is a modal, not a sidebar box to scroll to.
    expect(screen.getByTestId('mobile-videos-panel')).toHaveClass('hidden');

    fireEvent.click(screen.getByText('close-support'));
    expect(screen.queryByTestId('support-modal')).toBeNull();
  });

  it('opens the modal on load for a Stripe redirect return so its success screen can render', () => {
    mocks.search = 'success=true&payment_id=pay_1&redirect_status=succeeded';
    render(<ChannelHome mainVideo={video} allVideos={[video]} userProfile={signedIn} />);
    expect(screen.getByTestId('support-modal')).toBeInTheDocument();
  });

  it('opens the modal on load for an external ?support=1 deep link, only for active-pass viewers', () => {
    mocks.search = 'support=1';
    const guest = render(<ChannelHome mainVideo={video} allVideos={[video]} />);
    expect(screen.queryByTestId('support-modal')).toBeNull();
    guest.unmount();

    window.history.replaceState(null, '', '/?v=first&support=1');
    render(<ChannelHome mainVideo={video} allVideos={[video]} userProfile={signedIn} />);
    expect(screen.getByTestId('support-modal')).toBeInTheDocument();
    // Stripped at once, so a refresh doesn't open the gate again; the open video stays.
    expect(window.location.search).toBe('?v=first');
  });

  it('does not open the tip checkout for a signed-in viewer without an active pass', async () => {
    mocks.passState = 'none';
    render(<ChannelHome mainVideo={video} allVideos={[video]} userProfile={{ ...signedIn, hasActivePremiumPass: false }} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('polutek:open-support'));
    });
    expect(screen.queryByTestId('support-modal')).toBeNull();
  });

  it('is unreachable while hidden: no event, no Stripe return and no ?support=1 link opens it', () => {
    mocks.tipGate = false;
    mocks.search = 'support=1';
    render(<ChannelHome mainVideo={video} allVideos={[video]} userProfile={signedIn} />);
    act(() => {
      window.dispatchEvent(new CustomEvent('polutek:open-support'));
    });
    expect(screen.queryByTestId('support-modal')).toBeNull();
  });
});
