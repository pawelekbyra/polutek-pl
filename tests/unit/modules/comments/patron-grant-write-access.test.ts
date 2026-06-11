import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessTier, CommentStatus, VideoStatus } from '@prisma/client';
import { createVideoComment } from '@/lib/modules/comments/application/create-video-comment.use-case';
import { listVideoComments } from '@/lib/modules/comments/application/list-video-comments.use-case';
import { toggleCommentLike } from '@/lib/modules/comments/application/toggle-comment-like.use-case';
import { toggleVideoLike } from '@/lib/modules/comments/application/toggle-video-like.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { MainChannelService } from '@/lib/modules/channel';
import { getPatronStatus } from '@/lib/modules/patron';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

vi.mock('@/lib/modules/patron', () => ({
  getPatronStatus: vi.fn(),
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Comments PatronGrant-backed write access', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const mainChannel = { id: 'main-channel-id', slug: 'polutek', isApproved: true, isPrimary: true };
  const videoId = '11111111-1111-4111-8111-111111111111';
  const commentId = 'comment-1';
  const userId = 'user-1';

  let mockPrisma: any;

  const patronVideo = {
    id: videoId,
    slug: 'patron-video',
    creatorId: mainChannel.id,
    status: VideoStatus.PUBLISHED,
    tier: AccessTier.PATRON,
    publishedAt: new Date(now.getTime() - 1000),
    creator: { id: mainChannel.id, userId: 'creator-1', isApproved: true, isPrimary: true },
  };

  const publicVideo = {
    ...patronVideo,
    tier: AccessTier.PUBLIC,
    slug: 'public-video',
  };

  const commentWithAuthor = {
    id: commentId,
    videoId,
    parentId: null,
    authorId: userId,
    creatorId: mainChannel.id,
    text: 'hello',
    imageUrl: null,
    status: CommentStatus.VISIBLE,
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 0,
    repliesCount: 0,
    reportsCount: 0,
    reactions: [],
    replies: [],
    author: {
      id: userId,
      name: 'User',
      username: 'user',
      imageUrl: null,
      role: 'USER',
      isPatron: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      video: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      patronGrant: {
        findMany: vi.fn(),
      },
      comment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      commentReaction: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      videoLike: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      videoDislike: {
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };

    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mainChannel as any);
  });

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma, now: () => now });

  function mockPublishedVideo(video: any = patronVideo) {
    mockPrisma.video.findFirst.mockResolvedValue(video);
  }

  function mockLocalUser(isPatron: boolean) {
    mockPrisma.user.findUnique.mockResolvedValue({ id: userId, isDeleted: false, isPatron });
  }

  function mockVideoMetadata() {
    mockPrisma.video.findUnique.mockResolvedValue({ creatorId: mainChannel.id, creator: { userId: 'creator-1' } });
  }

  function mockVisibleComments(comments: any[] = [commentWithAuthor]) {
    mockVideoMetadata();
    mockPrisma.comment.findMany.mockResolvedValue(comments);
    mockPrisma.comment.count.mockResolvedValue(comments.length);
  }

  function mockCreatedComment() {
    mockPrisma.comment.create.mockResolvedValue({ ...commentWithAuthor, author: undefined, reactions: undefined, replies: undefined });
    mockPrisma.comment.findUnique.mockResolvedValue(commentWithAuthor);
  }

  it('allows comment creation on patron-only video from active PatronGrant even when User.isPatron is stale false', async () => {
    mockPublishedVideo();
    mockLocalUser(false);
    vi.mocked(getPatronStatus).mockResolvedValue(ok({ activeGrants: [{ id: 'grant-1' }] } as any));
    mockVideoMetadata();
    mockCreatedComment();

    const result = await createVideoComment(
      { videoId, text: 'hello' },
      createCtx({ type: 'user', userId, isPatron: false }),
    );

    expect(result.ok).toBe(true);
    expect(getPatronStatus).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockPrisma.comment.create).toHaveBeenCalled();
  });

  it('denies comment creation on patron-only video without active PatronGrant even when User.isPatron is stale true', async () => {
    mockPublishedVideo();
    mockLocalUser(true);
    vi.mocked(getPatronStatus).mockResolvedValue(ok({ activeGrants: [] } as any));

    const result = await createVideoComment(
      { videoId, text: 'hello' },
      createCtx({ type: 'user', userId, isPatron: true }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    expect(getPatronStatus).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockPrisma.comment.create).not.toHaveBeenCalled();
  });

  it('allows comment reaction on patron-only video from active PatronGrant even when User.isPatron is stale false', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ ...commentWithAuthor, authorId: 'other-user' });
    mockPublishedVideo();
    mockLocalUser(false);
    vi.mocked(getPatronStatus).mockResolvedValue(ok({ activeGrants: [{ id: 'grant-1' }] } as any));
    mockPrisma.commentReaction.findUnique.mockResolvedValue(null);

    const result = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'user', userId, isPatron: false }),
    );

    expect(result.ok).toBe(true);
    expect(getPatronStatus).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockPrisma.commentReaction.create).toHaveBeenCalled();
  });

  it('denies comment reaction on patron-only video without active PatronGrant even when User.isPatron is stale true', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ ...commentWithAuthor, authorId: 'other-user' });
    mockPublishedVideo();
    mockLocalUser(true);
    vi.mocked(getPatronStatus).mockResolvedValue(ok({ activeGrants: [] } as any));

    const result = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'user', userId, isPatron: true }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    expect(getPatronStatus).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockPrisma.commentReaction.create).not.toHaveBeenCalled();
  });

  it('allows video reaction on patron-only video from active PatronGrant even when User.isPatron is stale false', async () => {
    mockPublishedVideo();
    mockLocalUser(false);
    vi.mocked(getPatronStatus).mockResolvedValue(ok({ activeGrants: [{ id: 'grant-1' }] } as any));
    mockPrisma.videoLike.findUnique.mockResolvedValue(null);
    mockPrisma.videoDislike.findUnique.mockResolvedValue(null);

    const result = await toggleVideoLike(
      { videoId },
      createCtx({ type: 'user', userId, isPatron: false }),
    );

    expect(result.ok).toBe(true);
    expect(getPatronStatus).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockPrisma.videoLike.create).toHaveBeenCalled();
  });

  it('keeps patron-only comments readable for guests but blocks guest comment creation', async () => {
    mockPublishedVideo();
    mockVisibleComments();

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'guest' }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.data.comments).toHaveLength(1);
      expect(readResult.data.viewer.canComment).toBe(false);
      expect(readResult.data.viewer.canReact).toBe(false);
      expect(readResult.data.viewer.canReport).toBe(false);
    }

    const writeResult = await createVideoComment(
      { videoId, text: 'guest hello' },
      createCtx({ type: 'guest' }),
    );

    expect(writeResult.ok).toBe(false);
    if (!writeResult.ok) expect(writeResult.error.type).toBe('UNAUTHORIZED');
    expect(getPatronStatus).not.toHaveBeenCalled();
    expect(mockPrisma.comment.create).not.toHaveBeenCalled();
  });

  it('blocks guests from reacting to publicly readable patron-only comments', async () => {
    mockPublishedVideo();
    mockVisibleComments();

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'guest' }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) expect(readResult.data.viewer.canReact).toBe(false);

    const reactionResult = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'guest' }),
    );

    expect(reactionResult.ok).toBe(false);
    if (!reactionResult.ok) expect(reactionResult.error.type).toBe('UNAUTHORIZED');
    expect(mockPrisma.commentReaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.commentReaction.delete).not.toHaveBeenCalled();
  });

  it('keeps patron-only comments readable for logged-in non-patrons but blocks comment creation', async () => {
    mockPublishedVideo();
    mockLocalUser(false);
    vi.mocked(getPatronStatus).mockResolvedValue(ok({ activeGrants: [] } as any));
    mockVisibleComments();

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'user', userId, isPatron: false }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.data.comments).toHaveLength(1);
      expect(readResult.data.viewer.canComment).toBe(false);
      expect(readResult.data.viewer.canReact).toBe(false);
      expect(readResult.data.viewer.canReport).toBe(false);
    }

    vi.mocked(getPatronStatus).mockClear();
    mockPrisma.comment.create.mockClear();

    const writeResult = await createVideoComment(
      { videoId, text: 'non-patron hello' },
      createCtx({ type: 'user', userId, isPatron: false }),
    );

    expect(writeResult.ok).toBe(false);
    if (!writeResult.ok) expect(writeResult.error.type).toBe('FORBIDDEN');
    expect(getPatronStatus).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockPrisma.comment.create).not.toHaveBeenCalled();
  });

  it('does not let stale viewer User.isPatron or visible author patron badges grant write or react permission', async () => {
    const patronBadgedComment = {
      ...commentWithAuthor,
      author: {
        ...commentWithAuthor.author,
        isPatron: true,
      },
    };

    mockPublishedVideo();
    mockLocalUser(true);
    vi.mocked(getPatronStatus).mockResolvedValue(ok({ activeGrants: [] } as any));
    mockVisibleComments([patronBadgedComment]);

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'user', userId, isPatron: true }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.data.comments[0].author?.badges).toContain('PATRON');
      expect(readResult.data.comments[0].viewerCanEdit).toBe(false);
      expect(readResult.data.comments[0].viewerCanDelete).toBe(false);
      expect(readResult.data.comments[0].viewerCanReport).toBe(false);
      expect(readResult.data.viewer.canComment).toBe(false);
      expect(readResult.data.viewer.canReact).toBe(false);
    }

    vi.mocked(getPatronStatus).mockClear();

    const writeResult = await createVideoComment(
      { videoId, text: 'stale patron hello' },
      createCtx({ type: 'user', userId, isPatron: true }),
    );

    mockPrisma.comment.findUnique.mockResolvedValue(patronBadgedComment);
    const reactionResult = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'user', userId, isPatron: true }),
    );

    expect(writeResult.ok).toBe(false);
    if (!writeResult.ok) expect(writeResult.error.type).toBe('FORBIDDEN');
    expect(reactionResult.ok).toBe(false);
    if (!reactionResult.ok) expect(reactionResult.error.type).toBe('FORBIDDEN');
    expect(getPatronStatus).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(mockPrisma.comment.create).not.toHaveBeenCalled();
    expect(mockPrisma.commentReaction.create).not.toHaveBeenCalled();
  });

  it('keeps admin comment creation behavior unchanged without PatronGrant lookup', async () => {
    mockPublishedVideo();
    mockVideoMetadata();
    mockCreatedComment();

    const result = await createVideoComment(
      { videoId, text: 'admin hello' },
      createCtx({ type: 'admin', userId: 'admin-1' }),
    );

    expect(result.ok).toBe(true);
    expect(getPatronStatus).not.toHaveBeenCalled();
    expect(mockPrisma.comment.create).toHaveBeenCalled();
  });

  it('keeps public comment read behavior unchanged for anonymous viewers', async () => {
    mockPublishedVideo(publicVideo);
    mockVisibleComments([]);

    const result = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'guest' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.comments).toEqual([]);
      expect(result.data.viewer.canComment).toBe(false);
      expect(result.data.viewer.canReact).toBe(false);
    }
    expect(getPatronStatus).not.toHaveBeenCalled();
    expect(mockPrisma.comment.findMany).toHaveBeenCalled();
  });
});
