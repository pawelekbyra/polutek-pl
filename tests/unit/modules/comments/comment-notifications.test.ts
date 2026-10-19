import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  commentFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  notificationFindFirst: vi.fn(),
  sendNotification: vi.fn(async () => ({ id: 'n1' })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    comment: { findUnique: m.commentFindUnique },
    user: { findUnique: m.userFindUnique },
    notification: { findFirst: m.notificationFindFirst },
  },
}));
vi.mock('@/lib/modules/notifications', async () => {
  const actual = await vi.importActual<typeof import('@/lib/modules/notifications')>('@/lib/modules/notifications');
  return { ...actual, sendNotification: m.sendNotification };
});

import { notifyCommentReply, notifyCreatorLike } from '@/lib/modules/comments/application/comment-notifications';

beforeEach(() => vi.clearAllMocks());

describe('notifyCommentReply', () => {
  it('tells the author of the answered comment, with the replier name and the start of the reply', async () => {
    m.commentFindUnique.mockResolvedValue({ id: 'c1', authorId: 'author', author: { isDeleted: false }, video: { slug: 'film' } });
    m.userFindUnique.mockResolvedValue({ name: 'Ala' });
    await notifyCommentReply({ answeredCommentId: 'c1', replierId: 'ala-id', replyText: '  Świetny   film!  ' });
    expect(m.sendNotification).toHaveBeenCalledTimes(1);
    const sent = (m.sendNotification.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(sent).toMatchObject({
      userId: 'author',
      kind: 'COMMENT',
      titlePl: 'Nowa odpowiedź na Twój komentarz',
      bodyPl: 'Ala: Świetny film!',
      href: '/watch/film#comment-c1',
      skipTemplate: true,
    });
  });

  it('stays silent when people answer themselves or the author account is gone', async () => {
    m.commentFindUnique.mockResolvedValue({ id: 'c1', authorId: 'same', author: { isDeleted: false }, video: { slug: 'film' } });
    await notifyCommentReply({ answeredCommentId: 'c1', replierId: 'same', replyText: 'x' });
    m.commentFindUnique.mockResolvedValue({ id: 'c1', authorId: 'gone', author: { isDeleted: true }, video: { slug: 'film' } });
    await notifyCommentReply({ answeredCommentId: 'c1', replierId: 'other', replyText: 'x' });
    expect(m.sendNotification).not.toHaveBeenCalled();
  });

  it('never throws into the caller', async () => {
    m.commentFindUnique.mockRejectedValue(new Error('db'));
    await expect(notifyCommentReply({ answeredCommentId: 'c1', replierId: 'x', replyText: 'x' })).resolves.toBeUndefined();
  });
});

describe('notifyCreatorLike', () => {
  const visible = { id: 'c1', authorId: 'author', status: 'VISIBLE', author: { isDeleted: false }, video: { slug: 'film', creator: { userId: 'creator' } } };

  it('tells the author once that the creator liked the comment', async () => {
    m.commentFindUnique.mockResolvedValue(visible);
    m.notificationFindFirst.mockResolvedValue(null);
    await notifyCreatorLike({ commentId: 'c1' });
    expect(m.sendNotification).toHaveBeenCalledTimes(1);
    expect((m.sendNotification.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({
      userId: 'author',
      titlePl: 'Twórca polubił Twój komentarz',
      href: '/watch/film#comment-c1',
    });

    m.sendNotification.mockClear();
    m.notificationFindFirst.mockResolvedValue({ id: 'earlier' });
    await notifyCreatorLike({ commentId: 'c1' });
    expect(m.sendNotification).not.toHaveBeenCalled();
  });

  it('ignores the creator liking their own comment and comments that are not visible', async () => {
    m.commentFindUnique.mockResolvedValue({ ...visible, authorId: 'creator' });
    await notifyCreatorLike({ commentId: 'c1' });
    m.commentFindUnique.mockResolvedValue({ ...visible, status: 'HIDDEN' });
    await notifyCreatorLike({ commentId: 'c1' });
    expect(m.sendNotification).not.toHaveBeenCalled();
  });
});
