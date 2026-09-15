/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import type { AccessTier, VideoStatus } from '@prisma/client';
import Hero from '@/app/components/Hero';
import type { PublicVideoDTO } from '@/app/types/video';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'user_123' as string | null }),
}));

vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pl',
  useSearchParams: () => new URLSearchParams('v=video-1'),
}));

const mockLanguage = { language: 'pl' as 'pl' | 'en' };
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: mockLanguage.language,
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

describe('Hero like/dislike buttons accessible state', () => {
  afterEach(() => {
    cleanup();
    mockLanguage.language = 'pl';
  });

  it('marks neither button pressed and uses the neutral labels when nothing is liked/disliked', () => {
    render(<Hero video={video} initialInteraction={{ liked: false, disliked: false }} />);

    const likeButton = screen.getByRole('button', { name: 'Polub film' });
    const dislikeButton = screen.getByRole('button', { name: 'Nie lubię filmu' });

    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
    expect(dislikeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects an already-liked video with aria-pressed and an undo label', () => {
    render(<Hero video={video} initialInteraction={{ liked: true, disliked: false }} />);

    const likeButton = screen.getByRole('button', { name: 'Cofnij polubienie filmu' });
    expect(likeButton).toHaveAttribute('aria-pressed', 'true');

    const dislikeButton = screen.getByRole('button', { name: 'Nie lubię filmu' });
    expect(dislikeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects an already-disliked video with aria-pressed and an undo label', () => {
    render(<Hero video={video} initialInteraction={{ liked: false, disliked: true }} />);

    const dislikeButton = screen.getByRole('button', { name: 'Cofnij reakcję nie lubię filmu' });
    expect(dislikeButton).toHaveAttribute('aria-pressed', 'true');

    const likeButton = screen.getByRole('button', { name: 'Polub film' });
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('uses English labels when the language is English', () => {
    mockLanguage.language = 'en';
    render(<Hero video={video} initialInteraction={{ liked: true, disliked: false }} />);

    const likeButton = screen.getByRole('button', { name: 'Remove like from video' });
    expect(likeButton).toHaveAttribute('aria-pressed', 'true');
  });
});
