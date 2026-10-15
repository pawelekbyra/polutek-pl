import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentStatus, VideoCommentsMode } from '@prisma/client';
import { createVideoComment } from '@/lib/modules/comments/application/create-video-comment.use-case';
import { CommentPolicy } from '@/lib/modules/comments/domain/comment.policy';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';

vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: vi.fn(), recordAuditEventSafe: vi.fn() }));

describe('CommentPolicy.statusForNewComment', () => {
  it('ON publishes at once, HELD queues for review, OFF rejects', () => {
    expect(CommentPolicy.statusForNewComment(VideoCommentsMode.ON, false)).toBe(CommentStatus.VISIBLE);
    expect(CommentPolicy.statusForNewComment(VideoCommentsMode.HELD, false)).toBe(CommentStatus.HELD_FOR_REVIEW);
    expect(CommentPolicy.statusForNewComment(VideoCommentsMode.OFF, false)).toBeNull();
  });

  it('never limits people who moderate the video', () => {
    for (const mode of Object.values(VideoCommentsMode)) {
      expect(CommentPolicy.statusForNewComment(mode, true)).toBe(CommentStatus.VISIBLE);
    }
  });

  it('treats a missing mode (legacy row) as ON', () => {
    expect(CommentPolicy.statusForNewComment(undefined, false)).toBe(CommentStatus.VISIBLE);
    expect(CommentPolicy.statusForNewComment(null, false)).toBe(CommentStatus.VISIBLE);
  });
});

describe('createVideoComment under commentsMode', () => {
  const videoId = 'v1';
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
    prisma = {
      comment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'new-c', videoId, createdAt: new Date(), updatedAt: new Date(), author: { id: 'u1', role: 'USER' }, reactions: [] }),
        create: vi.fn().mockResolvedValue({ id: 'new-c' }),
      },
      video: { findUnique: vi.fn() },
      channelBan: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findUnique: vi.fn().mockResolvedValue({ commentMutedUntil: null }) },
      $transaction: vi.fn((cb) => cb(prisma)),
    };
  });

  const run = (mode: VideoCommentsMode, actor: any = { type: 'user', userId: 'u1' }) => {
    prisma.video.findUnique.mockResolvedValue({ creatorId: 'c1', commentsMode: mode, creator: { userId: 'owner' } });
    return createVideoComment({ videoId, text: 'hello' }, createAppContext({ actor, prisma }));
  };

  it('ON: the comment is visible', async () => {
    const result = await run(VideoCommentsMode.ON);
    expect(result.ok).toBe(true);
    expect(prisma.comment.create.mock.calls[0][0].data.status).toBe(CommentStatus.VISIBLE);
  });

  it('HELD: the comment is created in the review queue', async () => {
    const result = await run(VideoCommentsMode.HELD);
    expect(result.ok).toBe(true);
    expect(prisma.comment.create.mock.calls[0][0].data.status).toBe(CommentStatus.HELD_FOR_REVIEW);
  });

  it('OFF: a viewer gets a readable error and nothing is written', async () => {
    const result = await run(VideoCommentsMode.OFF);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ type: 'FORBIDDEN', code: 'COMMENTS_DISABLED', message: expect.stringContaining('wyłączone') });
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('OFF and HELD do not limit the channel owner', async () => {
    for (const mode of [VideoCommentsMode.OFF, VideoCommentsMode.HELD]) {
      prisma.comment.create.mockClear();
      const result = await run(mode, { type: 'user', userId: 'owner' });
      expect(result.ok).toBe(true);
      expect(prisma.comment.create.mock.calls[0][0].data.status).toBe(CommentStatus.VISIBLE);
    }
  });
});
