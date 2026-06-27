import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toggleVideoLike } from '@/lib/modules/comments/application/toggle-video-like.use-case';
import { toggleVideoDislike } from '@/lib/modules/comments/application/toggle-video-dislike.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { recordAuditEvent } from '@/lib/modules/audit';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Video Interaction Use Cases', () => {
  let mockPrisma: any;
  const now = new Date('2026-01-01T12:00:00Z');
  const videoId = 'v1';
  const userId = 'u1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      videoLike: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      videoDislike: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      video: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
  });

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma, now: () => now });

  describe('toggleVideoLike', () => {
    it('denies guest', async () => {
      const result = await toggleVideoLike({ videoId }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('UNAUTHORIZED');
    });

    it('denies user without video access', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'PATRON_REQUIRED' } });
      const result = await toggleVideoLike({ videoId }, createCtx({ type: 'user', userId }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
          expect(result.error.type).toBe('FORBIDDEN');
          expect(result.error.message).toContain('Patronów');
      }
    });

    it('creates like if not exists', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
      mockPrisma.videoLike.findUnique.mockResolvedValue(null);
      mockPrisma.videoDislike.findUnique.mockResolvedValue(null);

      const result = await toggleVideoLike({ videoId }, createCtx({ type: 'user', userId }));

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.liked).toBe(true);
      expect(mockPrisma.videoLike.create).toHaveBeenCalled();
      expect(recordAuditEvent).toHaveBeenCalled();
    });

    it('removes like if exists', async () => {
      (checkVideoAccess as any).mockResolvedValue({ ok: true, data: { hasAccess: true } });
      mockPrisma.videoLike.findUnique.mockResolvedValue({ id: 'l1' });
      mockPrisma.videoDislike.findUnique.mockResolvedValue(null);

      const result = await toggleVideoLike({ videoId }, createCtx({ type: 'user', userId }));

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.liked).toBe(false);
      expect(mockPrisma.videoLike.delete).toHaveBeenCalled();
    });
  });
});
