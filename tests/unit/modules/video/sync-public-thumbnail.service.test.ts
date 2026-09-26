import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const r2 = vi.hoisted(() => ({
  copyToPublic: vi.fn(),
  deletePublic: vi.fn(),
  listPublicObjects: vi.fn(),
}));

vi.mock('@/lib/modules/media/infrastructure/r2-thumbnail-storage.client', () => {
  class R2ThumbnailStorageClient {
    static isConfigured = () => true;
    static isPublicServingConfigured = () => Boolean(process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC);
    copyToPublic = r2.copyToPublic;
    deletePublic = r2.deletePublic;
    listPublicObjects = r2.listPublicObjects;
  }
  return { R2ThumbnailStorageClient };
});

import {
  syncPublicThumbnail,
  reconcilePublicThumbnails,
  removePublicThumbnailCopy,
} from '@/lib/modules/video/application/sync-public-thumbnail.service';

const ENV = {
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: 'priv',
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC: 'pub',
  NEXT_PUBLIC_R2_PUBLIC_HOST: 'cdn.example.com',
};
const privateUrl = (k: string) => `https://acct.r2.cloudflarestorage.com/priv/${k}`;
const publicUrl = (k: string) => `https://cdn.example.com/${k}`;

function makeCtx(overrides: Partial<Record<string, any>> = {}) {
  const calls: string[] = [];
  const video = {
    update: vi.fn(async (args: any) => { calls.push(`db.update:${args.data.thumbnailPublicUrl}`); return {}; }),
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
    ...overrides,
  };
  r2.deletePublic.mockImplementation(async (key: string) => { calls.push(`r2.delete:${key}`); });
  return { ctx: { prisma: { video } } as any, video, calls };
}

describe('syncPublicThumbnail', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, ENV);
    r2.copyToPublic.mockImplementation(async (key: string) => publicUrl(key));
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('copies a published video thumbnail to the public bucket and records it', async () => {
    const { ctx, video } = makeCtx();
    const action = await syncPublicThumbnail({ id: 'v1', status: 'PUBLISHED', thumbnailUrl: privateUrl('videos/v1/covers/a.webp'), thumbnailPublicUrl: null }, ctx);

    expect(action).toBe('promoted');
    expect(r2.copyToPublic).toHaveBeenCalledWith('videos/v1/covers/a.webp');
    expect(video.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { thumbnailPublicUrl: publicUrl('videos/v1/covers/a.webp') } });
  });

  it('does nothing when the public copy already matches', async () => {
    const { ctx } = makeCtx();
    const key = 'videos/v1/covers/a.webp';
    const action = await syncPublicThumbnail({ id: 'v1', status: 'PUBLISHED', thumbnailUrl: privateUrl(key), thumbnailPublicUrl: publicUrl(key) }, ctx);
    expect(action).toBe('unchanged');
    expect(r2.copyToPublic).not.toHaveBeenCalled();
  });

  it('on unpublish clears the DB column before deleting the public object', async () => {
    const { ctx, calls } = makeCtx();
    const key = 'videos/v1/covers/a.webp';
    const action = await syncPublicThumbnail({ id: 'v1', status: 'DRAFT', thumbnailUrl: privateUrl(key), thumbnailPublicUrl: publicUrl(key) }, ctx);

    expect(action).toBe('demoted');
    expect(calls).toEqual(['db.update:null', `r2.delete:${key}`]);
    expect(r2.copyToPublic).not.toHaveBeenCalled();
  });

  it('never copies a draft thumbnail to the public bucket', async () => {
    const { ctx } = makeCtx();
    await syncPublicThumbnail({ id: 'v1', status: 'DRAFT', thumbnailUrl: privateUrl('videos/v1/covers/a.webp'), thumbnailPublicUrl: null }, ctx);
    expect(r2.copyToPublic).not.toHaveBeenCalled();
  });

  it('replaces the old public copy when a published video gets a new cover', async () => {
    const { ctx, calls } = makeCtx();
    const action = await syncPublicThumbnail({
      id: 'v1', status: 'PUBLISHED',
      thumbnailUrl: privateUrl('videos/v1/covers/new.webp'),
      thumbnailPublicUrl: publicUrl('videos/v1/covers/old.webp'),
    }, ctx);

    expect(action).toBe('promoted');
    expect(calls).toEqual([`db.update:${publicUrl('videos/v1/covers/new.webp')}`, 'r2.delete:videos/v1/covers/old.webp']);
  });

  it('keeps a public object another video still references', async () => {
    const { ctx } = makeCtx({ count: vi.fn(async () => 1) });
    const key = 'videos/v1/covers/a.webp';
    await syncPublicThumbnail({ id: 'v1', status: 'ARCHIVED', thumbnailUrl: privateUrl(key), thumbnailPublicUrl: publicUrl(key) }, ctx);
    expect(r2.deletePublic).not.toHaveBeenCalled();
  });

  it('skips promotion (proxy keeps serving) when the public bucket is not configured', async () => {
    delete process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC;
    const { ctx, video } = makeCtx();
    const action = await syncPublicThumbnail({ id: 'v1', status: 'PUBLISHED', thumbnailUrl: privateUrl('videos/v1/covers/a.webp'), thumbnailPublicUrl: null }, ctx);
    expect(action).toBe('skipped');
    expect(video.update).not.toHaveBeenCalled();
  });

  it('swallows storage errors so the calling use case still succeeds', async () => {
    r2.copyToPublic.mockRejectedValue(new Error('R2 down'));
    const { ctx } = makeCtx();
    await expect(syncPublicThumbnail({ id: 'v1', status: 'PUBLISHED', thumbnailUrl: privateUrl('videos/v1/covers/a.webp'), thumbnailPublicUrl: null }, ctx)).resolves.toBe('skipped');
  });

  it('removePublicThumbnailCopy deletes the copy of a deleted video', async () => {
    const { ctx } = makeCtx();
    await removePublicThumbnailCopy(publicUrl('videos/v1/covers/a.webp'), ctx);
    expect(r2.deletePublic).toHaveBeenCalledWith('videos/v1/covers/a.webp');
  });

  it('reconcile deletes old orphans but leaves fresh objects alone', async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    r2.listPublicObjects.mockResolvedValue([
      { key: 'videos/v1/covers/a.webp', lastModified: old },
      { key: 'videos/gone/covers/x.webp', lastModified: old },
      { key: 'videos/v2/covers/fresh.webp', lastModified: new Date() },
    ]);
    const { ctx } = makeCtx({
      findMany: vi.fn()
        .mockResolvedValueOnce([{ id: 'v1', status: 'PUBLISHED', thumbnailUrl: privateUrl('videos/v1/covers/a.webp'), thumbnailPublicUrl: publicUrl('videos/v1/covers/a.webp') }])
        .mockResolvedValueOnce([{ thumbnailPublicUrl: publicUrl('videos/v1/covers/a.webp') }]),
    });

    const result = await reconcilePublicThumbnails(ctx);

    expect(result).toMatchObject({ configured: true, scanned: 1, orphansDeleted: 1 });
    expect(r2.deletePublic).toHaveBeenCalledTimes(1);
    expect(r2.deletePublic).toHaveBeenCalledWith('videos/gone/covers/x.webp');
  });
});
