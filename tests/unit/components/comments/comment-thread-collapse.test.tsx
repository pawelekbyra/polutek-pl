/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import EmbeddedComments from '@/app/components/comments/EmbeddedComments';
import { requestCommentDeepLink, clearCommentDeepLink } from '@/app/components/comments/deep-link';
import { countedNoun } from '@/lib/i18n/plurals';
import type { CommentView } from '@/app/components/comments/types';
import { txFor } from '../../i18n/mock-language';

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

function mockThread(count: number) {
  const replies = Array.from({ length: count }, (_, i) => reply(i + 1));
  const root = makeComment('root', { repliesCount: count, repliesPreview: replies });
  global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/context')) return json({ comment: replies[0], parentComment: root, videoId: 'video-1' });
    return json({ comments: [root], nextCursor: null, totalCount: 1, viewer: { canComment: false } });
  }) as unknown as typeof fetch;
}

const renderComments = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmbeddedComments videoId="video-1" />
    </QueryClientProvider>,
  );

describe('collapsible replies', () => {
  beforeEach(() => {
    clearCommentDeepLink();
    // jsdom has neither; a followed link scrolls to its comment.
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    clearCommentDeepLink();
    vi.clearAllMocks();
  });

  it('starts collapsed and toggles with an accessible button', async () => {
    mockThread(2);
    renderComments();

    const show = await screen.findByRole('button', { name: 'Pokaż 2 odpowiedzi' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    const panelId = show.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).not.toBeNull();
    expect(screen.queryByText('Text r1')).not.toBeInTheDocument();

    fireEvent.click(show);
    expect(await screen.findByText('Text r1')).toBeInTheDocument();
    const hide = screen.getByRole('button', { name: 'Ukryj odpowiedzi' });
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    expect(hide).toHaveAttribute('aria-controls', panelId);

    fireEvent.click(hide);
    expect(screen.getByRole('button', { name: 'Pokaż 2 odpowiedzi' })).toHaveAttribute('aria-expanded', 'false');
    // Closed content is inert (no focus, no assistive tech) while it animates shut.
    expect(document.getElementById(panelId!)).toHaveAttribute('inert');
  });

  it('opens by itself when the address points at one of the replies', async () => {
    mockThread(2);
    requestCommentDeepLink('r1');
    renderComments();

    expect(await screen.findByText('Text r1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ukryj odpowiedzi' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses the language plural forms for the count', () => {
    expect(countedNoun('pl', 'replies', 1)).toBe('odpowiedź');
    expect(countedNoun('pl', 'replies', 2)).toBe('odpowiedzi');
    expect(countedNoun('pl', 'replies', 4)).toBe('odpowiedzi');
    expect(countedNoun('pl', 'replies', 5)).toBe('odpowiedzi');
    expect(countedNoun('en', 'replies', 1)).toBe('reply');
    expect(countedNoun('en', 'replies', 3)).toBe('replies');
    expect(countedNoun('zh', 'replies', 3)).toBe('条回复');
  });

  it('says "1 odpowiedź" for a single reply', async () => {
    mockThread(1);
    renderComments();
    expect(await screen.findByRole('button', { name: 'Pokaż 1 odpowiedź' })).toBeInTheDocument();
  });
});
