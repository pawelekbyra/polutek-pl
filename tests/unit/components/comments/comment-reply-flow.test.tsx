/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import EmbeddedComments from '@/app/components/comments/EmbeddedComments';
import type { CommentView } from '@/app/components/comments/types';
import { txFor } from "../../i18n/mock-language";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ isSignedIn: true, userId: 'viewer-1' }),
  useUser: () => ({ user: { fullName: 'Viewer', imageUrl: null, username: null } }),
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pl', tx: txFor('pl'),
    t: { cancel: 'Anuluj', reply: 'Odpowiedz', comment: 'Skomentuj', addReply: 'Dodaj odpowiedź', addComment: 'Dodaj komentarz', justNow: 'teraz' },
  }),
}));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));

function makeComment(id: string, videoId = 'video-1'): CommentView {
  return {
    id,
    videoId,
    parentId: null,
    text: `Text ${id}`,
    status: 'VISIBLE',
    author: { id: `author-${id}`, displayName: `Author ${id}`, username: null, imageUrl: null, badges: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 0,
    repliesCount: 0,
    viewerReaction: null,
    viewerCanEdit: false,
    viewerCanDelete: false,
    viewerCanReport: true,
    viewerCanModerate: false,
    viewerCanPin: false,
    isPinned: false,
    isHearted: false,
    repliesPreview: [],
  };
}

describe('replying to a comment', () => {
  let posts: Array<{ url: string; body: any }>;

  beforeEach(() => {
    posts = [];
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        return new Promise(() => {}); // keep the request in flight: we look at the optimistic state
      }
      const videoId = new URL(url).searchParams.get('videoId') ?? 'video-1';
      return Promise.resolve({
        ok: true,
        json: async () => ({
          comments: [makeComment(videoId === 'video-1' ? 'root' : 'other-root', videoId)],
          nextCursor: null,
          totalCount: 1,
          viewer: { canComment: true },
        }),
      } as Response);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderFor = (videoId: string, client = new QueryClient()) => (
    <QueryClientProvider client={client}>
      <EmbeddedComments videoId={videoId} userProfile={{ id: 'viewer-1', name: 'Viewer' }} />
    </QueryClientProvider>
  );

  it('focuses the reply field, shows the reply at once and keeps the top-level count', async () => {
    render(renderFor('video-1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Odpowiedz' }));

    const field = await screen.findByLabelText('Dodaj odpowiedź');
    await waitFor(() => expect(field).toHaveFocus());

    fireEvent.change(field, { target: { value: 'Moja odpowiedź' } });
    fireEvent.submit(field.closest('form')!);

    expect(await screen.findByText('Moja odpowiedź')).toBeInTheDocument();
    expect(posts[0]).toEqual({ url: '/api/videos/video-1/comments', body: { text: 'Moja odpowiedź', parentId: 'root' } });
    // "1 komentarz" counts top-level comments; a reply does not bump it.
    // (waitFor: the count animates from 0 to 1 when the list loads.)
    await waitFor(() => expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/^1\s*komentarz$/));
  });

  it('drops the reply target when the viewer switches to another video', async () => {
    const client = new QueryClient();
    const { rerender } = render(renderFor('video-1', client));
    fireEvent.click(await screen.findByRole('button', { name: 'Odpowiedz' }));
    expect(await screen.findByText(/Odpowiadasz/)).toBeInTheDocument();

    rerender(renderFor('video-2', client));
    await screen.findByText('Text other-root');
    expect(screen.queryByText(/Odpowiadasz/)).not.toBeInTheDocument();
  });
});
