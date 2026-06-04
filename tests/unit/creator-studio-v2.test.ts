import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/admin/videos/route';
import { AccessTier, VideoStatus, SystemRole } from '@prisma/client';
import { NextRequest } from 'next/server';

// Mock auth and admin check
vi.mock('@/lib/auth-utils', () => ({
  verifyAdmin: vi.fn().mockResolvedValue(true),
  requireAdminForApi: vi.fn().mockResolvedValue({ adminUserId: 'user_admin', response: null }),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user_admin' }),
}));

// Mock audit log
vi.mock('@/lib/services/audit.service', () => ({
  writeAuditLog: vi.fn().mockResolvedValue({}),
}));

// Mock blob validation
vi.mock('@/lib/blob', () => ({
  isAllowedMediaUrl: vi.fn().mockReturnValue(true),
  isAllowedThumbnailUrl: vi.fn().mockReturnValue(true),
}));

describe('Creator Studio V2 - Constraints and Logic', () => {
  const creatorId = 'creator-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should block setting isMainFeatured for PATRON tier', async () => {
    const req = new NextRequest('http://localhost/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Patron Video',
        slug: 'patron-video',
        videoUrl: 'http://test.com/video.mp4',
        thumbnailUrl: 'http://test.com/thumb.jpg',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        isMainFeatured: true
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Only public and published');
  });

  it('should block setting isMainFeatured for LOGGED_IN tier', async () => {
    const req = new NextRequest('http://localhost/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Logged In Video',
        slug: 'logged-in-video',
        videoUrl: 'http://test.com/video.mp4',
        thumbnailUrl: 'http://test.com/thumb.jpg',
        tier: AccessTier.LOGGED_IN,
        status: VideoStatus.PUBLISHED,
        isMainFeatured: true
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Only public and published');
  });

  it('should block setting isMainFeatured for DRAFT status', async () => {
    const req = new NextRequest('http://localhost/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Draft Video',
        slug: 'draft-video',
        videoUrl: 'http://test.com/video.mp4',
        thumbnailUrl: 'http://test.com/thumb.jpg',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.DRAFT,
        isMainFeatured: true
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Only public and published');
  });

  it('should allow setting isMainFeatured for PUBLIC tier and PUBLISHED status', async () => {
    // We need to mock the DB transaction for success
    const mockTx = {
      creator: {
        findFirst: vi.fn().mockResolvedValue({ id: creatorId, isApproved: true }),
      },
      video: {
        create: vi.fn().mockResolvedValue({ id: 'new-video', title: 'Featured' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      }
    };

    // @ts-ignore
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => await cb(mockTx));

    const req = new NextRequest('http://localhost/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Public Published Video',
        slug: 'public-video',
        videoUrl: 'http://test.com/video.mp4',
        thumbnailUrl: 'http://test.com/thumb.jpg',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        isMainFeatured: true
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify scoped updateMany call
    expect(mockTx.video.updateMany).toHaveBeenCalledWith({
      where: {
        id: { not: 'new-video' },
        creatorId: creatorId
      },
      data: { isMainFeatured: false }
    });
  });

  it('should block setting isMainFeatured for ARCHIVED status', async () => {
    const req = new NextRequest('http://localhost/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Archived Video',
        slug: 'archived-video',
        videoUrl: 'http://test.com/video.mp4',
        thumbnailUrl: 'http://test.com/thumb.jpg',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.ARCHIVED,
        isMainFeatured: true
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Only public and published');
  });

  it('should block setting isMainFeatured for UNLISTED status', async () => {
    const req = new NextRequest('http://localhost/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unlisted Video',
        slug: 'unlisted-video',
        videoUrl: 'http://test.com/video.mp4',
        thumbnailUrl: 'http://test.com/thumb.jpg',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.UNLISTED,
        isMainFeatured: true
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Only public and published');
  });
});
