import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/modules/shared/app-error';
import { updateAdminVideo } from '@/lib/modules/video';
import { resolveVideoMetadata } from '@/lib/modules/video/domain/video-metadata';
import { toAdminVideoDto } from '@/lib/modules/video/domain/video.dto';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { createVideoSchema, studioChaptersSchema, updateVideoSchema } from '@/lib/api/studio-schemas';

const chapters = [
  { startSeconds: 0, title: 'Wstęp' },
  { startSeconds: 30, title: 'Temat', titleEn: 'Topic' },
  { startSeconds: 120, title: 'Koniec' },
];

describe('resolveVideoMetadata: chapters', () => {
  it('leaves chapters alone when they are not sent', () => {
    expect(resolveVideoMetadata({})).toEqual({});
  });

  it('returns the cleaned list, and null for null or an empty list (clear)', () => {
    expect(resolveVideoMetadata({ chapters: [{ startSeconds: 30, title: ' B ', titleEn: null }, { startSeconds: 0, title: 'A' }, { startSeconds: 60, title: 'C' }] })).toEqual({
      chapters: [
        { startSeconds: 0, title: 'A' },
        { startSeconds: 30, title: 'B' },
        { startSeconds: 60, title: 'C' },
      ],
    });
    expect(resolveVideoMetadata({ chapters: null })).toEqual({ chapters: null });
    expect(resolveVideoMetadata({ chapters: [] })).toEqual({ chapters: null });
  });

  it('refuses a bad list with VIDEO_CHAPTERS_INVALID (400)', () => {
    for (const bad of [chapters.slice(0, 2), [{ startSeconds: 5, title: 'a' }, ...chapters.slice(1)], [chapters[0], { startSeconds: 5, title: 'x' }, chapters[2]], [chapters[0], { startSeconds: 30, title: ' ' }, chapters[2]]]) {
      const result = resolveVideoMetadata({ chapters: bad });
      expect(result).toBeInstanceOf(AppError);
      expect((result as AppError).code).toBe('VIDEO_CHAPTERS_INVALID');
      expect((result as AppError).statusCode).toBe(400);
    }
  });

  it('checks the length of the video when it is known', () => {
    expect(resolveVideoMetadata({ chapters }, { durationSeconds: 130 })).not.toBeInstanceOf(AppError);
    expect(resolveVideoMetadata({ chapters }, { durationSeconds: 125 })).toBeInstanceOf(AppError);
    expect(resolveVideoMetadata({ chapters }, { durationSeconds: null })).not.toBeInstanceOf(AppError);
    // Clearing is always fine, whatever the length.
    expect(resolveVideoMetadata({ chapters: null }, { durationSeconds: 5 })).toEqual({ chapters: null });
  });
});

describe('studio schemas: chapters', () => {
  it('accepts the shape, a null titleEn and null (clear); refuses fractions, negatives and more than 50', () => {
    expect(studioChaptersSchema.safeParse(chapters).success).toBe(true);
    expect(studioChaptersSchema.safeParse([{ startSeconds: 0, title: 'a', titleEn: null }]).success).toBe(true);
    expect(updateVideoSchema.safeParse({ chapters: null }).success).toBe(true);
    expect(updateVideoSchema.safeParse({}).success).toBe(true);
    expect(studioChaptersSchema.safeParse([{ startSeconds: 1.5, title: 'a' }]).success).toBe(false);
    expect(studioChaptersSchema.safeParse([{ startSeconds: -1, title: 'a' }]).success).toBe(false);
    expect(studioChaptersSchema.safeParse([{ startSeconds: 0, title: 'x'.repeat(201) }]).success).toBe(false);
    expect(studioChaptersSchema.safeParse(Array.from({ length: 51 }, (_, i) => ({ startSeconds: i * 10, title: 't' }))).success).toBe(false);
  });

  it('keeps chapters in the parsed update body and strips unknown fields of an entry', () => {
    const parsed = updateVideoSchema.parse({ chapters: [{ startSeconds: 0, title: 'a', secret: 'x' }] });
    expect(parsed.chapters).toEqual([{ startSeconds: 0, title: 'a' }]);
    // The create schema shares the metadata fields (the upload wizard just never sends them).
    const created = createVideoSchema.safeParse({ title: 'T', chapters });
    expect(created.success && created.data.chapters).toEqual(chapters);
  });
});

