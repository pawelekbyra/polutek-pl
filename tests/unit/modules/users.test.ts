import { describe, it, expect, vi } from 'vitest';
import { getUserAccessProfile } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('Users Module', () => {
  it('should return user access profile', async () => {
    const mockUser = {
      id: 'user_123',
      role: 'USER',
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
});
