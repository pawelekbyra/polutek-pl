/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { CommentItem } from '@/app/components/comments/components/CommentItem';
import type { CommentView } from '@/app/components/comments/types';
import type { CommentAuthorBadgeDto } from '@/lib/modules/comments/domain/comment-frontend.dto';

vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));

function commentBy(badges: CommentAuthorBadgeDto[], imageUrl: string | null = null): CommentView {
  return {
    id: 'c1',
    videoId: 'v1',
    parentId: null,
    text: 'Hej',
    status: 'VISIBLE',
    author: { id: 'a1', displayName: 'Jurek', username: null, imageUrl, badges },
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
const renderWithProfile = (comment: CommentView, userProfile: { id?: string; imageUrl?: string | null } | null) =>
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
    />,
  );
const renderItem = (comment: CommentView) =>
  render(
    <CommentItem
      comment={comment}
      userProfile={null}
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
    />,
  );

describe('comment author badge and avatar', () => {
  afterEach(() => cleanup());

  it('an admin is not labelled as a patron', () => {
    renderItem(commentBy(['ADMIN']));
    expect(screen.queryByText('Patron')).not.toBeInTheDocument();
  });

  it('the video creator gets the creator badge', () => {
    renderItem(commentBy(['ADMIN', 'AUTHOR']));
    expect(screen.getByText('Twórca')).toBeInTheDocument();
  });

  it('a supporter gets no public badge, even if an old payload still says PATRON', () => {
    renderItem(commentBy(['PATRON' as unknown as CommentAuthorBadgeDto]));
    expect(screen.queryByText('Patron')).not.toBeInTheDocument();
    expect(screen.queryByText('PATRON')).not.toBeInTheDocument();
  });

  it('falls back to our own local default avatar, never a third-party service', () => {
    renderItem(commentBy([]));
    const img = screen.getByAltText('Jurek') as HTMLImageElement;
    expect(decodeURIComponent(img.getAttribute('src') || '')).toContain('/default-avatar.jpg');
    expect(img.getAttribute('src')).not.toContain('dicebear');
  });

  it("shows the viewer's CURRENT avatar under their own earlier comments, others keep theirs", () => {
    const old = '/api/avatars/a1?v=1';
    const fresh = '/api/avatars/a1?v=2';
    const render = (viewerId: string) =>
      renderWithProfile(commentBy([], old), { id: viewerId, imageUrl: fresh });
    render('a1');
    expect((screen.getByAltText('Jurek') as HTMLImageElement).getAttribute('src')).toContain('v=2');
    cleanup();
    render('someone-else');
    expect((screen.getByAltText('Jurek') as HTMLImageElement).getAttribute('src')).toContain('v=1');
  });

  it('keeps line breaks of the comment text', () => {
    renderItem({ ...commentBy([]), text: 'raz\ndwa' });
    expect(screen.getByText(/raz\s+dwa/)).toHaveClass('whitespace-pre-wrap');
  });
});
