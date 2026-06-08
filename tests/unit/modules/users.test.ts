import { describe, it, expect, vi } from 'vitest';
import { getUserAccessProfile, getActorAccessProfile } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SystemRole } from '@prisma/client';

describe('Users Module', () => {
  it('should return user access profile', async () => {
    const mockUser = {
      id: 'user_123',
      role: SystemRole.USER,
      isPatron: true,
      isDeleted: false,
    };

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
      },
    } as any;

    const ctx = createAppContext({ prisma: mockPrisma });
    const profile = await getUserAccessProfile(ctx, 'user_123');

    expect(profile).toEqual({
      userId: 'user_123',
      role: 'USER',
      isPatron: true,
      isAdmin: false,
      isDeleted: false,
    });
  });

  it('should return null if user not found', async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const ctx = createAppContext({ prisma: mockPrisma });
    const profile = await getUserAccessProfile(ctx, 'non-existent');

    expect(profile).toBeNull();
  });

  describe('getActorAccessProfile', () => {
    it('should return null for guest actor', async () => {
      const ctx = createAppContext({ actor: { type: 'guest' } });
      const profile = await getActorAccessProfile(ctx);
      expect(profile).toBeNull();
    });

    it('should return null for system actor', async () => {
      const ctx = createAppContext({ actor: { type: 'system', reason: 'test' } });
      const profile = await getActorAccessProfile(ctx);
      expect(profile).toBeNull();
    });

    it('should return profile for valid user actor', async () => {
      const mockUser = {
        id: 'user_123',
        role: SystemRole.USER,
        isPatron: false,
        isDeleted: false,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      } as any;

      const ctx = createAppContext({
        prisma: mockPrisma,
        actor: { type: 'user', userId: 'user_123', isPatron: false }
      });
      const profile = await getActorAccessProfile(ctx);
      expect(profile?.userId).toBe('user_123');
    });

    it('should return null for soft-deleted user actor', async () => {
      const mockUser = {
        id: 'user_123',
        role: SystemRole.USER,
        isPatron: false,
        isDeleted: true,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      } as any;

      const ctx = createAppContext({
        prisma: mockPrisma,
        actor: { type: 'user', userId: 'user_123', isPatron: false }
      });
      const profile = await getActorAccessProfile(ctx);
      expect(profile).toBeNull();
    });
  });
});
