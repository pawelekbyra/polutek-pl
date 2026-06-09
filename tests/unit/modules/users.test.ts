import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserAccessProfile, getActorAccessProfile, updateUserLanguage, GetUserProfileUseCase, SyncCurrentUserUseCase, GetOrCreateUserUseCase } from '@/lib/modules/users';
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
          .rejects.toThrow('User user_123 is deleted');
      });
  });

  describe('GetUserProfileUseCase', () => {
    it('returns minimal profile and hides email from non-admins', async () => {
      const mockUser = {
        id: 'user_1',
        email: 'private@example.com',
        name: 'User One',
        username: 'user1',
        imageUrl: 'http://img.com',
        language: 'pl',
        isDeleted: false,
        createdAt: new Date(),
        referralCode: 'ref1',
        referralCount: 5,
        referralPoints: 100,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      } as any;

      const ctx = createAppContext({ prisma: mockPrisma, actor: { type: 'user', userId: 'user_1', isPatron: false } });
      const profile = await GetUserProfileUseCase.execute(ctx, 'user_1');

      expect(profile).toBeDefined();
      expect(profile?.id).toBe('user_1');
      expect((profile as any).email).toBeUndefined(); // Email should not be in DTO
      expect(profile?.referralCount).toBe(5);
    });

    it('returns null for deleted user when accessed by non-admin', async () => {
        const mockUser = { id: 'user_1', isDeleted: true };
        const mockPrisma = { user: { findUnique: vi.fn().mockResolvedValue(mockUser) } } as any;
        const ctx = createAppContext({ prisma: mockPrisma, actor: { type: 'user', userId: 'user_2', isPatron: false } });

        const profile = await GetUserProfileUseCase.execute(ctx, 'user_1');
        expect(profile).toBeNull();
    });
  });

  describe('SyncCurrentUserUseCase', () => {
    it('returns isPatron from DB and ignores other sources', async () => {
      const mockUser = {
        id: 'user_1',
        isPatron: true,
        language: 'en',
        paymentTotals: [{ amountMinor: 5000, currency: 'PLN' }]
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      } as any;

      // isPatron: false in actor (e.g. from clerk metadata) should be overridden by DB true
      const ctx = createAppContext({
        prisma: mockPrisma,
        actor: { type: 'user', userId: 'user_1', isPatron: false }
      });

      const result = await SyncCurrentUserUseCase.execute(ctx);

      expect(result.isPatron).toBe(true);
      expect(result.totalPaid).toBe(50); // 5000 / 100
    });
  });

  describe('GetOrCreateUserUseCase', () => {
    it('does not allow escalating isPatron or role through sync', async () => {
       const mockUser = { id: 'user_1', role: 'USER', isPatron: false };
       const mockPrisma = {
         user: {
           findUnique: vi.fn().mockResolvedValue(mockUser),
           update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockUser, ...data })),
         }
       } as any;

       const ctx = createAppContext({ prisma: mockPrisma });

       // Payload trying to escalate
       const payload = {
           id: 'user_1',
           email: 'test@test.com',
           isPatron: true,
           role: 'ADMIN'
       } as any;

       const result = await GetOrCreateUserUseCase.execute(ctx, payload);

       expect(result.role).toBe('USER');
       expect(result.isPatron).toBe(false);
       expect(mockPrisma.user.update).toHaveBeenCalledWith({
           where: { id: 'user_1' },
           data: {
               email: 'test@test.com',
               name: undefined,
               username: undefined,
               imageUrl: undefined,
               language: undefined,
           }
       });
    });
  });
});
