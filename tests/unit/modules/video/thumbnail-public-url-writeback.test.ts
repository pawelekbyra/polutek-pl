import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Incident 2026-09-30: the admin edit form loaded a published video's public
// thumbnail src (https://<public host>/<key>) and saved it back into
// Video.thumbnailUrl. The public sync then saw no private key, cleared
// thumbnailPublicUrl and deleted the public object, breaking the image.

const r2 = vi.hoisted(() => ({
  copyToPublic: vi.fn(),
  deletePublic: vi.fn(),
  deletePrivate: vi.fn(),
  listPublicObjects: vi.fn(),
}));

vi.mock('@/lib/modules/media/infrastructure/r2-thumbnail-storage.client', () => {
  class R2ThumbnailStorageClient {
    static isConfigured = () => true;
    static isPublicServingConfigured = () => Boolean(process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC);
    copyToPublic = r2.copyToPublic;
    deletePublic = r2.deletePublic;
    deletePrivate = r2.deletePrivate;
    listPublicObjects = r2.listPublicObjects;
  }
  return { R2ThumbnailStorageClient };
});

import { isDerivedThumbnailUrl } from '@/lib/modules/media';
import { updateAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import {
  reconcilePublicThumbnails,
  syncPublicThumbnail,
} from '@/lib/modules/video/application/sync-public-thumbnail.service';

const ENV = {
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: 'priv',
  CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC: 'pub',
  NEXT_PUBLIC_R2_PUBLIC_HOST: 'thumbs.example.com',
};
const KEY = 'videos/v1/covers/abc.webp';
const privateUrl = (k: string) => `https://acct.r2.cloudflarestorage.com/priv/${k}`;
const publicUrl = (k: string) => `https://thumbs.example.com/${k}`;
const OLD = new Date(Date.now() - 2 * 60 * 60 * 1000);

const saved = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, ENV);
  r2.copyToPublic.mockImplementation(async (key: string) => publicUrl(key));
});
afterEach(() => {
  process.env = { ...saved };
});

describe('isDerivedThumbnailUrl', () => {
  it('flags the proxy path and public-host URLs, not storage values', () => {
    expect(isDerivedThumbnailUrl('/api/videos/v1/thumbnail', process.env)).toBe(true);
    expect(isDerivedThumbnailUrl(publicUrl(KEY), process.env)).toBe(true);
    expect(isDerivedThumbnailUrl(privateUrl(KEY), process.env)).toBe(false);
    expect(isDerivedThumbnailUrl('https://old.example.com/x.webp', process.env)).toBe(false);
    expect(isDerivedThumbnailUrl('/logo.png', process.env)).toBe(false);
    expect(isDerivedThumbnailUrl('', process.env)).toBe(false);
    expect(isDerivedThumbnailUrl(null, process.env)).toBe(false);
  });
});

describe('updateAdminVideo never stores a public-host thumbnail URL', () => {
  function makePrisma(existing: Record<string, unknown>) {
    const prisma: any = {
      video: {
        findUnique: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      auditLog: { create: vi.fn() },
      appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
      creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue({ id: 'c1', slug: 'polutek', status: 'ACTIVE' }) },
    };
    prisma.$transaction = vi.fn((cb: any) => cb(prisma));
    return prisma;
  }

  it('saving the form with the loaded public src keeps the private URL and deletes nothing', async () => {
    const existing = {
      id: 'v1', creatorId: 'c1', title: 'Old', tier: 'PUBLIC', status: 'PUBLISHED',
      thumbnailUrl: privateUrl(KEY), thumbnailPublicUrl: publicUrl(KEY),
    };
    const prisma = makePrisma(existing);
    const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma });

    const result = await updateAdminVideo({ id: 'v1', title: 'New', thumbnailUrl: publicUrl(KEY) }, ctx);

    expect(result.ok).toBe(true);
    const data = prisma.video.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('thumbnailUrl');
    expect(r2.deletePrivate).not.toHaveBeenCalled();
    expect(r2.deletePublic).not.toHaveBeenCalled();
  });
});

