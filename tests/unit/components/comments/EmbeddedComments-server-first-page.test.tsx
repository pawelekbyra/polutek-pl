/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import EmbeddedComments from '@/app/components/comments/EmbeddedComments';
import { RenderClockProvider } from '@/app/components/RenderClock';
import type { CommentView } from '@/app/components/comments/types';
import { txFor } from "../../i18n/mock-language";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ isSignedIn: false, userId: null }),
  useUser: () => ({ user: null }),
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: { justNow: 'Przed chwilą', reply: 'Odpowiedz' } }),
}));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));

const RENDERED_AT = '2026-10-04T12:00:00.000Z';

function comment(id: string, videoId: string): CommentView {
  return {
    id, videoId, parentId: null, text: `Text ${id}`, status: 'VISIBLE',
    author: { id: `a-${id}`, displayName: `Author ${id}`, username: null, imageUrl: null, badges: [] },
    createdAt: '2026-10-04T09:00:00.000Z', updatedAt: '2026-10-04T09:00:00.000Z',
    editedAt: null, deletedAt: null, deletedReason: null, pinnedAt: null,
    likesCount: 0, repliesCount: 0, reportsCount: 0, viewerReaction: null,
    viewerCanEdit: false, viewerCanDelete: false, viewerCanReport: false, viewerCanModerate: false, viewerCanPin: false,
    isPinned: false, isHearted: false, repliesPreview: [],
  };
}

const firstPage = {
  videoId: 'video-1',
  sortBy: 'newest' as const,
  page: { success: true, comments: [comment('c1', 'video-1')], totalCount: 1, nextCursor: null, viewer: { canComment: false } },
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Tree({ videoId }: { videoId: string }) {
  return (
    <RenderClockProvider renderedAt={RENDERED_AT}>
      <EmbeddedComments videoId={videoId} userProfile={null} initialComments={firstPage} />
    </RenderClockProvider>
  );
}

describe('comments rendered with the page', () => {
  it('are in the server HTML with their age, without the loading skeleton', () => {
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <Tree videoId="video-1" />
      </QueryClientProvider>,
    );
    expect(html).toContain('Text c1');
    expect(html).toContain('3 godziny temu');
    expect(html).not.toContain('Rozgrzewamy dyskusję');
  });

  it('switching video keeps the previous list (dimmed) instead of a skeleton, and asks for the new one', async () => {
    // Same defaults as the app's QueryClient (app/components/Providers.tsx): data stays fresh 2 min.
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 120_000 } } });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <Tree videoId="video-1" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Text c1')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([u]) => String(u))).toEqual([]);

    rerender(
      <QueryClientProvider client={client}>
        <Tree videoId="video-2" />
      </QueryClientProvider>,
    );
    await act(async () => {});
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('videoId=video-2'))).toBe(true);
    expect(screen.queryByText('Rozgrzewamy dyskusję…')).toBeNull();
    const kept = screen.getByText('Text c1');
    expect(kept.closest('[aria-busy="true"]')).not.toBeNull();
  });
});
