import { describe, it, expect } from 'vitest';
import { mapCommentToDto } from '@/lib/modules/comments/domain/comment.dto';
import { CommentStatus } from '@prisma/client';

describe('Comment Badge and Permission Safety', () => {
  const mockComment = {
    id: 'c1',
    videoId: 'v1',
    authorId: 'u1',
    text: 'Hello',
    status: CommentStatus.VISIBLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 0,
    repliesCount: 0,
    author: {
      id: 'u1',
      name: 'Test User',
      username: 'testuser',
      imageUrl: 'https://example.com/avatar.png',
      patronGrants: [{ id: 'grant-1' }],
      role: 'USER',
    },
    reactions: [],
    replies: [],
  };

  it('shows PATRON badge based on active author PatronGrant', () => {
    const dto = mapCommentToDto(mockComment, {
      userId: 'other-user',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: true
    });

    expect(dto.author?.badges).toContain('PATRON');
  });

  it('does NOT grant edit permission based on author badge data if access is false', () => {
    const dto = mapCommentToDto(mockComment, {
      userId: 'u1',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: false
    });

    expect(dto.viewerCanEdit).toBe(false);
  });

  it('does NOT grant delete permission based on author badge data if access is false', () => {
    const dto = mapCommentToDto(mockComment, {
      userId: 'u1',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: false
    });

    expect(dto.viewerCanDelete).toBe(false);
  });

  it('does NOT grant report permission based on author badge data if access is false', () => {
    const dto = mapCommentToDto(mockComment, {
      userId: 'u2',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: false
    });

    expect(dto.viewerCanReport).toBe(false);
  });

  it('grants permissions when access truth is true regardless of author badges', () => {
     const dto = mapCommentToDto(mockComment, {
      userId: 'u1',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: true
    });

    expect(dto.viewerCanEdit).toBe(true);
    expect(dto.viewerCanDelete).toBe(true);
  });

  it('hides PATRON badge when no active grants exist, even if User.isPatron legacy field would be true', () => {
    const commentWithLegacyMismatch = {
      ...mockComment,
      author: {
        ...mockComment.author,
        isPatron: true, // legacy field
        patronGrants: [], // source of truth is empty
      },
    };

    const dto = mapCommentToDto(commentWithLegacyMismatch, {
      userId: 'u2',
      canModerate: false,
      videoCreatorId: 'v-creator',
      hasVideoAccess: true,
    });

    expect(dto.author?.badges).not.toContain('PATRON');
  });

  it('shows PATRON badge when active grants exist, even if User.isPatron legacy field is false', () => {
    const commentWithLegacyMismatch = {
      ...mockComment,
      author: {
        ...mockComment.author,
        isPatron: false, // legacy field
        patronGrants: [{ id: 'active-grant-1' }], // source of truth is NOT empty
      },
    };

    const dto = mapCommentToDto(commentWithLegacyMismatch, {
      userId: 'u2',
      canModerate: false,
      videoCreatorId: 'v-creator',
      hasVideoAccess: true,
    });

    expect(dto.author?.badges).toContain('PATRON');
  });
});
