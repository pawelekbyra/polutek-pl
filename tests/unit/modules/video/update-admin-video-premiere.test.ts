import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateAdminVideo, createAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';

// CLAUDE.md "Premieres": the admin "Publikacja" control (Natychmiast / Premiera).
describe('updateAdminVideo premieres', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };
  const mockPrisma = {
    video: { findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  } as any;
  const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma: mockPrisma });
  const DAY = 86_400_000;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'polutek';
    mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
  });

  function givenExisting(existing: Record<string, unknown>) {
    const video = { id: 'v1', creatorId: 'c1', title: 'T', tier: 'PUBLIC', status: 'PUBLISHED', premiereAt: null, ...existing };
    mockPrisma.video.findUnique.mockResolvedValue(video);
    mockPrisma.video.findFirst.mockResolvedValue(video);
    return video;
  }

  it('rejects a newly set premiere in the past', async () => {
    givenExisting({});
    const result = await updateAdminVideo({ id: 'v1', premiereAt: new Date(Date.now() - DAY) }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_INVALID_PREMIERE');
    expect(mockPrisma.video.updateMany).not.toHaveBeenCalled();
  });

  it('stores a future premiere and records it in the audit metadata', async () => {
    givenExisting({});
    const premiereAt = new Date(Date.now() + 3 * DAY);
    const result = await updateAdminVideo({ id: 'v1', premiereAt }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ premiereAt }),
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ premiereAt: premiereAt.toISOString() }),
      }),
    }));
  });

  it('accepts resubmitting a premiere that already passed, unchanged', async () => {
    const past = new Date(Date.now() - DAY);
    givenExisting({ premiereAt: past });
    const result = await updateAdminVideo({ id: 'v1', premiereAt: new Date(past), title: 'New' }, ctx);
    expect(result.ok).toBe(true);
  });

  it('"Natychmiast" on an upcoming premiere clears it and dates the video now', async () => {
    givenExisting({ premiereAt: new Date(Date.now() + DAY), publishedAt: new Date(Date.now() - 5 * DAY) });
    const before = Date.now();
    const result = await updateAdminVideo({ id: 'v1', premiereAt: null }, ctx);

    expect(result.ok).toBe(true);
    const data = mockPrisma.video.updateMany.mock.calls[0][0].data;
    expect(data.premiereAt).toBeNull();
    expect(data.publishedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('never takes publishedAt from the request', async () => {
    givenExisting({});
    await updateAdminVideo({ id: 'v1', title: 'x', publishedAt: new Date(0) }, ctx);
    expect(mockPrisma.video.updateMany.mock.calls[0][0].data.publishedAt).toBeUndefined();
  });

  it('"Premiera" on a draft goes through the publish use case and keeps its blockers', async () => {
    givenExisting({ status: 'DRAFT', assets: [] });
    const premiereAt = new Date(Date.now() + 3 * DAY);
    const result = await updateAdminVideo({ id: 'v1', status: VideoStatus.PUBLISHED, premiereAt }, ctx);

    // The premiere is saved; publication is refused because the draft has no READY asset.
    expect(mockPrisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ premiereAt }),
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.name).toBe('VideoNotReadyForPublicationError');
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });
});

describe('createAdminVideo premieres', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };
  const mockPrisma = {
    video: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
  } as any;
  const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma: mockPrisma });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'polutek';
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
  });

  it('rejects a premiere in the past before touching the database', async () => {
    const result = await createAdminVideo(
      { title: 'T', slug: 't', tier: AccessTier.PUBLIC, premiereAt: new Date(Date.now() - 60_000) },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_INVALID_PREMIERE');
    expect(mockPrisma.video.create).not.toHaveBeenCalled();
  });
});
