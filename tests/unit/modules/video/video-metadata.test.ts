import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/modules/shared/app-error';
import { createAdminVideo, updateAdminVideo } from '@/lib/modules/video';
import { resolveVideoMetadata } from '@/lib/modules/video/domain/video-metadata';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { normalizeTags, validateTags, VIDEO_CATEGORIES } from '@/lib/video-metadata';

describe('video metadata rules', () => {
  it('normalizes tags: trims, drops #, empties and case-insensitive duplicates', () => {
    expect(normalizeTags(['  Kot ', '#kot', 'KOT', '', '  ', '#pies  i  kot'])).toEqual(['Kot', 'pies i kot']);
  });

  it('validates the count and the length (in characters)', () => {
    expect(validateTags(Array.from({ length: 15 }, (_, i) => `t${i}`))).toBeNull();
    expect(validateTags(Array.from({ length: 16 }, (_, i) => `t${i}`))).toBe('TOO_MANY');
    expect(validateTags(['a'.repeat(30)])).toBeNull();
    expect(validateTags(['a'.repeat(31)])).toBe('TOO_LONG');
    expect(validateTags(['😀'.repeat(30)])).toBeNull();
  });

  it('resolveVideoMetadata returns only what was sent and refuses unknown values', () => {
    expect(resolveVideoMetadata({})).toEqual({});
    expect(resolveVideoMetadata({ tags: ['#a', 'A', 'b'], category: 'music', commentsMode: 'HELD' })).toEqual({ tags: ['a', 'b'], category: 'music', commentsMode: 'HELD' });
    expect(resolveVideoMetadata({ category: null })).toEqual({ category: null });
    for (const bad of [{ category: 'cats' }, { commentsMode: 'ALL' }, { tags: ['x'.repeat(31)] }, { tags: Array.from({ length: 16 }, (_, i) => `t${i}`) }]) {
      expect(resolveVideoMetadata(bad)).toBeInstanceOf(AppError);
    }
    expect(VIDEO_CATEGORIES).toContain('other');
  });
});

describe('create/update pass the metadata to the repository', () => {
  const channel = { id: 'c1', slug: 'polutek', userId: 'owner', status: 'ACTIVE' };
  const prisma = {
    video: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  } as any;
  const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'polutek';
    prisma.creator.findUnique.mockResolvedValue(channel);
  });

  it('create stores tags, category and commentsMode', async () => {
    prisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v1' }));
    const result = await createAdminVideo({ title: 'T', slug: 's', tier: 'PUBLIC', tags: ['a', 'A', 'b'], category: 'music', commentsMode: 'OFF' }, ctx);
    expect(result.ok).toBe(true);
    expect(prisma.video.create.mock.calls[0][0].data).toMatchObject({ tags: ['a', 'b'], category: 'music', commentsMode: 'OFF' });
  });

  it('create refuses a tag over the limit and writes nothing', async () => {
    const result = await createAdminVideo({ title: 'T', slug: 's', tier: 'PUBLIC', tags: ['x'.repeat(31)] }, ctx);
    expect(result.ok).toBe(false);
    expect(prisma.video.create).not.toHaveBeenCalled();
  });

  it('update stores the metadata and leaves unsent fields alone', async () => {
    const existing = { id: 'v1', creatorId: 'c1', status: 'DRAFT', tier: 'PUBLIC', assets: [] };
    prisma.video.findUnique.mockResolvedValue(existing);
    prisma.video.findFirst.mockResolvedValue({ ...existing, tags: ['a'], category: null, commentsMode: 'HELD' });
    prisma.video.updateMany.mockResolvedValue({ count: 1 });
    const result = await updateAdminVideo({ id: 'v1', tags: ['a'], commentsMode: 'HELD' }, ctx);
    expect(result.ok).toBe(true);
    const data = prisma.video.updateMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ tags: ['a'], commentsMode: 'HELD' });
    expect(data).not.toHaveProperty('category');
  });
});
