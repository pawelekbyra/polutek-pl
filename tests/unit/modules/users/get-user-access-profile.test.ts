import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserAccessProfile } from '@/lib/modules/users/application/get-user-access-profile.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { UserRepository } from '@/lib/modules/users/infrastructure/user.repository';

vi.mock('@/lib/modules/users/infrastructure/user.repository', () => {
    const UserRepository = vi.fn();
    UserRepository.prototype.findById = vi.fn();
    UserRepository.prototype.create = vi.fn();
    UserRepository.prototype.update = vi.fn();
    return { UserRepository };
});

describe('getUserAccessProfile Use Case', () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      patronGrant: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
  });

  it('returns standardized profile from DB', async () => {
    const dbUser = {
        id: 'u1',
        email: 'test@example.com',
        role: 'USER',
        isPatron: true,
        isDeleted: false,
        language: 'pl'
    };
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue(dbUser as any);

    mockPrisma.patronGrant.findFirst.mockResolvedValue({ id: 'grant_1' });
    const ctx = createAppContext({ actor: { type: 'system', reason: 'test' }, prisma: mockPrisma });

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

  it('returns null for missing user', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue(null);
    const ctx = createAppContext({ actor: { type: 'system', reason: 'test' }, prisma: mockPrisma });
    const result = await getUserAccessProfile(ctx, 'u2');
    expect(result).toBeNull();
  });

  it('correctly identifies deleted user', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue({ id: 'u3', isDeleted: true, role: 'USER', isPatron: false } as any);
    const ctx = createAppContext({ actor: { type: 'system', reason: 'test' }, prisma: mockPrisma });
    const result = await getUserAccessProfile(ctx, 'u3');
    expect(result?.isDeleted).toBe(true);
  });

  it('does not treat stale User.isPatron true as patron access without an active PatronGrant', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue({
      id: 'u4',
      email: 'stale@example.com',
      role: 'USER',
      isPatron: true,
      isDeleted: false,
      language: 'pl',
    } as any);
    mockPrisma.patronGrant.findFirst.mockResolvedValue(null);
    const ctx = createAppContext({ actor: { type: 'system', reason: 'test' }, prisma: mockPrisma });

    const result = await getUserAccessProfile(ctx, 'u4');

    expect(result?.isPatron).toBe(false);
    expect(mockPrisma.patronGrant.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u4', revokedAt: null },
      select: { id: true },
    });
  });

  it('uses active PatronGrant truth even when User.isPatron cache is stale false', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue({
      id: 'u5',
      email: 'grant@example.com',
      role: 'USER',
      isPatron: false,
      isDeleted: false,
      language: 'pl',
    } as any);
    mockPrisma.patronGrant.findFirst.mockResolvedValue({ id: 'grant_5' });
    const ctx = createAppContext({ actor: { type: 'system', reason: 'test' }, prisma: mockPrisma });

    const result = await getUserAccessProfile(ctx, 'u5');

    expect(result?.isPatron).toBe(true);
  });
});
