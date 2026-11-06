/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import type { AccessTier, VideoStatus } from '@prisma/client';
import Hero from '@/app/components/Hero';
import type { PublicVideoDTO } from '@/app/types/video';
import { txFor } from "../i18n/mock-language";

vi.mock('@/lib/auth/react', () => ({ useAuth: () => ({ userId: null }) }));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pl',
  useSearchParams: () => new URLSearchParams('v=video-1'),
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: { noDescription: 'Brak opisu', comments: 'Komentarze', videosTab: 'Filmy' } }),
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/app/components/PremiumWrapper', () => ({ default: () => <div>player-stub</div> }));
vi.mock('@/app/components/SubscribeButton', () => ({ default: () => <button type="button">subscribe-stub</button> }));
vi.mock('@/app/components/ShareButton', () => ({ default: () => <button type="button">share-stub</button> }));

const video = {
  id: 'video_1', slug: 'video-1', title: 'Test Video', tier: 'PUBLIC' as AccessTier, status: 'PUBLISHED' as VideoStatus,
  views: 0, likesCount: 0, dislikesCount: 0, isMainFeatured: false,
  creator: { id: 'creator_1', name: 'Paweł Perfect', slug: 'creator', subscribersCount: 5, imageUrl: '/api/avatars/creator_1?v=1' },
} as unknown as PublicVideoDTO;

describe('Hero channel row: creator avatar ring', () => {
  afterEach(cleanup);

  it('the channel avatar under the player has the Creator ring and still names the channel in its alt text', () => {
    render(<Hero video={video} />);
    const frame = screen.getByAltText('Paweł Perfect').parentElement as HTMLElement;
    expect(frame.className).toContain('ring-2 ring-offset-2');
    expect(frame.className).toContain('ring-[var(--chan-blue)]');
  });
});
