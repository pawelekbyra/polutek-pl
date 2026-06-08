import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserAccessProfile, getActorAccessProfile, updateUserLanguage } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SystemRole } from '@prisma/client';

describe('Users Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
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

  describe('updateUserLanguage', () => {
    const mockIdentityProvider = {
        getUserSyncData: vi.fn().mockResolvedValue({
            email: 'test@example.com',
            name: 'Test User',
            username: 'testuser',
            imageUrl: 'http://image.com'
        }),
        updateUserMetadata: vi.fn().mockResolvedValue(undefined)
    };

    it('should update language and sync to identity provider', async () => {
      const mockUser = { id: 'user_123', email: 'test@example.com', isDeleted: false };
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
          upsert: vi.fn().mockResolvedValue({ ...mockUser, language: 'pl' }),
        },
      } as any;

      const ctx = createAppContext({ prisma: mockPrisma });
      const result = await updateUserLanguage(ctx, { userId: 'user_123', language: 'pl' }, mockIdentityProvider);

      expect(result.language).toBe('pl');
      expect(mockPrisma.user.upsert).toHaveBeenCalled();
      expect(mockIdentityProvider.updateUserMetadata).toHaveBeenCalledWith('user_123', { language: 'pl' });
    });

    it('should throw for deleted user', async () => {
        const mockUser = { id: 'user_123', isDeleted: true };
        const mockPrisma = {
          user: {
            findUnique: vi.fn().mockResolvedValue(mockUser),
          },
        } as any;

        const ctx = createAppContext({ prisma: mockPrisma });
        await expect(updateUserLanguage(ctx, { userId: 'user_123', language: 'pl' }, mockIdentityProvider))
          .rejects.toThrow('Cannot update language for deleted user');
      });
  });
});
