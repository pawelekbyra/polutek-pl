import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('createAdminVideo use-case', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };
  const mockPrisma = {
    video: {
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
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
        title: 'T', slug: 's', thumbnailUrl: 't', tier: 'PUBLIC', status: 'PUBLISHED'
    }, ctx)).rejects.toThrow('not found in database');
  });

  it('creates video with mainChannel.id as creatorId', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v1' }));

    const result = await createAdminVideo({
        title: 'T', slug: 's', thumbnailUrl: 't', tier: 'PUBLIC', status: 'PUBLISHED'
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ creator: { connect: { id: 'c1' } } })
    }));
  });

  it('creates a safe draft without requiring a legacy videoUrl', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v-draft' }));

    const result = await createAdminVideo({
        title: 'Draft',
        slug: 'draft',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        isMainFeatured: true,
        showInSidebar: true
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            creator: { connect: { id: 'c1' } },
            status: VideoStatus.DRAFT,
            showInSidebar: false,
            isMainFeatured: false,
            publishedAt: null
        })
    }));
  });

  it('uses a default thumbnail for a new draft when thumbnail is blank', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v-draft' }));

    const result = await createAdminVideo({
        title: 'Draft',
        slug: 'draft',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ thumbnailUrl: '/logo.png' })
    }));
  });

  it('returns a readable validation error when title is missing', async () => {
    const result = await createAdminVideo({
        title: '   ',
        slug: 'draft',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
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
        title: 'Draft',
        slug: '   ',
        thumbnailUrl: '',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_SLUG_REQUIRED');
      expect(result.error.message).toContain('slug');
    }
    expect(mockPrisma.video.create).not.toHaveBeenCalled();
  });
});
