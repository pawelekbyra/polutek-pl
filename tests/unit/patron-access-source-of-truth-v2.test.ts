import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserAccessProfile } from '@/lib/modules/users/application/get-user-access-profile.use-case';
import { SyncCurrentUserUseCase } from '@/lib/modules/users/application/sync-current-user.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getPatronStatus } from '@/lib/modules/patron';

vi.mock('@/lib/modules/patron', () => ({
  getPatronStatus: vi.fn(),
}));

describe('Patron Access Source of Truth (V2)', () => {
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserAccessProfile', () => {
    it('grants patron access when PatronGrant is active, even if User.isPatron cache is false', async () => {
      const ctx = createAppContext({
        prisma: prismaMock,
        actor: { type: 'admin', userId: 'admin-1' },
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        role: 'USER',
        isPatron: false, // Cache says FALSE
        isDeleted: false,
        language: 'pl',
      });

      vi.mocked(getPatronStatus).mockResolvedValue({
        ok: true,
        data: {
          userId: 'u1',
          isPatron: true,
          patronSince: new Date(),
          patronSource: 'PAYMENT' as any,
          activeGrants: [{ id: 'g1' } as any],
          normalizedTotal: 100,
        },
      });

      const profile = await getUserAccessProfile(ctx, 'u1');
      expect(profile?.isPatron).toBe(true); // Should be TRUE because of PatronGrant
    });

    it('denies patron access when PatronGrant is missing, even if User.isPatron cache is true', async () => {
      const ctx = createAppContext({
        prisma: prismaMock,
        actor: { type: 'admin', userId: 'admin-1' },
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u2',
        email: 'u2@example.com',
        role: 'USER',
        isPatron: true, // Cache says TRUE
        isDeleted: false,
        language: 'pl',
      });

      vi.mocked(getPatronStatus).mockResolvedValue({
        ok: true,
        data: {
          userId: 'u2',
          isPatron: false,
          patronSince: null,
          patronSource: null,
          activeGrants: [], // No active grants
          normalizedTotal: 0,
        },
      });

      const profile = await getUserAccessProfile(ctx, 'u2');
      expect(profile?.isPatron).toBe(false); // Should be FALSE because of missing PatronGrant
    });
  });

  describe('SyncCurrentUserUseCase', () => {
    it('respects PatronGrant truth in SyncCurrentUserUseCase', async () => {
      const ctx = createAppContext({
        prisma: prismaMock,
        actor: { type: 'user', userId: 'u1', isPatron: false },
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'u1@example.com',
        role: 'USER',
        isPatron: false, // Cache says FALSE
        isDeleted: false,
        language: 'pl',
        paymentTotals: [],
      });

      vi.mocked(getPatronStatus).mockResolvedValue({
        ok: true,
        data: {
          userId: 'u1',
          isPatron: true,
          patronSince: new Date(),
          patronSource: 'PAYMENT' as any,
          activeGrants: [{ id: 'g1' } as any],
          normalizedTotal: 100,
        },
      });

      const result = await SyncCurrentUserUseCase.execute(ctx);
      expect(result.isPatron).toBe(true);
    });
  });
});
