import { describe, it, expect } from 'vitest';
import { CommentDeletedReason, CommentStatus } from '@prisma/client';
import { mapCommentToDto, type CommentRow } from '@/lib/modules/comments/domain/comment.dto';

function row(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: 'c1',
    videoId: 'v1',
    parentId: null,
    authorId: 'author-1',
    text: 'secret words',
    status: CommentStatus.VISIBLE,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 2,
    reportsCount: 0,
    isHearted: false,
    author: { id: 'author-1', name: 'Ala', username: null, imageUrl: null, isDeleted: false, role: 'USER' },
    ...overrides,
  };
}

const viewer = { userId: 'viewer-1', canModerate: false, videoCreatorId: 'creator-1' };
const moderator = { userId: 'creator-1', canModerate: true, videoCreatorId: 'creator-1' };

describe('mapCommentToDto: status decides what anyone can see', () => {
  it('shows a visible comment to everyone', () => {
    expect(mapCommentToDto(row(), viewer).text).toBe('secret words');
    expect(mapCommentToDto(row(), { ...viewer, userId: null }).text).toBe('secret words');
  });

  it.each([CommentStatus.HIDDEN, CommentStatus.HELD_FOR_REVIEW, CommentStatus.DELETED])(
    'never returns the content or author of a %s comment to a viewer',
    (status) => {
      const dto = mapCommentToDto(row({ status }), viewer);
      expect(dto.text).toBeNull();
      expect(dto.author).toBeNull();
      expect(dto.viewerCanReport).toBe(false);
      expect(dto.viewerCanEdit).toBe(false);
    },
  );

  it('lets a moderator review hidden and held comments', () => {
    expect(mapCommentToDto(row({ status: CommentStatus.HIDDEN }), moderator).text).toBe('secret words');
    expect(mapCommentToDto(row({ status: CommentStatus.HELD_FOR_REVIEW }), moderator).text).toBe('secret words');
  });

  it('keeps deleted content out of public responses, even for a moderator', () => {
    const deleted = row({ status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.MODERATOR_DELETED });
    expect(mapCommentToDto(deleted, moderator).text).toBeNull();
  });

  it('shows moderation-deleted content in the admin panel, but never what the author deleted', () => {
    const admin = { ...moderator, revealDeletedContent: true };
    expect(
      mapCommentToDto(row({ status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.SPAM }), admin).text,
    ).toBe('secret words');
    expect(
      mapCommentToDto(row({ status: CommentStatus.DELETED, deletedReason: CommentDeletedReason.AUTHOR_DELETED }), admin).text,
    ).toBeNull();
  });

  it('applies the same rule to embedded replies', () => {
    const dto = mapCommentToDto(
      row({ replies: [row({ id: 'r1', parentId: 'c1', status: CommentStatus.HELD_FOR_REVIEW })] }),
      viewer,
    );
    expect(dto.repliesPreview[0].text).toBeNull();
  });

  it('reports the visible reply count, not a stored counter', () => {
    expect(mapCommentToDto(row({ _count: { replies: 7 } }), viewer).repliesCount).toBe(7);
    expect(mapCommentToDto(row(), viewer).repliesCount).toBe(0);
  });

  it('only lets the author edit, never an admin rewriting someone else', () => {
    expect(mapCommentToDto(row(), { ...viewer, userId: 'author-1' }).viewerCanEdit).toBe(true);
    expect(mapCommentToDto(row(), moderator).viewerCanEdit).toBe(false);
  });
});
