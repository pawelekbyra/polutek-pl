/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CommentItem } from '@/app/components/comments/components/CommentItem';
import type { CommentView } from '@/app/components/comments/types';
import type { CommentAuthorBadgeDto } from '@/lib/modules/comments/domain/comment-frontend.dto';

vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));

function commentBy(
  badges: CommentAuthorBadgeDto[],
  imageUrl: string | null = null,
  displayName = 'Jurek',
  username: string | null = null,
): CommentView {
  return {
    id: 'c1',
    videoId: 'v1',
    parentId: null,
    text: 'Hej',
    status: 'VISIBLE',
    author: { id: 'a1', displayName, username, imageUrl, badges },
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
  };
}

const noop = () => {};
const renderItem = (
  comment: CommentView,
  userProfile: { id?: string; imageUrl?: string | null } | null = null,
  isReply = false,
) =>
  render(
    <CommentItem
      comment={comment}
      userProfile={userProfile}
      language="pl"
      t={{}}
      canComment={false}
      onLike={noop}
      onDislike={noop}
      onReply={noop}
      onDelete={noop}
      onPin={noop}
      onEdit={noop}
      onReport={noop}
      isReactionPending={false}
      isReply={isReply}
    />,
  );

const avatarButton = () => screen.getByRole('button', { name: 'Otwórz profil użytkownika Jurek' });
const nameButton = () => screen.getByRole('button', { name: 'Jurek' });
const card = () => screen.getByRole('dialog');

describe('comment author profile card', () => {
  afterEach(() => cleanup());

  it('is closed until the avatar or the name is used, and both are real buttons announcing a dialog', () => {
    renderItem(commentBy([]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(avatarButton()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(nameButton()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(avatarButton().tagName).toBe('BUTTON');
    expect(nameButton().tagName).toBe('BUTTON');
  });

  it('opens on avatar click with the name, a large avatar and the creator badge', async () => {
    renderItem(commentBy(['AUTHOR'], '/api/avatars/a1?v=1'));
    fireEvent.click(avatarButton());
    const dialog = await waitFor(card);
    // The title carries the name; the large avatar is the one inside the card (160 px).
    expect(dialog).toHaveAccessibleName('Jurek');
    const img = dialog.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('Jurek');
    expect(decodeURIComponent(img.getAttribute('src') || '')).toContain('/api/avatars/a1?v=1');
    expect((img.parentElement as HTMLElement).style.width).toBe('160px');
    expect(dialog).toHaveTextContent('Twórca');
  });

  it('opens on name click too, and shows the @username only when it differs from the name', async () => {
    renderItem(commentBy([], null, 'Jurek Kowalski', 'jurek'));
    fireEvent.click(screen.getByRole('button', { name: 'Jurek Kowalski' }));
    const dialog = await waitFor(card);
    expect(dialog).toHaveTextContent('Jurek Kowalski');
    expect(dialog).toHaveTextContent('@jurek');
  });

  it('does not repeat the handle when it equals the display name', async () => {
    renderItem(commentBy([], null, 'jurek', 'jurek'));
    fireEvent.click(screen.getByRole('button', { name: 'jurek' }));
    const dialog = await waitFor(card);
    expect(dialog).not.toHaveTextContent('@jurek');
  });

  it('works for replies as well', async () => {
    renderItem(commentBy([]), null, true);
    fireEvent.click(nameButton());
    expect(await waitFor(card)).toHaveAccessibleName('Jurek');
  });

  it('closes on Escape', async () => {
    renderItem(commentBy([]));
    fireEvent.click(nameButton());
    const dialog = await waitFor(card);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes with the close button', async () => {
    renderItem(commentBy([]));
    fireEvent.click(avatarButton());
    await waitFor(card);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('never shows anything private: no e-mail, only what the comment already carries', async () => {
    renderItem(commentBy(['ADMIN'], null, 'Jurek', 'jurek_k'));
    fireEvent.click(nameButton());
    const dialog = await waitFor(card);
    expect(dialog.textContent).not.toMatch(/@[\w.-]+\.[a-z]{2,}/i);
    expect(dialog).not.toHaveTextContent('Admin');
  });

  it('does not open for a deleted author (neutral name, no avatar)', () => {
    const deleted: CommentView = {
      ...commentBy([]),
      author: { id: 'a1', displayName: 'Usunięty Użytkownik', username: null, imageUrl: null, badges: [] },
    };
    renderItem(deleted);
    expect(screen.getByText('Usunięty Użytkownik')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /profil/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usunięty Użytkownik' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open when the comment has no author at all', () => {
    renderItem({ ...commentBy([]), author: null });
    expect(screen.queryByRole('button', { name: /profil/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("uses the viewer's live avatar in the card for their own comment, others keep theirs", async () => {
    const old = '/api/avatars/a1?v=1';
    const fresh = '/api/avatars/a1?v=2';
    renderItem(commentBy([], old), { id: 'a1', imageUrl: fresh });
    fireEvent.click(avatarButton());
    let dialog = await waitFor(card);
    expect((dialog.querySelector('img') as HTMLImageElement).getAttribute('src')).toContain('v=2');
    cleanup();

    renderItem(commentBy([], old), { id: 'someone-else', imageUrl: fresh });
    fireEvent.click(avatarButton());
    dialog = await waitFor(card);
    expect((dialog.querySelector('img') as HTMLImageElement).getAttribute('src')).toContain('v=1');
  });
});
