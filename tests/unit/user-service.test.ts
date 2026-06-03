import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '@/lib/services/user.service';
import { prisma } from '@/lib/prisma';
import { clerkClient, currentUser } from '@clerk/nextjs/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
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

  it('refreshes an existing local user with Clerk session display data', async () => {
    vi.spyOn(UserService, 'getOrCreateUser').mockResolvedValue({
      id: 'user_3',
      email: 'user_3@clerk.local',
      name: null,
      username: null,
      imageUrl: null,
    } as never);
    const syncSpy = vi.spyOn(UserService, 'syncUser').mockResolvedValue({ id: 'user_3' } as never);

    await UserService.getOrCreateUserFromAuth('user_3', {
      email: 'real@example.com',
      first_name: 'Real',
      last_name: 'Person',
      picture: 'https://img.clerk.com/avatar.png',
      username: 'realperson',
      locale: 'pl',
    });

    expect(syncSpy).toHaveBeenCalledWith(
      'user_3',
      'real@example.com',
      'Real Person',
      'https://img.clerk.com/avatar.png',
      null,
      'pl',
      'realperson',
      null
    );
  });

  it('fetches Clerk profile through the backend client when currentUser is unavailable', async () => {
    vi.mocked(currentUser).mockResolvedValue(null as never);
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: 'user_4',
          primaryEmailAddress: { emailAddress: 'clerk@example.com' },
          emailAddresses: [],
          username: 'clerkname',
          fullName: 'Clerk Person',
          firstName: null,
          lastName: null,
          imageUrl: 'https://img.clerk.com/clerk-person.png',
          publicMetadata: { language: 'pl' },
          unsafeMetadata: {},
        }),
      },
    } as never);
    const syncSpy = vi.spyOn(UserService, 'syncUser').mockResolvedValue({ id: 'user_4' } as never);

    await UserService.getOrCreateUser('user_4');

    expect(syncSpy).toHaveBeenCalledWith(
      'user_4',
      'clerk@example.com',
      'Clerk Person',
      'https://img.clerk.com/clerk-person.png',
      null,
      'pl',
      'clerkname',
      undefined
    );
  });

  it('reads Clerk default session image and camelCase name claims', async () => {
    vi.spyOn(UserService, 'getOrCreateUser').mockRejectedValue(new Error('CLERK_USER_NOT_FOUND'));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const syncSpy = vi.spyOn(UserService, 'syncUser').mockResolvedValue({ id: 'user_5' } as never);

    await UserService.getOrCreateUserFromAuth('user_5', {
      email: 'claim@example.com',
      fullName: 'Claim Person',
      img: 'https://img.clerk.com/claim-person.png',
      username: 'user_3Ea99aSDKtt0UQKIG72VtRSWEtb',
    });

    expect(syncSpy).toHaveBeenCalledWith(
      'user_5',
      'claim@example.com',
      'Claim Person',
      'https://img.clerk.com/claim-person.png',
      null,
      'en',
      'user_3Ea99aSDKtt0UQKIG72VtRSWEtb',
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
