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
      isPatron: true, // Stale metadata in author profile
      role: 'USER',
    },
    reactions: [],
    replies: [],
  };

  it('shows PATRON badge based on author metadata (display only)', () => {
    const dto = mapCommentToDto(mockComment, {
      userId: 'other-user',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: true
    });

    expect(dto.author?.badges).toContain('PATRON');
  });

  it('does NOT grant edit permission based on stale author metadata if access is false', () => {
    // Scenario: User 'u1' (comment author) is viewing their own comment.
    // They have isPatron: true in profile, but hasVideoAccess is false (e.g. grant expired/revoked)
    const dto = mapCommentToDto(mockComment, {
      userId: 'u1',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: false // Access truth
    });

    expect(dto.viewerCanEdit).toBe(false);
  });

  it('does NOT grant delete permission based on stale author metadata if access is false', () => {
    const dto = mapCommentToDto(mockComment, {
      userId: 'u1',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: false
    });

    expect(dto.viewerCanDelete).toBe(false);
  });

  it('does NOT grant report permission based on stale profile if access is false', () => {
    const dto = mapCommentToDto(mockComment, {
      userId: 'u2',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: false
    });

    expect(dto.viewerCanReport).toBe(false);
  });

  it('grants permissions correctly when access truth is true regardless of author metadata', () => {
     const dto = mapCommentToDto(mockComment, {
      userId: 'u1',
      canModerate: false,
      videoCreatorId: 'creator-1',
      hasVideoAccess: true
    });

    expect(dto.viewerCanEdit).toBe(true);
    expect(dto.viewerCanDelete).toBe(true);
  });
});
