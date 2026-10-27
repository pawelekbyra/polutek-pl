import { describe, it, expect, beforeEach } from 'vitest';
import { CommentRepository } from '@/lib/modules/comments/infrastructure/comment.repository';

/**
 * A tiny in-memory stand-in for the tables the reaction code touches, with the same unique
 * keys as the schema (`@@unique([userId, commentId])`, `@@unique([userId, videoId])`):
 * `createMany({ skipDuplicates })` behaves like `INSERT ... ON CONFLICT DO NOTHING`.
 */
function createFakeDb() {
  const commentReactions: Array<{ userId: string; commentId: string; type: 'LIKE' | 'DISLIKE' }> = [];
  const videoLikes: Array<{ userId: string; videoId: string }> = [];
  const videoDislikes: Array<{ userId: string; videoId: string }> = [];
  const comment = { id: 'c1', likesCount: 0 };
  const video = { id: 'v1', likesCount: 0, dislikesCount: 0 };

  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const table = <T extends Record<string, unknown>>(rows: T[], uniqueKeys: (keyof T)[]) => ({
    createMany: async ({ data }: { data: T[] }) => {
      let count = 0;
      for (const item of data) {
        if (rows.some((row) => uniqueKeys.every((key) => row[key] === item[key]))) continue;
        rows.push({ ...item });
        count += 1;
      }
      return { count };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (matches(rows[i], where)) {
          rows.splice(i, 1);
          count += 1;
        }
      }
      return { count };
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<T> }) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
    findUnique: async ({ where }: { where: Record<string, Record<string, unknown>> }) => {
      const key = Object.values(where)[0];
      return rows.find((row) => matches(row, key)) ?? null;
    },
  });

  const counter = (target: Record<string, number>) => ({
    update: async ({ data }: { data: Record<string, { increment: number }> }) => {
      for (const [key, op] of Object.entries(data)) target[key] += op.increment;
      return target;
    },
    updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, number> }) => {
      const [[field, cond]] = Object.entries(where).filter(([key]) => key !== 'id');
      if (target[field] < cond.lt) Object.assign(target, data);
      return { count: 1 };
    },
    findUnique: async () => target,
  });

  return {
    db: {
      $executeRaw: async () => 1,
      commentReaction: table(commentReactions, ['userId', 'commentId']),
      videoLike: table(videoLikes, ['userId', 'videoId']),
      videoDislike: table(videoDislikes, ['userId', 'videoId']),
      comment: counter(comment as unknown as Record<string, number>),
      video: counter(video as unknown as Record<string, number>),
    } as any,
    commentReactions,
    comment,
    video,
  };
}

describe('setCommentReaction (target state, race-safe)', () => {
  let fake: ReturnType<typeof createFakeDb>;
  let repo: CommentRepository;

  beforeEach(() => {
    fake = createFakeDb();
    repo = new CommentRepository(fake.db);
  });

  it('counts a double-clicked like once', async () => {
    await Promise.all([
      repo.setCommentReaction('u1', 'c1', 'LIKE'),
      repo.setCommentReaction('u1', 'c1', 'LIKE'),
    ]);
    expect(fake.commentReactions).toHaveLength(1);
    expect(fake.comment.likesCount).toBe(1);
  });

  it('switching LIKE -> DISLIKE removes the like from the counter (dislikes have none)', async () => {
    await repo.setCommentReaction('u1', 'c1', 'LIKE');
    const { likeDelta } = await repo.setCommentReaction('u1', 'c1', 'DISLIKE');
    expect(likeDelta).toBe(-1);
    expect(fake.comment.likesCount).toBe(0);
    expect(fake.commentReactions).toEqual([{ userId: 'u1', commentId: 'c1', type: 'DISLIKE' }]);
  });

  it('clearing twice changes the counter once and never goes below zero', async () => {
    await repo.setCommentReaction('u1', 'c1', 'LIKE');
    await repo.setCommentReaction('u1', 'c1', null);
    const second = await repo.setCommentReaction('u1', 'c1', null);
    expect(second.likeDelta).toBe(0);
    expect(fake.comment.likesCount).toBe(0);
    expect(fake.commentReactions).toHaveLength(0);
  });

  it('reports a new like (for the notification) only when one was actually added', async () => {
    expect((await repo.setCommentReaction('u1', 'c1', 'LIKE')).likeDelta).toBe(1);
    expect((await repo.setCommentReaction('u1', 'c1', 'LIKE')).likeDelta).toBe(0);
  });
});

describe('setVideoReaction (target state, race-safe)', () => {
  it('a repeated like keeps one like; switching to dislike moves both counters', async () => {
    const fake = createFakeDb();
    const repo = new CommentRepository(fake.db);

    await Promise.all([repo.setVideoReaction('u1', 'v1', 'LIKE'), repo.setVideoReaction('u1', 'v1', 'LIKE')]);
    expect(fake.video).toMatchObject({ likesCount: 1, dislikesCount: 0 });

    await repo.setVideoReaction('u1', 'v1', 'DISLIKE');
    expect(fake.video).toMatchObject({ likesCount: 0, dislikesCount: 1 });

    await repo.setVideoReaction('u1', 'v1', null);
    await repo.setVideoReaction('u1', 'v1', null);
    expect(fake.video).toMatchObject({ likesCount: 0, dislikesCount: 0 });
  });
});

describe('reaction pair lock (DB-10, DB-11)', () => {
  it('takes the (user, target) advisory lock before touching any reaction row', async () => {
    const order: string[] = [];
    const fake = createFakeDb();
    fake.db.$executeRaw = async (_strings: TemplateStringsArray, key: string) => {
      order.push(`lock:${key}`);
      return 1;
    };
    const original = fake.db.videoDislike.deleteMany;
    fake.db.videoDislike.deleteMany = async (args: unknown) => {
      order.push('deleteDislike');
      return original(args);
    };
    const repo = new CommentRepository(fake.db);

    await repo.setVideoReaction('u1', 'v1', 'LIKE');
    await repo.setCommentReaction('u1', 'c1', null);

    expect(order[0]).toBe('lock:reaction:video:u1:v1');
    expect(order[1]).toBe('deleteDislike');
    expect(order).toContain('lock:reaction:comment:u1:c1');
  });
});
