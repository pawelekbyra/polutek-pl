/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import EmbeddedComments from '@/app/components/comments/EmbeddedComments';
import type { CommentView } from '@/app/components/comments/types';

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isSignedIn: false, userId: null }),
  useUser: () => ({ user: null }),
}));

vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pl',
    t: { cancel: 'Anuluj', deleteComment: 'Usunąć?', justNow: 'Przed chwilą', reply: 'Odpowiedz' },
  }),
}));

vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));

vi.mock('@/app/hooks/useToast', () => ({
  useToast: () => vi.fn(),
}));

function makeComment(id: string): CommentView {
  return {
    id,
    videoId: 'video-1',
    parentId: null,
    text: `Comment ${id}`,
    imageUrl: null,
    status: 'VISIBLE',
    author: {
      id: `author-${id}`,
      displayName: `Author ${id}`,
      username: null,
      imageUrl: null,
      badges: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 0,
    repliesCount: 0,
    reportsCount: 0,
    viewerReaction: null,
    viewerCanEdit: false,
    viewerCanDelete: false,
    viewerCanReport: false,
    viewerCanModerate: false,
    viewerCanPin: false,
    isPinned: false,
    repliesPreview: [],
  };
}

function renderEmbeddedComments() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <EmbeddedComments
        videoId="video-1"
        userProfile={{ id: 'viewer-1', name: 'Viewer' }}
      />
    </QueryClientProvider>,
  );
}

describe('EmbeddedComments reaction pending isolation', () => {
  let resolveReaction: (() => void) | undefined;

  beforeEach(() => {
    resolveReaction = undefined;
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/comments/') && url.includes('/reaction')) {
        return new Promise((resolve) => {
          resolveReaction = () =>
            resolve({
              ok: true,
              json: async () => ({ success: true }),
            } as Response);
        });
      }

      if (url.includes('/api/comments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            comments: [makeComment('a'), makeComment('b')],
            nextCursor: null,
            totalCount: 2,
            viewer: { canComment: true },
          }),
        } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('only disables the reaction buttons of the comment being liked, not every comment in the list', async () => {
    renderEmbeddedComments();

    await waitFor(() => {
      expect(screen.getByText('Comment a')).toBeInTheDocument();
      expect(screen.getByText('Comment b')).toBeInTheDocument();
    });

    const likeButtons = screen.getAllByRole('button', { name: 'Polub komentarz' });
    expect(likeButtons).toHaveLength(2);
    const [likeA, likeB] = likeButtons;

    likeA.click();

    await waitFor(() => {
      expect(likeA).toBeDisabled();
    });

    // The second comment's like button must stay enabled — a shared/global
    // pending flag would have disabled it too.
    expect(likeB).not.toBeDisabled();

    resolveReaction?.();

    await waitFor(() => {
      expect(likeA).not.toBeDisabled();
    });
  });
});
