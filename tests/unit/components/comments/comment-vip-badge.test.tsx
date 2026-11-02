/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import React from 'react';
import { CommentItem } from '@/app/components/comments/components/CommentItem';
import { AuthorBadge } from '@/app/components/comments/components/AuthorBadge';
import type { CommentView } from '@/app/components/comments/types';
import type { CommentAuthorBadgeDto } from '@/lib/modules/comments/domain/comment-frontend.dto';

vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));

function commentBy(badges: CommentAuthorBadgeDto[], name = 'Jurek'): CommentView {
  return {
    id: 'c1',
    videoId: 'v1',
    parentId: null,
    text: 'Hej',
    status: 'VISIBLE',
    author: { id: 'a1', displayName: name, username: null, imageUrl: null, badges },
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
const renderItem = (comment: CommentView, language: 'pl' | 'en' = 'pl', isReply = false) =>
  render(
    <CommentItem
      comment={comment}
      userProfile={null}
      language={language}
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

describe('comment badges under the avatar', () => {
  afterEach(() => cleanup());

  it('the creator pill sits in the avatar column, not next to the name', () => {
    renderItem(commentBy(['ADMIN', 'AUTHOR']));
    const pill = screen.getByText('Twórca');
    const avatarColumn = pill.closest('[style*="height: 17px"]')!.parentElement as HTMLElement;
    expect(avatarColumn).toContainElement(screen.getByAltText('Jurek'));
    const nameLine = screen.getByText('Jurek').parentElement as HTMLElement;
    expect(avatarColumn).toContainElement(pill);
    expect(nameLine).not.toContainElement(pill);
  });

  it('the VIP pill is yellow with dark ink, reads "VIP" in every language and has a localized accessible name', () => {
    renderItem(commentBy(['VIP']));
    const pill = screen.getByText('VIP');
    expect(pill).toHaveAttribute('aria-label', 'Użytkownik VIP');
    expect(pill).toHaveAttribute('title', 'Użytkownik VIP');
    expect(pill.className).toContain('bg-[var(--cm-amber-14)]');
    expect(pill.className).toContain('text-[var(--chan-amber-ink)]');
    expect(screen.getByRole('img', { name: 'Użytkownik VIP' })).toBe(pill);
    cleanup();
    renderItem(commentBy(['VIP']), 'en');
    expect(screen.getByText('VIP')).toHaveAttribute('aria-label', 'VIP user');
  });

  it('VIP gets an amber ring like the creator ring (same width and offset, also in replies); the creator ring wins', () => {
    const ringOf = () => (screen.getByAltText('Jurek').closest('[class*="ring-offset-2"]') as HTMLElement | null)?.className ?? '';
    renderItem(commentBy(['VIP']));
    expect(ringOf()).toContain('ring-2');
    expect(ringOf()).toContain('ring-[var(--chan-amber-bright)]');
    expect(ringOf()).not.toContain('ring-[var(--chan-blue)]');
    cleanup();
    renderItem(commentBy(['VIP']), 'pl', true);
    expect(ringOf()).toContain('ring-[var(--chan-amber-bright)]');
    cleanup();
    renderItem(commentBy(['AUTHOR']));
    const creatorRing = ringOf();
    cleanup();
    renderItem(commentBy(['AUTHOR', 'VIP']));
    expect(ringOf()).toBe(creatorRing);
    expect(ringOf()).not.toContain('amber');
    cleanup();
    renderItem(commentBy([]));
    expect(ringOf()).toBe('');
  });

  it('VIP is under the avatar', () => {
    renderItem(commentBy(['VIP']));
    const avatar = screen.getByAltText('Jurek');
    const column = screen.getByText('VIP').closest('[style*="height: 17px"]')!.parentElement as HTMLElement;
    expect(column).toContainElement(avatar);
  });

  it('a creator who is also VIP shows ONE pill, "Twórca" (the more important), so the column never grows', () => {
    renderItem(commentBy(['ADMIN', 'AUTHOR', 'VIP']));
    expect(screen.getByText('Twórca')).toBeInTheDocument();
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-badge]')).toHaveLength(1);
  });

  it('a plain user, an admin and an old PATRON payload get no pill at all', () => {
    for (const badges of [[], ['ADMIN'], ['PATRON' as unknown as CommentAuthorBadgeDto]]) {
      renderItem(commentBy(badges));
      expect(document.querySelectorAll('[data-badge]')).toHaveLength(0);
      cleanup();
    }
  });

  it('replies use the narrow pill (24 px avatar) and keep the same labels', () => {
    renderItem(commentBy(['VIP']), 'pl', true);
    expect(screen.getByText('VIP').className).toContain('text-[9px]');
    cleanup();
    renderItem(commentBy(['AUTHOR']), 'pl', true);
    expect(screen.getByText('Twórca').className).toContain('text-[9px]');
  });

  it('the pill reserves its own height in the avatar column and never widens it', () => {
    renderItem(commentBy(['VIP']));
    const pill = screen.getByText('VIP');
    const slot = pill.parentElement!.parentElement as HTMLElement;
    expect(slot.style.width).toBe('40px');
    expect(slot.style.height).toBe('17px');
    expect(pill.parentElement!.className).toContain('absolute');
  });

  it('a long nick stays in its own truncating element and the pill is not inside it', () => {
    renderItem(commentBy(['VIP'], 'Bardzo Długi Nick Który Się Nie Mieści W Jednym Wierszu'));
    const name = screen.getByText('Bardzo Długi Nick Który Się Nie Mieści W Jednym Wierszu');
    expect(name.className).toContain('truncate');
    expect(name).not.toContainElement(screen.getByText('VIP'));
  });

  it('VIP and creator pills share one shape (only the colours differ) and neither has a border, ring or outline', () => {
    const { container } = render(
      <>
        <AuthorBadge kind="AUTHOR" language="pl" />
        <AuthorBadge kind="VIP" language="pl" />
      </>,
    );
    const [creator, vip] = [...container.querySelectorAll('[data-badge]')].map((el) => el.className.split(' '));
    const shape = (list: string[]) => list.filter((c) => !/^(bg-|text-\[var)/.test(c)).sort();
    expect(shape(vip)).toEqual(shape(creator));
    for (const list of [creator, vip]) expect(list.join(' ')).not.toMatch(/border|ring|outline|shadow/);
    expect(creator.join(' ')).toContain('bg-[var(--cm-blue-14)]');
    expect(vip.join(' ')).toContain('bg-[var(--cm-amber-14)]');
  });

  it('AuthorBadge works alone for both kinds', () => {
    const { container } = render(
      <>
        <AuthorBadge kind="AUTHOR" language="en" />
        <AuthorBadge kind="VIP" language="en" />
      </>,
    );
    expect(within(container).getByText('Creator')).toBeInTheDocument();
    expect(within(container).getByText('VIP')).toBeInTheDocument();
  });
});
