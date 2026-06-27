import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserAccessProfile } from '@/lib/modules/users/application/get-user-access-profile.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { UserRepository } from '@/lib/modules/users/infrastructure/user.repository';

vi.mock('@/lib/modules/users/infrastructure/user.repository', () => {
    const UserRepository = vi.fn();
    UserRepository.prototype.findById = vi.fn();
    UserRepository.prototype.create = vi.fn();
    UserRepository.prototype.update = vi.fn();
    UserRepository.prototype.hasActivePatronGrant = vi.fn();
    return { UserRepository };
});

describe('getUserAccessProfile Use Case', () => {
  let mockPrisma: any;
  const ctx = createAppContext({ actor: { type: 'system', reason: 'test' }, prisma: mockPrisma });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns standardized profile from DB', async () => {
    const dbUser = {
        id: 'u1',
        email: 'test@example.com',
        role: 'USER',
        isPatron: false,
        isDeleted: false,
        language: 'pl'
    };
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue(dbUser as any);
    vi.mocked(UserRepository.prototype.hasActivePatronGrant).mockResolvedValue(true);

    const result = await getUserAccessProfile(ctx, 'u1');

    expect(result).toEqual({
        id: 'u1',
        clerkId: 'u1',
        email: 'test@example.com',
        role: 'USER',
        isPatron: true,
        isAdmin: false,
        isDeleted: false,
        language: 'pl'
    });
  });


  it('returns non-patron when user cache is true but active PatronGrant is missing', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue({
      id: 'u-cache',
      email: 'cache@example.com',
      role: 'USER',
      isPatron: true,
      isDeleted: false,
      language: 'pl',
    } as any);
    vi.mocked(UserRepository.prototype.hasActivePatronGrant).mockResolvedValue(false);

    const result = await getUserAccessProfile(ctx, 'u-cache');

    expect(result?.isPatron).toBe(false);
  });

  it('returns null for missing user', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue(null);
    const result = await getUserAccessProfile(ctx, 'u2');
    expect(result).toBeNull();
  });

  it('correctly identifies deleted user', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue({ id: 'u3', isDeleted: true, role: 'USER' } as any);
    vi.mocked(UserRepository.prototype.hasActivePatronGrant).mockResolvedValue(false);
    const result = await getUserAccessProfile(ctx, 'u3');
    expect(result?.isDeleted).toBe(true);
  });
});