describe('public sync with a public URL stored in thumbnailUrl (corrupt row)', () => {
  it('skips instead of demoting and deleting the object', async () => {
    const update = vi.fn();
    const ctx = { prisma: { video: { update, count: vi.fn(async () => 0) } } } as any;

    const action = await syncPublicThumbnail({ id: 'v1', status: 'PUBLISHED', thumbnailUrl: publicUrl(KEY), thumbnailPublicUrl: null }, ctx);

    expect(action).toBe('skipped');
    expect(update).not.toHaveBeenCalled();
    expect(r2.deletePublic).not.toHaveBeenCalled();
  });

  it('demotion keeps a public object another row still stores in thumbnailUrl', async () => {
    const count = vi.fn(async (_args: any) => 1);
    const ctx = { prisma: { video: { update: vi.fn(), count } } } as any;

    await syncPublicThumbnail({ id: 'v2', status: 'DRAFT', thumbnailUrl: privateUrl(KEY), thumbnailPublicUrl: publicUrl(KEY) }, ctx);

    expect(r2.deletePublic).not.toHaveBeenCalled();
    const where = (count.mock.calls[0] as any[])[0].where;
    expect(where.OR).toEqual(expect.arrayContaining([{ thumbnailUrl: publicUrl(KEY) }]));
  });
});

describe('reconcilePublicThumbnails never deletes a still-referenced object', () => {
  const rows = [
    // incident shape: public URL stored in thumbnailUrl, nothing advertised
    { id: 'a', status: 'PUBLISHED', thumbnailUrl: publicUrl('videos/a/covers/1.webp'), thumbnailPublicUrl: null },
    // published, copy exists but not recorded yet
    { id: 'b', status: 'PUBLISHED', thumbnailUrl: privateUrl('videos/b/covers/2.webp'), thumbnailPublicUrl: null },
    // draft: its private key must NOT protect a public copy
    { id: 'c', status: 'DRAFT', thumbnailUrl: privateUrl('videos/c/covers/3.webp'), thumbnailPublicUrl: null },
  ];

  function setup() {
    r2.listPublicObjects.mockResolvedValue([
      { key: 'videos/a/covers/1.webp', lastModified: OLD },
      { key: 'videos/b/covers/2.webp', lastModified: OLD },
      { key: 'videos/c/covers/3.webp', lastModified: OLD },
      { key: 'videos/gone/covers/4.webp', lastModified: OLD },
    ]);
    const video = {
      findMany: vi.fn(async () => rows),
      // sync promotes "b" (copyToPublic is mocked); keep the DB writes inert
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    };
    return { ctx: { prisma: { video } } as any, video };
  }

  it('keeps objects referenced by thumbnailUrl (public form, or a published private key)', async () => {
    const { ctx } = setup();
    const result = await reconcilePublicThumbnails(ctx);

    const deleted = r2.deletePublic.mock.calls.map((c) => c[0]);
    expect(deleted).not.toContain('videos/a/covers/1.webp');
    expect(deleted).not.toContain('videos/b/covers/2.webp');
    expect(deleted).toEqual(expect.arrayContaining(['videos/c/covers/3.webp', 'videos/gone/covers/4.webp']));
    expect(result.publicUrlInThumbnailUrl).toBe(1);
    expect(result.orphansKeptReferenced).toBe(2);
  });

  it('dry-run reports without syncing or deleting', async () => {
    const { ctx, video } = setup();
    const result = await reconcilePublicThumbnails(ctx, { dryRun: true });

    expect(result).toMatchObject({ dryRun: true, orphansDeleted: 2, orphansKeptReferenced: 2, publicUrlInThumbnailUrl: 1 });
    expect(r2.deletePublic).not.toHaveBeenCalled();
    expect(r2.copyToPublic).not.toHaveBeenCalled();
    expect(video.update).not.toHaveBeenCalled();
  });
});
