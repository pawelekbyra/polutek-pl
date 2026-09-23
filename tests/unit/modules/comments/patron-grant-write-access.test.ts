import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessTier, CommentStatus, VideoStatus } from '@prisma/client';
import { createVideoComment } from '@/lib/modules/comments/application/create-video-comment.use-case';
import { listVideoComments } from '@/lib/modules/comments/application/list-video-comments.use-case';
import { toggleCommentLike } from '@/lib/modules/comments/application/toggle-comment-like.use-case';
import { reportComment } from '@/lib/modules/comments/application/report-comment.use-case';
import { toggleVideoLike } from '@/lib/modules/comments/application/toggle-video-like.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { MainChannelService } from '@/lib/modules/channel';

// 2026-09-22 model (see CLAUDE.md §4.4): checkVideoAccess() no longer reads PatronGrant at
// all. PATRON-tier videos are handled identically to LOGGED_IN — any signed-in, non-deleted
// user gets access, guests are always LOGIN_REQUIRED. This file used to assert the opposite
// (PatronGrant-gated write access via getPatronStatus()); it was rewritten to match current
// behavior after that access-gate removal made the old assertions permanently red on `main`.
// PatronGrant itself still exists as supporter bookkeeping (§4.1) and still drives the
// decorative "PATRON" comment badge (lib/comments-public-author.ts) — that part is unrelated
// to write access and is covered separately below.
vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Comments write access on PATRON-tier videos (sign-in only, no PatronGrant gate)', () => {
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
      patronGrants: [],
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
      commentReport: {
        findUnique: vi.fn(),
        create: vi.fn(),
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

  function mockLocalUser(isDeleted = false) {
    mockPrisma.user.findUnique.mockResolvedValue({ id: userId, isDeleted });
  }

  function mockVideoMetadata() {
    mockPrisma.video.findUnique.mockResolvedValue({ creatorId: mainChannel.id, creator: { userId: 'creator-1' } });
  }

  function mockCreatedComment() {
    mockPrisma.comment.create.mockResolvedValue({ ...commentWithAuthor, author: undefined, reactions: undefined, replies: undefined });
    mockPrisma.comment.findUnique.mockResolvedValue(commentWithAuthor);
  }

  it('allows any signed-in user to comment on a PATRON-tier video, with no PatronGrant lookup', async () => {
    mockPublishedVideo();
    mockLocalUser();
    mockVideoMetadata();
    mockCreatedComment();

    const result = await createVideoComment(
      { videoId, text: 'hello' },
      createCtx({ type: 'user', userId }),
    );

    expect(result.ok).toBe(true);
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.comment.create).toHaveBeenCalled();
  });

  it('denies comment creation for a deleted local user, even on a PATRON-tier video', async () => {
    mockPublishedVideo();
    mockLocalUser(true);

    const result = await createVideoComment(
      { videoId, text: 'hello' },
      createCtx({ type: 'user', userId }),
    );

    // createVideoComment maps the DELETED access reason to NOT_FOUND (to avoid leaking
    // whether a video exists to an actor whose own account is deleted).
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('NOT_FOUND');
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.comment.create).not.toHaveBeenCalled();
  });

  it('allows any signed-in user to react to a comment on a PATRON-tier video, with no PatronGrant lookup', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ ...commentWithAuthor, authorId: 'other-user' });
    mockPublishedVideo();
    mockLocalUser();
    mockPrisma.commentReaction.findUnique.mockResolvedValue(null);

    const result = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'user', userId }),
    );

    expect(result.ok).toBe(true);
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.commentReaction.create).toHaveBeenCalled();
  });

  it('denies comment reactions for a deleted local user, even on a PATRON-tier video', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ ...commentWithAuthor, authorId: 'other-user' });
    mockPublishedVideo();
    mockLocalUser(true);

    const result = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'user', userId }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.commentReaction.create).not.toHaveBeenCalled();
  });

  it('allows any signed-in user to react to a PATRON-tier video itself, with no PatronGrant lookup', async () => {
    mockPublishedVideo();
    mockLocalUser();
    mockPrisma.videoLike.findUnique.mockResolvedValue(null);
    mockPrisma.videoDislike.findUnique.mockResolvedValue(null);

    const result = await toggleVideoLike(
      { videoId },
      createCtx({ type: 'user', userId }),
    );

    expect(result.ok).toBe(true);
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.videoLike.create).toHaveBeenCalled();
  });

  it('keeps patron-only comments readable for guests while denying guest comment creation', async () => {
    mockPublishedVideo();
    mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'creator-1' } });
    mockPrisma.comment.findMany.mockResolvedValue([commentWithAuthor]);
    mockPrisma.comment.count.mockResolvedValue(1);

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
      { videoId, text: 'guest should not write' },
      createCtx({ type: 'guest' }),
    );

    expect(writeResult.ok).toBe(false);
    if (!writeResult.ok) expect(writeResult.error.type).toBe('UNAUTHORIZED');
    expect(mockPrisma.comment.create).not.toHaveBeenCalled();
  });

  it('keeps patron-only comments readable for guests while denying guest comment reactions', async () => {
    mockPublishedVideo();
    mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'creator-1' } });
    mockPrisma.comment.findMany.mockResolvedValue([commentWithAuthor]);
    mockPrisma.comment.count.mockResolvedValue(1);

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'guest' }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.data.comments).toHaveLength(1);
      expect(readResult.data.viewer.canReact).toBe(false);
    }

    const reactionResult = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'guest' }),
    );

    expect(reactionResult.ok).toBe(false);
    if (!reactionResult.ok) expect(reactionResult.error.type).toBe('UNAUTHORIZED');
    expect(mockPrisma.commentReaction.create).not.toHaveBeenCalled();
  });

  it('keeps patron-only comments readable for guests while denying guest reports', async () => {
    mockPublishedVideo();
    mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'creator-1' } });
    mockPrisma.comment.findMany.mockResolvedValue([commentWithAuthor]);
    mockPrisma.comment.count.mockResolvedValue(1);

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'guest' }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.data.comments).toHaveLength(1);
      expect(readResult.data.viewer.canReport).toBe(false);
    }

    const reportResult = await reportComment(
      { commentId, reason: 'SPAM' },
      createCtx({ type: 'guest' }),
    );

    expect(reportResult.ok).toBe(false);
    if (!reportResult.ok) expect(reportResult.error.type).toBe('UNAUTHORIZED');
    expect(mockPrisma.commentReport.create).not.toHaveBeenCalled();
  });

  it('lets any signed-in user read, comment on, react to, and report patron-only comments', async () => {
    mockPublishedVideo();
    mockLocalUser();
    mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'creator-1' } });
    mockPrisma.comment.findMany.mockResolvedValue([commentWithAuthor]);
    mockPrisma.comment.count.mockResolvedValue(1);
    mockPrisma.comment.findUnique.mockResolvedValue({ ...commentWithAuthor, authorId: 'other-user' });

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'user', userId }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.data.comments).toHaveLength(1);
      expect(readResult.data.viewer.canComment).toBe(true);
      expect(readResult.data.viewer.canReact).toBe(true);
      expect(readResult.data.viewer.canReport).toBe(true);
    }

    mockPrisma.commentReaction.findUnique.mockResolvedValue(null);
    mockPrisma.commentReport.findUnique.mockResolvedValue(null);
    mockPrisma.comment.update.mockResolvedValue({ reportsCount: 1, status: 'VISIBLE' });

    const reactionResult = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'user', userId }),
    );
    const reportResult = await reportComment(
      { commentId, reason: 'SPAM' },
      createCtx({ type: 'user', userId }),
    );

    expect(reactionResult.ok).toBe(true);
    expect(reportResult.ok).toBe(true);
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.commentReaction.create).toHaveBeenCalled();
    expect(mockPrisma.commentReport.create).toHaveBeenCalled();
  });

  it('only shows the decorative PATRON badge when the author has an active PatronGrant, independent of write access', async () => {
    const badgeComment = {
      ...commentWithAuthor,
      authorId: userId,
      author: {
        ...commentWithAuthor.author,
        patronGrants: [], // no active grant -> no badge, even though this author can still write freely
      },
    };

    mockPublishedVideo();
    mockLocalUser();
    mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'creator-1' } });
    mockPrisma.comment.findMany.mockResolvedValue([badgeComment]);
    mockPrisma.comment.count.mockResolvedValue(1);

    const readResult = await listVideoComments(
      { videoId, sortBy: 'newest', limit: 10 },
      createCtx({ type: 'user', userId }),
    );

    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.data.comments[0].author?.badges).not.toContain('PATRON');
      // Write access is unaffected by the missing grant under the current model.
      expect(readResult.data.comments[0].viewerCanEdit).toBe(true);
      expect(readResult.data.viewer.canComment).toBe(true);
      expect(readResult.data.viewer.canReact).toBe(true);
    }
  });

  it('keeps admin comment creation, reaction, and report behavior allowed without any PatronGrant lookup', async () => {
    mockPublishedVideo();
    mockVideoMetadata();
    mockCreatedComment();
    mockPrisma.commentReaction.findUnique.mockResolvedValue(null);
    mockPrisma.commentReport.findUnique.mockResolvedValue(null);
    mockPrisma.comment.update.mockResolvedValue({ reportsCount: 1, status: 'VISIBLE' });

    const createResult = await createVideoComment(
      { videoId, text: 'admin hello' },
      createCtx({ type: 'admin', userId: 'admin-1' }),
    );

    mockPrisma.comment.findUnique.mockResolvedValue({ ...commentWithAuthor, authorId: 'other-user' });

    const reactionResult = await toggleCommentLike(
      { commentId, action: 'LIKE' },
      createCtx({ type: 'admin', userId: 'admin-1' }),
    );
    const reportResult = await reportComment(
      { commentId, reason: 'SPAM' },
      createCtx({ type: 'admin', userId: 'admin-1' }),
    );

    expect(createResult.ok).toBe(true);
    expect(reactionResult.ok).toBe(true);
    expect(reportResult.ok).toBe(true);
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.comment.create).toHaveBeenCalled();
    expect(mockPrisma.commentReaction.create).toHaveBeenCalled();
    expect(mockPrisma.commentReport.create).toHaveBeenCalled();
  });

  it('keeps admin comment creation behavior unchanged without any PatronGrant lookup', async () => {
    mockPublishedVideo();
    mockVideoMetadata();
    mockCreatedComment();

    const result = await createVideoComment(
      { videoId, text: 'admin hello' },
      createCtx({ type: 'admin', userId: 'admin-1' }),
    );

    expect(result.ok).toBe(true);
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.comment.create).toHaveBeenCalled();
  });

  it('keeps public comment read behavior unchanged for anonymous viewers', async () => {
    mockPublishedVideo(publicVideo);
    mockPrisma.video.findUnique.mockResolvedValue({ creator: { userId: 'creator-1' } });
    mockPrisma.comment.findMany.mockResolvedValue([]);
    mockPrisma.comment.count.mockResolvedValue(0);

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
    expect(mockPrisma.comment.findMany).toHaveBeenCalled();
  });
});
