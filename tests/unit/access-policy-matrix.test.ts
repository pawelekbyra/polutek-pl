import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessPolicy } from '@/lib/access/access-policy';
import { prisma } from '@/lib/prisma';
import { AccessTier, VideoStatus } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('AccessPolicy Media Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockVideo = (tier: AccessTier, status: VideoStatus = VideoStatus.PUBLISHED) => ({
    id: 'v1',
    tier,
    status,
    publishedAt: new Date(Date.now() - 1000),
  });

  const mockUser = (role: 'ADMIN' | 'USER', isPatron: boolean = false) => ({
    id: 'u1',
    role,
    isPatron,
    isDeleted: false,
  });

  it('GUEST -> PUBLIC Video: ALLOWED', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(mockVideo(AccessTier.PUBLIC) as any);
    const result = await AccessPolicy.canViewVideo(null, 'v1');
    expect(result.allowed).toBe(true);
  });

  it('GUEST -> PATRON Video: DENIED (LOGIN_REQUIRED)', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(mockVideo(AccessTier.PATRON) as any);
    const result = await AccessPolicy.canViewVideo(null, 'v1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('LOGIN_REQUIRED');
  });

  it('LOGGED_IN (Non-Patron) -> PATRON Video: DENIED (PATRON_REQUIRED)', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(mockVideo(AccessTier.PATRON) as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser('USER', false) as any);
    const result = await AccessPolicy.canViewVideo('u1', 'v1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('PATRON_REQUIRED');
  });

  it('PATRON -> PATRON Video: ALLOWED', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(mockVideo(AccessTier.PATRON) as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser('USER', true) as any);
    const result = await AccessPolicy.canViewVideo('u1', 'v1');
    expect(result.allowed).toBe(true);
  });

  it('GUEST -> DRAFT Video: DENIED (NOT_FOUND)', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(mockVideo(AccessTier.PUBLIC, VideoStatus.DRAFT) as any);
    const result = await AccessPolicy.canViewVideo(null, 'v1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NOT_FOUND');
  });

  it('ADMIN -> DRAFT Video: ALLOWED', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(mockVideo(AccessTier.PUBLIC, VideoStatus.DRAFT) as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser('ADMIN') as any);
    const result = await AccessPolicy.canViewVideo('u1', 'v1');
    expect(result.allowed).toBe(true);
  });

  it('USER -> Future Published Video: DENIED (NOT_FOUND)', async () => {
    const futureVideo = {
        ...mockVideo(AccessTier.PUBLIC),
        publishedAt: new Date(Date.now() + 100000)
    };
    vi.mocked(prisma.video.findUnique).mockResolvedValue(futureVideo as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser('USER') as any);
    const result = await AccessPolicy.canViewVideo('u1', 'v1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NOT_FOUND');
  });
});
