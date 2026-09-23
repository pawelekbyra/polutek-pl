/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { CommentItem } from '@/app/components/comments/components/CommentItem';
import type { CommentView } from '@/app/components/comments/types';

vi.mock('@/app/hooks/useToast', () => ({
  useToast: () => vi.fn(),
}));

function makeComment(overrides: Partial<CommentView> = {}): CommentView {
  return {
    id: 'comment-1',
    videoId: 'video-1',
    parentId: null,
    text: 'Hello world',
    imageUrl: null,
    status: 'VISIBLE',
    author: {
      id: 'author-1',
      displayName: 'Author',
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
    isHearted: false,
    repliesPreview: [],
    ...overrides,
  };
}

const noop = () => {};

function renderCommentItem(comment: CommentView) {
  return render(
    <CommentItem
      comment={comment}
      userProfile={{ id: 'viewer-1' }}
      isClient={true}
      language="pl"
      t={{}}
      canComment={true}
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
}

describe('CommentItem resyncs isHearted from the comment prop', () => {
  afterEach(() => cleanup());

  it('shows the creator-heart badge once the comment prop reports isHearted after a refetch', () => {
    const comment = makeComment({ isHearted: false });
    const { rerender } = renderCommentItem(comment);

    expect(screen.queryByRole('img', { name: 'Serce twórcy' })).not.toBeInTheDocument();

    // Simulate an unrelated cache refetch delivering a fresh isHearted value
    // for the same comment.id — React reuses this component instance since
    // the parent list keys CommentItem by comment.id.
    rerender(
      <CommentItem
        comment={{ ...comment, isHearted: true }}
        userProfile={{ id: 'viewer-1' }}
        isClient={true}
        language="pl"
        t={{}}
        canComment={true}
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

    expect(screen.getByRole('img', { name: 'Serce twórcy' })).toBeInTheDocument();
  });
});
