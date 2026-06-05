import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileService } from '@/lib/services/user/profile.service';
import { UserLanguageService } from '@/lib/services/user/language.service';
import { prisma } from '@/lib/prisma';
import { clerkClient, currentUser } from '@clerk/nextjs/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
  clerkClient: vi.fn(),
}));

describe('UserProfileService.getOrCreateUserFromAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a minimal local user from session claims when Clerk user lookup fails', async () => {
    vi.spyOn(UserProfileService, 'getOrCreateUser').mockRejectedValue(new Error('CLERK_USER_NOT_FOUND'));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const syncSpy = vi.spyOn(UserProfileService, 'syncUser').mockResolvedValue({ id: 'user_1' } as never);

    await UserProfileService.getOrCreateUserFromAuth('user_1', {
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
    vi.spyOn(UserProfileService, 'getOrCreateUser').mockResolvedValue({
      id: 'user_3',
      email: 'user_3@clerk.local',
      name: null,
      username: null,
      imageUrl: null,
    } as never);
    const syncSpy = vi.spyOn(UserProfileService, 'syncUser').mockResolvedValue({ id: 'user_3' } as never);

    await UserProfileService.getOrCreateUserFromAuth('user_3', {
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
    const syncSpy = vi.spyOn(UserProfileService, 'syncUser').mockResolvedValue({ id: 'user_4' } as never);

    await UserProfileService.getOrCreateUser('user_4');

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
    vi.spyOn(UserProfileService, 'getOrCreateUser').mockRejectedValue(new Error('CLERK_USER_NOT_FOUND'));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const syncSpy = vi.spyOn(UserProfileService, 'syncUser').mockResolvedValue({ id: 'user_5' } as never);

    await UserProfileService.getOrCreateUserFromAuth('user_5', {
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
    vi.spyOn(UserProfileService, 'getOrCreateUser').mockRejectedValue(new Error('USER_HAS_NO_EMAIL'));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const syncSpy = vi.spyOn(UserProfileService, 'syncUser').mockResolvedValue({ id: 'user_2' } as never);

    await UserProfileService.getOrCreateUserFromAuth('user_2', { sub: 'user_2' });

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


describe('UserProfileService.syncUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the user created by a parallel request when upsert hits P2002', async () => {
    const existingUser = { id: 'user_race', email: 'race@example.com' };
    vi.mocked(prisma.$transaction).mockRejectedValue({ code: 'P2002' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as never);

    const result = await UserProfileService.syncUser('user_race', 'race@example.com', 'Race User');

    expect(result).toEqual(existingUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user_race' } });
    expect(prisma.user.findUnique).not.toHaveBeenCalledWith({ where: { email: 'race@example.com' } });
  });
});

describe('UserLanguageService.updateUserLanguage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('upserts language preferences for an existing local user', async () => {
    const updatedUser = { id: 'user_lang', email: 'lang@example.com', language: 'pl' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'lang@example.com' } as never);
    vi.mocked(prisma.user.upsert).mockResolvedValue(updatedUser as never);
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        updateUserMetadata: vi.fn().mockResolvedValue({}),
      },
    } as never);

    const result = await UserLanguageService.updateUserLanguage('user_lang', 'pl');

    expect(result).toEqual(updatedUser);
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'user_lang' },
      update: { language: 'pl' },
      create: expect.objectContaining({
        id: 'user_lang',
        email: 'lang@example.com',
        language: 'pl',
      }),
    });
  });
});
