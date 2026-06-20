import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, Prisma, VideoStatus } from '@prisma/client';

describe('createAdminVideo use-case', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };
  const mockPrisma = {
    video: {
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    creator: { findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  } as any;

  const ctx = createAppContext({
    actor: { type: 'admin', userId: 'a1' },
    prisma: mockPrisma
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'polutek';
  });

  it('fails with MainChannelNotFoundError if no main channel', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(null);
    await expect(createAdminVideo({
        title: 'T', slug: 's', videoUrl: 'https://youtube.com/watch?v=123', thumbnailUrl: 't', tier: 'PUBLIC', status: 'PUBLISHED'
    }, ctx)).rejects.toThrow('not found in database');
  });

  it('creates video with mainChannel.id as creatorId', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v1' }));

    const result = await createAdminVideo({
        title: 'T', slug: 's', videoUrl: 'https://youtube.com/watch?v=123', thumbnailUrl: 't', tier: 'PUBLIC', status: 'PUBLISHED'
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ creatorId: 'c1' })
    }));
  });

  it('creates a safe draft without requiring a legacy videoUrl', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v-cloudflare-draft' }));

    const result = await createAdminVideo({
        title: 'Cloudflare Draft',
        slug: 'cloudflare-draft',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        videoUrl: null,
        isMainFeatured: true,
        showInSidebar: true
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            creatorId: 'c1',
            videoUrl: null,
            status: VideoStatus.DRAFT,
            showInSidebar: false,
            isMainFeatured: false,
            publishedAt: null
        })
    }));
  });


  it('strips UI-only fields before Prisma create', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v-clean' }));

    const result = await createAdminVideo({
        id: '',
        title: 'Clean Draft',
        slug: 'clean-draft',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        videoUrl: null,
        likesCount: 99,
        dislikesCount: 3,
        views: 1234,
        isMainFeatured: true,
        showInSidebar: true,
        sidebarOrder: 7
    } as any, ctx);

    expect(result.ok).toBe(true);
    const data = mockPrisma.video.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({
      title: 'Clean Draft',
      slug: 'clean-draft',
      videoUrl: null,
      thumbnailUrl: '/logo.png',
      creatorId: 'c1',
      status: VideoStatus.DRAFT,
      showInSidebar: false,
      isMainFeatured: false,
      publishedAt: null,
    }));
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('likesCount');
    expect(data).not.toHaveProperty('dislikesCount');
    expect(data).not.toHaveProperty('views');
    expect(data).not.toHaveProperty('sidebarOrder');
  });

  it('maps duplicate slug P2002 to a readable conflict error', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`slug`)',
      { code: 'P2002', clientVersion: 'test', meta: { target: ['slug'] } }
    ));

    const result = await createAdminVideo({
        title: 'Duplicate Draft',
        slug: 'duplicate-draft',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
        videoUrl: null,
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_SLUG_CONFLICT');
      expect(result.error.statusCode).toBe(409);
      expect(result.error.message).toContain('Slug jest już używany');
    }
  });

  it('uses a default thumbnail for a new Cloudflare draft when thumbnail is blank', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v-cloudflare-draft' }));

    const result = await createAdminVideo({
        title: 'Cloudflare Draft',
        slug: 'cloudflare-draft',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
        videoUrl: null,
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ thumbnailUrl: '/logo.png' })
    }));
  });

  it('returns a readable validation error when title is missing', async () => {
    const result = await createAdminVideo({
        title: '   ',
        slug: 'cloudflare-draft',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
        videoUrl: null,
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_TITLE_REQUIRED');
      expect(result.error.message).toContain('Podaj tytuł');
    }
    expect(mockPrisma.video.create).not.toHaveBeenCalled();
  });

  it('returns a readable validation error when slug is missing', async () => {
    const result = await createAdminVideo({
        title: 'Cloudflare Draft',
        slug: '   ',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
        videoUrl: null,
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_SLUG_REQUIRED');
      expect(result.error.message).toContain('slug');
    }
    expect(mockPrisma.video.create).not.toHaveBeenCalled();
  });
});
