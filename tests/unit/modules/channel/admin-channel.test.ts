import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminChannelSettings, updateAdminChannelSettings } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';

vi.mock('@/lib/feature-flags', () => ({
  flags: {
    mainCreatorSlug: 'test-slug'
  }
}));

describe('Channel Admin Use Cases', () => {
  const mockPrisma = {
    creator: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAdminChannelSettings', () => {
    it('throws if actor is not admin', async () => {
      const ctx = createAppContext({ actor: { type: 'user', userId: '1', isPatron: false } });
      await expect(getAdminChannelSettings(ctx)).rejects.toThrow('Only admins');
    });

    it('returns channel settings for admin', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });
      // First call in service check
      mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'chan-1', slug: 'test-slug', isApproved: true, isPrimary: true });
      // Second call for actual return
      mockPrisma.creator.findUnique.mockResolvedValueOnce({
        id: 'chan-1',
        slug: 'test-slug',
        name: 'Test',
        bio: 'Bio',
        bannerUrl: 'banner',
        subscribersCount: 10,
        displaySubscribersCount: null,
        user: { name: 'Owner', imageUrl: 'avatar' }
      });

      const result = await getAdminChannelSettings(ctx);
      expect(result.name).toBe('Test');
      expect(result.user?.name).toBe('Owner');
    });

    it('throws MainChannelNotFoundError if record disappears between check and fetch', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });
      mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'chan-1', slug: 'test-slug', isApproved: true, isPrimary: true });
      mockPrisma.creator.findUnique.mockResolvedValueOnce(null);

      await expect(getAdminChannelSettings(ctx)).rejects.toThrow(/not found/i);
      await expect(getAdminChannelSettings(ctx)).rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' });
    });
  });

  describe('updateAdminChannelSettings', () => {
    it('updates channel settings and records audit event', async () => {
       const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'chan-1', slug: 'test-slug', isApproved: true, isPrimary: true });
      mockPrisma.creator.update.mockResolvedValue({ id: 'chan-1', slug: 'test-slug', name: 'New Name' });

      const result = await updateAdminChannelSettings(ctx, { name: 'New Name' });
      expect(result.name).toBe('New Name');
      expect(mockPrisma.creator.update).toHaveBeenCalled();
    });
  });
});
