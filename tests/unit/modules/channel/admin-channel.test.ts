import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminChannelSettings, updateAdminChannelSettings } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SystemRole } from '@prisma/client';

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
      const ctx = createAppContext({ actor: { type: 'user', userId: '1' } });
      await expect(getAdminChannelSettings(ctx)).rejects.toThrow('Only admins');
    });

    it('returns channel settings for admin', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });
      mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'chan-1', slug: 'test-slug', isApproved: true, isPrimary: true }); // for service check
      mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'chan-1', name: 'Test' }); // for actual return

      const result = await getAdminChannelSettings(ctx);
      expect(result.creator?.name).toBe('Test');
      expect(result.diagnostics).toEqual({
        mainChannelConfigured: true,
        mainChannelSlug: 'test-slug',
        creatorLoaded: true,
        userLoaded: false,
      });
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

    it('never writes or returns the removed channel cover (bannerUrl)', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'chan-1', slug: 'test-slug', isApproved: true, isPrimary: true });
      mockPrisma.creator.update.mockResolvedValue({ id: 'chan-1', slug: 'test-slug', name: 'New Name' });

      await updateAdminChannelSettings(ctx, { name: 'New Name', bannerUrl: 'https://example.com/cover.jpg' } as never);

      const args = mockPrisma.creator.update.mock.calls[0][0];
      expect(args.data).not.toHaveProperty('bannerUrl');
      expect(args.data.name).toBe('New Name');
      expect(args.select).not.toHaveProperty('bannerUrl');
      expect(args.select.name).toBe(true);
    });
  });

  it('does not read the removed channel cover (bannerUrl) for the settings page', async () => {
    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'admin', userId: 'admin-1' }
    });
    mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'chan-1', slug: 'test-slug', isApproved: true, isPrimary: true });
    mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'chan-1', name: 'Test' });

    await getAdminChannelSettings(ctx);

    const settingsQuery = mockPrisma.creator.findUnique.mock.calls[1][0];
    expect(settingsQuery.select).not.toHaveProperty('bannerUrl');
    expect(settingsQuery.select.bio).toBe(true);
  });
});
