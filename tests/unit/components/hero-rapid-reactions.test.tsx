/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { AccessTier, VideoStatus } from '@prisma/client';
import Hero from '@/app/components/Hero';
import type { PublicVideoDTO } from '@/app/types/video';
import { txFor } from "../i18n/mock-language";

const toast = vi.fn();
const openAuth = vi.fn();

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ userId: 'user_123' as string | null }),
}));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: openAuth, close: vi.fn(), isOpen: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pl',
  useSearchParams: () => new URLSearchParams('v=video-1'),
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pl', tx: txFor('pl'),
    t: { noDescription: 'Brak opisu', comments: 'Komentarze', videosTab: 'Filmy' },
  }),
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/app/components/PremiumWrapper', () => ({ default: () => <div>player-stub</div> }));
vi.mock('@/app/components/SubscribeButton', () => ({ default: () => <button type="button">subscribe-stub</button> }));
vi.mock('@/app/components/ShareButton', () => ({ default: () => <button type="button">share-stub</button> }));

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

type Body = { type: 'LIKE' | 'DISLIKE' | null };
const reply = (body: Body) =>
  new Response(
    JSON.stringify({ liked: body.type === 'LIKE', disliked: body.type === 'DISLIKE', likesCount: body.type === 'LIKE' ? 1 : 0, dislikesCount: 0 }),
    { status: 200 },
  );

describe('Hero video reactions: rapid clicking', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    toast.mockClear();
    openAuth.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('never refuses a click while a request is in flight, and ends in the state the viewer last chose', async () => {
    const resolvers: Array<() => void> = [];
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Body;
      return new Promise<Response>((resolve) => resolvers.push(() => resolve(reply(body))));
    });
    render(<Hero video={video} initialInteraction={{ liked: false, disliked: false }} />);

    // like, unlike, like again, all before the first request returns
    fireEvent.click(screen.getByRole('button', { name: 'Polub film' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij polubienie filmu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Polub film' }));
    expect(screen.getByRole('button', { name: 'Cofnij polubienie filmu' })).toHaveAttribute('aria-pressed', 'true');

    // requests run one after another and carry the target state
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolvers[0]();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    resolvers[1]();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cofnij polubienie filmu' })).toHaveAttribute('aria-pressed', 'true'));
    const sent = fetchMock.mock.calls.map((call) => (JSON.parse(String((call[1] as RequestInit).body)) as Body).type);
    expect(sent[sent.length - 1]).toBe('LIKE');
    expect(toast).not.toHaveBeenCalled();
  });

  it('a failed request that a newer click replaced raises no error', async () => {
    let call = 0;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      call += 1;
      const body = JSON.parse(String(init.body)) as Body;
      return call === 1 ? Promise.resolve(new Response('{}', { status: 400 })) : Promise.resolve(reply(body));
    });
    render(<Hero video={video} initialInteraction={{ liked: false, disliked: false }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Polub film' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij polubienie filmu' }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Polub film' })).toHaveAttribute('aria-pressed', 'false'));
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows the error and restores the confirmed state only when the newest request fails', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
    render(<Hero video={video} initialInteraction={{ liked: false, disliked: false }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Polub film' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Nie udało się zapisać oceny. Spróbuj ponownie.', 'error'));
    expect(screen.getByRole('button', { name: 'Polub film' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('retries once on a server error before giving up', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 })).mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(reply(JSON.parse(String(init.body)) as Body)),
    );
    render(<Hero video={video} initialInteraction={{ liked: false, disliked: false }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Polub film' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cofnij polubienie filmu' })).toHaveAttribute('aria-pressed', 'true'));
    expect(toast).not.toHaveBeenCalled();
  });

  it('a 401 opens the sign-in modal instead of an error toast', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    render(<Hero video={video} initialInteraction={{ liked: false, disliked: false }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Polub film' }));

    await waitFor(() => expect(openAuth).toHaveBeenCalledWith('sign-in'));
    expect(toast).not.toHaveBeenCalled();
  });
});
