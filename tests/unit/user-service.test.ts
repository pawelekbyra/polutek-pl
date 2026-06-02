import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '@/lib/services/user.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

describe('UserService.getOrCreateUserFromAuth', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a minimal local user from session claims when Clerk user lookup fails', async () => {
    vi.spyOn(UserService, 'getOrCreateUser').mockRejectedValue(new Error('CLERK_USER_NOT_FOUND'));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const syncSpy = vi.spyOn(UserService, 'syncUser').mockResolvedValue({ id: 'user_1' } as never);

    await UserService.getOrCreateUserFromAuth('user_1', {
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
      username: 'tester',
      locale: 'pl',
    });

    expect(syncSpy).toHaveBeenCalledWith(
      'user_1',
      'user@example.com',
      'Test User',
      'https://example.com/avatar.png',
      null,
      'pl',
      'tester',
      null
    );
  });

  it('falls back to a stable placeholder email when claims do not include email', async () => {
    vi.spyOn(UserService, 'getOrCreateUser').mockRejectedValue(new Error('USER_HAS_NO_EMAIL'));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const syncSpy = vi.spyOn(UserService, 'syncUser').mockResolvedValue({ id: 'user_2' } as never);

    await UserService.getOrCreateUserFromAuth('user_2', { sub: 'user_2' });

    expect(syncSpy).toHaveBeenCalledWith(
      'user_2',
      'user_2@clerk.local',
      null,
      null,
      null,
      'en',
      null,
      null
    );
  });
});
