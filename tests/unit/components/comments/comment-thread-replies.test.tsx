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

// A guest: replies are public reading, like the comments themselves.
vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ isSignedIn: false, userId: null }),
  useUser: () => ({ user: null }),
}));
vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: { cancel: 'Anuluj', reply: 'Odpowiedz', justNow: 'teraz' } }),
}));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));

function makeComment(id: string, overrides: Partial<CommentView> = {}): CommentView {
  return {
    id,
    videoId: 'video-1',
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
    viewerCanReport: false,
    viewerCanModerate: false,
    viewerCanPin: false,
    isPinned: false,
    isHearted: false,
    repliesPreview: [],
    ...overrides,
  };
}

const reply = (n: number) => makeComment(`r${n}`, { parentId: 'root' });
const json = (body: unknown) => Promise.resolve({ ok: true, json: async () => body } as Response);

describe('comment threads show every reply', () => {
  let repliesRequests: string[];

  beforeEach(() => {
    repliesRequests = [];
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/replies')) {
        repliesRequests.push(url);
        // 25 replies in total: the first page has 20, the second the last 5.
        return url.includes('cursor=r20')
          ? json({ success: true, replies: [21, 22, 23, 24, 25].map(reply), nextCursor: null })
          : json({ success: true, replies: Array.from({ length: 20 }, (_, i) => reply(i + 1)), nextCursor: 'r20' });
      }
      return json({
        comments: [
          makeComment('root', { repliesCount: 25, repliesPreview: [reply(1), reply(2), reply(3)] }),
        ],
        nextCursor: null,
        totalCount: 1,
        viewer: { canComment: false },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('starts with the preview and loads the rest through the public replies endpoint', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EmbeddedComments videoId="video-1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Text r3')).toBeInTheDocument();
    expect(screen.queryByText('Text r4')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż jeszcze 22 odpowiedzi' }));
    expect(await screen.findByText('Text r20')).toBeInTheDocument();
    expect(repliesRequests[0]).toMatch(/\/api\/comments\/root\/replies\?limit=20$/);

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż jeszcze 5 odpowiedzi' }));
    expect(await screen.findByText('Text r25')).toBeInTheDocument();
    expect(repliesRequests[1]).toContain('cursor=r20');

    // Everything is loaded: no button left, and no reply is shown twice.
    await waitFor(() => expect(screen.queryByRole('button', { name: /Pokaż jeszcze/ })).not.toBeInTheDocument());
    expect(screen.getAllByText('Text r1')).toHaveLength(1);
  });

  it('shows no "more replies" button when the preview already holds the whole thread', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      json({
        comments: [makeComment('root', { repliesCount: 2, repliesPreview: [reply(1), reply(2)] })],
        nextCursor: null,
        totalCount: 1,
        viewer: { canComment: false },
      }),
    ) as unknown as typeof fetch;

    render(
      <QueryClientProvider client={new QueryClient()}>
        <EmbeddedComments videoId="video-1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Text r2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pokaż jeszcze/ })).not.toBeInTheDocument();
  });
});
