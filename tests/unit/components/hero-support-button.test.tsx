/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import type { AccessTier, VideoStatus } from '@prisma/client';
import Hero from '@/app/components/Hero';
import type { PublicVideoDTO } from '@/app/types/video';

const mockUseAuth = vi.fn(() => ({ userId: 'user_123' as string | null }));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockOpenAuthModal = vi.fn();
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: mockOpenAuthModal, close: vi.fn(), isOpen: false }),
}));

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  usePathname: () => '/pl',
  useSearchParams: () => new URLSearchParams('v=video-1'),
}));

vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pl',
    t: { noDescription: 'Brak opisu', comments: 'Komentarze', videosTab: 'Filmy' },
  }),
}));

vi.mock('@/app/hooks/useToast', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/actions/interactions', () => ({
  toggleVideoLike: vi.fn(),
  toggleVideoDislike: vi.fn(),
}));

vi.mock('@/app/components/PremiumWrapper', () => ({
  default: () => <div>player-stub</div>,
}));

vi.mock('@/app/components/SubscribeButton', () => ({
  default: () => <button type="button">subscribe-stub</button>,
}));

vi.mock('@/app/components/ShareButton', () => ({
  default: () => <button type="button">share-stub</button>,
}));

const video = {
  id: 'video_1',
  slug: 'video-1',
  title: 'Test Video',
  tier: 'PUBLIC' as AccessTier,
  status: 'PUBLISHED' as VideoStatus,
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  isMainFeatured: false,
  creator: { id: 'creator_1', name: 'Creator', slug: 'creator', subscribersCount: 0 },
} as unknown as PublicVideoDTO;

describe('Hero "Wspieraj" button', () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('dispatches polutek:open-support for a signed-in click without any router navigation', () => {
    render(<Hero video={video} />);

    const button = screen.getByRole('button', { name: /wspieraj/i });
    fireEvent.click(button);

    const dispatchedEvents = dispatchSpy.mock.calls
      .map(([event]: [Event]): Event => event)
      .filter((event: Event) => event.type === 'polutek:open-support');
    expect(dispatchedEvents).toHaveLength(1);

    // A router navigation re-rendered the whole page on the server and flashed the
    // route's loading screen; the event alone reveals the donation box.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens the sign-in modal instead, without dispatching anything, for a signed-out click', () => {
    // mockReturnValue (not -Once): Hero re-renders several times from its own mount
    // effects (setMounted, setLocalViewsCount, etc.), each calling useAuth() again —
    // a one-shot override would only cover the first render.
    mockUseAuth.mockReturnValue({ userId: null });
    render(<Hero video={video} />);

    const button = screen.getByRole('button', { name: /wspieraj/i });
    fireEvent.click(button);

    expect(mockOpenAuthModal).toHaveBeenCalledWith('sign-in');
    const dispatchedEvents = dispatchSpy.mock.calls
      .map(([event]: [Event]): Event => event)
      .filter((event: Event) => event.type === 'polutek:open-support');
    expect(dispatchedEvents).toHaveLength(0);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
