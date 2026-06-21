import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAdminChannelSettings,
  getAdminChannelSettingsWithDiagnostics,
  getSafeAdminChannelDiagnostics,
  updateAdminChannelSettings,
} from '@/lib/modules/channel';
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
      const ctx = createAppContext({ actor: { type: 'user', userId: '1', isPatron: false } });
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
      expect(result?.name).toBe('Test');
    });

    it('returns a tightly typed diagnostics DTO for admin channel consumers', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });
      mockPrisma.creator.findUnique.mockResolvedValueOnce({
        id: 'chan-1',
        slug: 'test-slug',
        isApproved: true,
        isPrimary: true,
      });
      mockPrisma.creator.findUnique.mockResolvedValueOnce({
        id: 'chan-1',
        slug: 'test-slug',
        name: 'Test',
        bio: null,
        bannerUrl: null,
        subscribersCount: 5,
        displaySubscribersCount: null,
        user: { id: 'admin-1', email: 'a@example.com', name: null, imageUrl: null },
      });

      const result = await getAdminChannelSettingsWithDiagnostics(ctx);

      expect(result).toEqual({
        creator: expect.objectContaining({
          id: 'chan-1',
          slug: 'test-slug',
          subscribersCount: 5,
        }),
        diagnostics: {
          configuredSlug: 'test-slug',
          mainChannelLookup: 'FOUND',
          mainChannelId: 'chan-1',
          isApproved: true,
          isPrimary: true,
          settingsRecord: 'FOUND',
        },
      });
    });

    it('throws a stable schema-mismatch code when settings lookup disappears after main lookup', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });
      mockPrisma.creator.findUnique.mockResolvedValueOnce({
        id: 'chan-1',
        slug: 'test-slug',
        isApproved: true,
        isPrimary: true,
      });
      mockPrisma.creator.findUnique.mockResolvedValueOnce(null);

      await expect(getAdminChannelSettings(ctx)).rejects.toMatchObject({
        code: 'CHANNEL_SETTINGS_RECORD_MISSING',
      });
    });

    it('maps channel and database internals to safe public diagnostics', () => {
      expect(getSafeAdminChannelDiagnostics({ code: 'CHANNEL_NOT_FOUND' })).toEqual({
        code: 'MAIN_CHANNEL_NOT_FOUND',
        message: 'Main channel configuration is missing.',
      });
      expect(getSafeAdminChannelDiagnostics({ code: 'P2022', message: 'column DATABASE_URL secret missing' })).toEqual({
        code: 'CHANNEL_SCHEMA_MISMATCH',
        message: 'Channel settings could not be read because the database shape does not match the application contract.',
      });
      expect(getSafeAdminChannelDiagnostics({ code: 'P1001', message: 'postgres://user:pass@example/db' })).toEqual({
        code: 'CHANNEL_DATABASE_ERROR',
        message: 'Channel settings could not be read because the database connection failed.',
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
  });
});
