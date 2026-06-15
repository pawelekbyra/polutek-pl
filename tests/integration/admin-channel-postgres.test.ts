import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminChannelSettings } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { classifyAdminChannelError } from '@/lib/admin-channel-error-classification';
import { Prisma } from '@prisma/client';
import { MainChannelNotFoundError, MainChannelNotApprovedError, MainChannelNotPrimaryError } from '@/lib/modules/channel/domain/channel.errors';

vi.mock('@/lib/feature-flags', () => ({
  flags: {
    mainCreatorSlug: 'test-slug'
  }
}));

describe('Admin Channel Settings Error Handling Stack', () => {
  const mockPrisma = {
    creator: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Business Error Classification', () => {
    it('handles MainChannelNotFoundError', async () => {
      const err = new MainChannelNotFoundError('test-slug');
      const classification = classifyAdminChannelError(err);
      expect(classification.code).toBe('MAIN_CHANNEL_NOT_FOUND');
      expect(classification.showMaintenanceNote).toBe(true);
    });

    it('handles MainChannelNotApprovedError', async () => {
      const err = new MainChannelNotApprovedError('test-slug');
      const classification = classifyAdminChannelError(err);
      expect(classification.code).toBe('MAIN_CHANNEL_NOT_APPROVED');
      expect(classification.showMaintenanceNote).toBe(true);
    });

    it('handles MainChannelNotPrimaryError', async () => {
      const err = new MainChannelNotPrimaryError('test-slug');
      const classification = classifyAdminChannelError(err);
      expect(classification.code).toBe('MAIN_CHANNEL_NOT_PRIMARY');
      expect(classification.showMaintenanceNote).toBe(true);
    });
  });

  describe('Database Error Classification', () => {
    it('handles missing column error (P2022)', async () => {
      const p2022Error = new Prisma.PrismaClientKnownRequestError(
        'The column displaySubscribersCount does not exist',
        { code: 'P2022', clientVersion: '6.19.3' }
      );
      const classification = classifyAdminChannelError(p2022Error);
      expect(classification.code).toBe('DB_SCHEMA_MISMATCH');
    });

    it('handles missing table error (P2021)', async () => {
      const p2021Error = new Prisma.PrismaClientKnownRequestError(
        'The table Creator does not exist',
        { code: 'P2021', clientVersion: '6.19.3' }
      );
      const classification = classifyAdminChannelError(p2021Error);
      expect(classification.code).toBe('DB_SCHEMA_MISMATCH');
    });

    it('handles connection error (P1001)', async () => {
      const p1001Error = new Prisma.PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '6.19.3' }
      );
      const classification = classifyAdminChannelError(p1001Error);
      expect(classification.code).toBe('DB_CONNECTION_ERROR');
    });
  });

  describe('Full UseCase execution with simulated failures', () => {
    it('returns specific error when channel is not approved', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });

      // Simulation: Channel exists but is not approved
      mockPrisma.creator.findUnique.mockResolvedValueOnce({
        id: 'chan-1',
        slug: 'test-slug',
        isApproved: false,
        isPrimary: true
      });

      try {
        await getAdminChannelSettings(ctx);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.name).toBe('MainChannelNotApprovedError');
        const classification = classifyAdminChannelError(err);
        expect(classification.code).toBe('MAIN_CHANNEL_NOT_APPROVED');
      }
    });

    it('returns specific error when channel is not primary', async () => {
      const ctx = createAppContext({
        prisma: mockPrisma as any,
        actor: { type: 'admin', userId: 'admin-1' }
      });

      // Simulation: Channel exists but is not primary
      mockPrisma.creator.findUnique.mockResolvedValueOnce({
        id: 'chan-1',
        slug: 'test-slug',
        isApproved: true,
        isPrimary: false
      });

      try {
        await getAdminChannelSettings(ctx);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.name).toBe('MainChannelNotPrimaryError');
        const classification = classifyAdminChannelError(err);
        expect(classification.code).toBe('MAIN_CHANNEL_NOT_PRIMARY');
      }
    });
  });
});
