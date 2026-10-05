/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import type { AccessTier, VideoStatus } from '@prisma/client';
import Hero from '@/app/components/Hero';
import { toProgressPercent } from '@/app/components/FundraisingProgressBar';
import type { PublicVideoDTO } from '@/app/types/video';
import { txFor } from "../i18n/mock-language";

vi.mock('@/lib/auth/react', () => ({ useAuth: () => ({ userId: null }) }));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pl',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: { noDescription: 'Brak opisu' } }),
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('@/app/components/PremiumWrapper', () => ({ default: () => <div>player-stub</div> }));
vi.mock('@/app/components/SubscribeButton', () => ({ default: () => <button type="button">subscribe-stub</button> }));
vi.mock('@/app/components/ShareButton', () => ({ default: () => <button type="button">share-stub</button> }));

const baseVideo = {
  id: 'video_1',
  slug: 'video-1',
  title: 'ZBIERAM KASĘ NA MÓJ SEKRETNY PROJEKT',
  tier: 'PUBLIC' as AccessTier,
  status: 'PUBLISHED' as VideoStatus,
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  isMainFeatured: false,
  creator: { id: 'creator_1', name: 'Creator', slug: 'creator', subscribersCount: 0 },
} as unknown as PublicVideoDTO;

afterEach(() => cleanup());

describe('Hero fundraising bar', () => {
  it('renders an amount-free progressbar under the title when the video has progress', () => {
    render(<Hero video={{ ...baseVideo, fundraisingProgress: 0.37 }} />);
    const bar = screen.getByRole('progressbar', { name: 'Postęp zbiórki' });
    expect(bar).toHaveAttribute('aria-valuenow', '37');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    // No visible numbers or currency anywhere in the bar.
    expect(bar.textContent).toBe('');
    // Sits right after the title.
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.nextElementSibling).toBe(bar);
  });

  it('renders an empty bar for a goal with nothing raised yet', () => {
    render(<Hero video={{ ...baseVideo, fundraisingProgress: 0 }} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders no bar without a goal', () => {
    render(<Hero video={baseVideo} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    cleanup();
    render(<Hero video={{ ...baseVideo, fundraisingProgress: null }} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('clamps the percent to 0..100', () => {
    expect(toProgressPercent(1.7)).toBe(100);
    expect(toProgressPercent(-0.2)).toBe(0);
    expect(toProgressPercent(Number.NaN)).toBe(0);
    expect(toProgressPercent(0.555)).toBe(56);
  });
});
