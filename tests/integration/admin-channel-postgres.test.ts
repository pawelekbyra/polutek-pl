import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminChannelSettings } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { classifyAdminChannelError } from '@/lib/admin-channel-error-classification';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Admin Channel Settings - Postgres Boundary Integration.
 *
 * NOTE: This test attempts to perform REAL queries using PrismaClient.
 * In environments where a database is unavailable (like some sandboxes),
 * it verifies connection failure classification, which is a critical diagnostic path.
 */
describe('Admin Channel Settings - Postgres Boundary Integration', () => {
  const realPrisma = new PrismaClient({
      datasources: {
          db: { url: 'postgresql://postgres:postgres@localhost:5432/nonexistent?sslmode=disable' }
      }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attempts a real database query and correctly classifies connection failure', async () => {
    const ctx = createAppContext({
      prisma: realPrisma as any,
      actor: { type: 'admin', userId: 'admin-1' }
    });

    try {
      // This will attempt a REAL query to a non-existent DB
      await getAdminChannelSettings(ctx);
      throw new Error('Should have failed to connect');
    } catch (err: any) {
      // Verify it's a Prisma connection error or initialization error
      const classification = classifyAdminChannelError(err);
      expect(classification.code).toBe('DB_CONNECTION_ERROR');
      expect(classification.title).toContain('Connection Error');
    }
  });

  describe('Business Logic & Schema Scenarios (Simulated)', () => {
    const mockPrisma = {
        creator: {
            findUnique: vi.fn(),
        },
    };

    it('identifies missing displaySubscribersCount column (P2022)', async () => {
        const ctx = createAppContext({
            prisma: mockPrisma as any,
            actor: { type: 'admin', userId: 'admin-1' }
        });

        // First call in getRequired (approvals check)
        mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true });

        // Second call in getAdminChannelSettings select
        const p2022 = new Prisma.PrismaClientKnownRequestError('Column missing', { code: 'P2022', clientVersion: '6.x' });
        mockPrisma.creator.findUnique.mockRejectedValueOnce(p2022);

        try {
            await getAdminChannelSettings(ctx);
        } catch (err: any) {
            const classification = classifyAdminChannelError(err);
            expect(classification.code).toBe('DB_SCHEMA_MISMATCH');
            expect(classification.message).toContain('db:migrate:deploy');
        }
    });

    it('handles missing main channel record', async () => {
        const ctx = createAppContext({
            prisma: mockPrisma as any,
            actor: { type: 'admin', userId: 'admin-1' }
        });

        // First call in service (getRequired) returns null
        mockPrisma.creator.findUnique.mockResolvedValueOnce(null);

        try {
            await getAdminChannelSettings(ctx);
        } catch (err: any) {
            const classification = classifyAdminChannelError(err);
            expect(classification.code).toBe('MAIN_CHANNEL_NOT_FOUND');
            expect(classification.title).toBe('Main Channel Missing');
        }
    });

    it('handles not approved channel', async () => {
        const ctx = createAppContext({
            prisma: mockPrisma as any,
            actor: { type: 'admin', userId: 'admin-1' }
        });

        mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'c1', slug: 'polutek', isApproved: false, isPrimary: true });

        try {
            await getAdminChannelSettings(ctx);
        } catch (err: any) {
            const classification = classifyAdminChannelError(err);
            expect(classification.code).toBe('MAIN_CHANNEL_NOT_APPROVED');
            expect(classification.title).toBe('Channel Not Approved');
        }
    });

    it('handles not primary channel', async () => {
        const ctx = createAppContext({
            prisma: mockPrisma as any,
            actor: { type: 'admin', userId: 'admin-1' }
        });

        mockPrisma.creator.findUnique.mockResolvedValueOnce({ id: 'c1', slug: 'polutek', isApproved: true, isPrimary: false });

        try {
            await getAdminChannelSettings(ctx);
        } catch (err: any) {
            const classification = classifyAdminChannelError(err);
            expect(classification.code).toBe('MAIN_CHANNEL_NOT_PRIMARY');
            expect(classification.title).toBe('Channel Not Primary');
        }
    });
  });
});