describe('updateAdminVideo: chapters', () => {
  const channel = { id: 'c1', slug: 'polutek', userId: 'owner', status: 'ACTIVE' };
  const prisma = {
    video: { findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  } as any;
  const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma });
  const existing = { id: 'v1', creatorId: 'c1', title: 'Old', slug: 'old', tier: 'PUBLIC', status: 'DRAFT', durationSeconds: 600 };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.creator.findUnique.mockResolvedValue(channel);
    prisma.video.findUnique.mockResolvedValue(existing);
    prisma.video.updateMany.mockResolvedValue({ count: 1 });
    prisma.video.findFirst.mockResolvedValue({ ...existing, chapters });
  });

  const auditData = () => prisma.auditLog.create.mock.calls[0][0].data;

  it('stores a valid list and audits only the count, never the titles', async () => {
    const result = await updateAdminVideo({ id: 'v1', chapters }, ctx);
    expect(result.ok).toBe(true);
    expect(prisma.video.updateMany.mock.calls[0][0].data.chapters).toEqual(chapters);
    const audit = auditData();
    expect(audit.action).toBe('VIDEO_UPDATED');
    expect(JSON.stringify(audit)).not.toMatch(/Wstęp|Temat|Koniec|Topic/);
    expect(audit.metadata.chaptersCount).toBe(3);
    expect(audit.metadata.changed).toContain('chapters');
    if (result.ok) expect(result.data.chapters).toEqual(chapters);
  });

  it('null clears the column with SQL NULL (Prisma.DbNull, not the JSON null)', async () => {
    const result = await updateAdminVideo({ id: 'v1', chapters: null }, ctx);
    expect(result.ok).toBe(true);
    expect(prisma.video.updateMany.mock.calls[0][0].data.chapters).toBe(Prisma.DbNull);
    expect(auditData().metadata.chaptersCount).toBeNull();
  });

  it('an update that does not mention chapters leaves them alone and out of the audit', async () => {
    const result = await updateAdminVideo({ id: 'v1', title: 'New' }, ctx);
    expect(result.ok).toBe(true);
    expect('chapters' in prisma.video.updateMany.mock.calls[0][0].data).toBe(false);
    expect('chaptersCount' in auditData().metadata).toBe(false);
  });

  it('refuses a bad list with 400 and writes nothing', async () => {
    const result = await updateAdminVideo({ id: 'v1', chapters: chapters.slice(0, 2) }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_CHAPTERS_INVALID');
      expect((result.error as AppError).statusCode).toBe(400);
    }
    expect(prisma.video.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('checks chapters against the stored length of the video', async () => {
    prisma.video.findUnique.mockResolvedValue({ ...existing, durationSeconds: 100 });
    const result = await updateAdminVideo({ id: 'v1', chapters }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_CHAPTERS_INVALID');
  });

  it('a video of another channel is not found for the writer (nothing is written)', async () => {
    prisma.video.findUnique.mockResolvedValue({ ...existing, creatorId: 'other' });
    const result = await updateAdminVideo({ id: 'v1', chapters }, ctx);
    expect(result.ok).toBe(false);
    expect(prisma.video.updateMany).not.toHaveBeenCalled();
  });
});

describe('where chapters appear', () => {
  const row = {
    id: 'v1',
    creatorId: 'c1',
    slug: 's',
    title: 'T',
    thumbnailUrl: 'x',
    tier: 'PUBLIC',
    status: 'PUBLISHED',
    views: 0,
    likesCount: 0,
    dislikesCount: 0,
    isMainFeatured: false,
    showInSidebar: false,
    sidebarOrder: 0,
    publishedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    durationSeconds: 90,
    chapters,
  };

  it('toAdminVideoDto returns the parsed chapters and the length of the video', () => {
    const dto = toAdminVideoDto(row);
    expect(dto.chapters).toEqual(chapters);
    expect(dto.durationSeconds).toBe(90);
  });

  it('toAdminVideoDto reads broken stored chapters as an empty list, and a missing column too', () => {
    expect(toAdminVideoDto({ ...row, chapters: { not: 'a list' } }).chapters).toEqual([]);
    expect(toAdminVideoDto({ ...row, chapters: null }).chapters).toEqual([]);
    const { chapters: _omit, ...without } = row;
    expect(toAdminVideoDto(without).chapters).toEqual([]);
  });

  it('the public DTO never carries chapters (they travel in the playback plan only)', () => {
    const dto = VideoContentService.mapToPublicVideoDTO(row as any);
    expect(JSON.stringify(dto)).not.toMatch(/chapters|Wstęp|Temat|Koniec/);
    expect('chapters' in (dto as object)).toBe(false);
  });
});
