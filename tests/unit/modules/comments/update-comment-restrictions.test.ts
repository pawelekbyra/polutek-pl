import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateComment } from '@/lib/modules/comments/application/update-comment.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { CommentStatus } from '@prisma/client';

vi.mock('@/lib/modules/access', () => ({ checkVideoAccess: vi.fn() }));

/** Audit W17: editing a comment obeys the same restrictions as adding one (mute, channel block, comments mode). */
describe('updateComment restrictions', () => {
  const userId = 'u1';
  let prisma: any;
  const stored = () => ({
    id: 'c1', authorId: userId, videoId: 'v1', status: CommentStatus.VISIBLE, text: 'old words', createdAt: new Date(), updatedAt: new Date(),
    author: { id: userId, role: 'USER' }, reactions: [],
  });
  const ctx = (actor: any = { type: 'user', userId }) => createAppContext({ actor, prisma, now: () => new Date('2026-10-13T12:00:00Z') });
  const edit = (text = 'new words') => updateComment({ commentId: 'c1', text }, ctx());

  beforeEach(() => {
    vi.clearAllMocks();
    (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
    prisma = {
      comment: { findUnique: vi.fn(async () => stored()), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
      video: { findUnique: vi.fn().mockResolvedValue({ creatorId: 'ch1', commentsMode: 'ON', creator: { userId: 'owner' } }) },
      user: { findUnique: vi.fn().mockResolvedValue({ commentMutedUntil: null }) },
      channelBan: { findUnique: vi.fn().mockResolvedValue(null) },
      channelMember: { findMany: vi.fn().mockResolvedValue([]) },
    };
  });

  it('refuses a muted account and changes nothing', async () => {
    prisma.user.findUnique.mockResolvedValue({ commentMutedUntil: new Date('2026-10-14T00:00:00Z') });
    const result = await edit();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('FORBIDDEN');
    expect(prisma.comment.updateMany).not.toHaveBeenCalled();
  });

  it('lets an account whose mute has ended edit', async () => {
    prisma.user.findUnique.mockResolvedValue({ commentMutedUntil: new Date('2026-10-12T00:00:00Z') });
    expect((await edit()).ok).toBe(true);
  });

  it('refuses a viewer blocked on the video channel, without revealing the reason', async () => {
    prisma.channelBan.findUnique.mockResolvedValue({ until: null });
    const result = await edit();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ type: 'FORBIDDEN', code: 'CHANNEL_BANNED' });
      expect(JSON.stringify(result.error)).not.toMatch(/reason|until/i);
    }
    expect(prisma.comment.updateMany).not.toHaveBeenCalled();
    expect(prisma.channelBan.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { channelId_userId: { channelId: 'ch1', userId } } }));
  });

  it('ignores a block that already ended', async () => {
    prisma.channelBan.findUnique.mockResolvedValue({ until: new Date('2026-10-12T00:00:00Z') });
    expect((await edit()).ok).toBe(true);
  });

  it('refuses an edit under a video whose comments are switched OFF', async () => {
    prisma.video.findUnique.mockResolvedValue({ creatorId: 'ch1', commentsMode: 'OFF', creator: { userId: 'owner' } });
    const result = await edit();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: 'COMMENTS_DISABLED' });
    expect(prisma.comment.updateMany).not.toHaveBeenCalled();
  });

  it('sends edited text back to review when the video holds new comments (HELD)', async () => {
    prisma.video.findUnique.mockResolvedValue({ creatorId: 'ch1', commentsMode: 'HELD', creator: { userId: 'owner' } });
    expect((await edit()).ok).toBe(true);
    const call = prisma.comment.updateMany.mock.calls[0][0];
    expect(call.data).toMatchObject({ text: 'new words', status: CommentStatus.HELD_FOR_REVIEW, pinnedAt: null });
  });

  it('keeps a comment visible in ON mode and writes only while it is still VISIBLE and the author own', async () => {
    expect((await edit()).ok).toBe(true);
    const call = prisma.comment.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'c1', authorId: userId, status: CommentStatus.VISIBLE });
    expect(call.data.status).toBe(CommentStatus.VISIBLE);
    expect(call.data).not.toHaveProperty('pinnedAt');
  });

  it('answers CONFLICT when a moderator changed the comment between the check and the write', async () => {
    prisma.comment.updateMany.mockResolvedValue({ count: 0 });
    const result = await edit();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('CONFLICT');
  });

  it('treats saving the same words as no edit (no write, no second review)', async () => {
    prisma.video.findUnique.mockResolvedValue({ creatorId: 'ch1', commentsMode: 'HELD', creator: { userId: 'owner' } });
    expect((await edit('old words')).ok).toBe(true);
    expect(prisma.comment.updateMany).not.toHaveBeenCalled();
  });

  it('does not limit the channel owner by the comments mode or the block list', async () => {
    prisma.video.findUnique.mockResolvedValue({ creatorId: 'ch1', commentsMode: 'OFF', creator: { userId } });
    prisma.channelBan.findUnique.mockResolvedValue({ until: null });
    expect((await edit()).ok).toBe(true);
    expect(prisma.comment.updateMany.mock.calls[0][0].data.status).toBe(CommentStatus.VISIBLE);
  });
});
