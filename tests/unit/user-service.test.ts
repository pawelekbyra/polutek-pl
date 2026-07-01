import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateUser, getOrCreateUserFromAuth, syncUser } from '@/lib/modules/users/application/sync-user.use-case';
import { UserLanguageService } from '@/lib/modules/users/application/user-language.service';
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

vi.mock('@/lib/modules/users/infrastructure/user-admin.service', () => ({
  UserAdminService: {
    isConfiguredAdmin: vi.fn().mockReturnValue(false),
  },
}));

describe('getOrCreateUserFromAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a minimal local user from session claims when Clerk user lookup fails', async () => {
    vi.mocked(currentUser).mockResolvedValue(null as never);
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn().mockRejectedValue(new Error('CLERK_USER_NOT_FOUND')),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    // We can't easily spy on syncUser because it's in the same file as getOrCreateUserFromAuth
    // and it's exported as a standalone function.
    // Instead we can check prisma calls.
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(prisma));
    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_1' } as any);

    await getOrCreateUserFromAuth('user_1', {
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
      username: 'tester',
      locale: 'pl',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user_1' },
      create: expect.objectContaining({
        email: 'user@example.com',
        name: 'Test User',
      })
    }));
  });

  it('refreshes an existing local user with Clerk session display data', async () => {
    vi.mocked(currentUser).mockResolvedValue({
        id: 'user_3',
        primaryEmailAddress: { emailAddress: 'user_3@clerk.local' },
        emailAddresses: [],
        username: null,
        fullName: null,
        firstName: null,
        lastName: null,
        imageUrl: null,
        publicMetadata: {},
        unsafeMetadata: {},
    } as any);

    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(prisma));
    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_3' } as any);

    await getOrCreateUserFromAuth('user_3', {
      email: 'real@example.com',
      first_name: 'Real',
      last_name: 'Person',
      picture: 'https://img.clerk.com/avatar.png',
      username: 'realperson',
      locale: 'pl',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user_3' },
      update: expect.objectContaining({
        email: 'real@example.com',
        name: 'Real Person',
      })
    }));
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

    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(prisma));
    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_4' } as any);

    await getOrCreateUser('user_4');

    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user_4' },
      create: expect.objectContaining({
        email: 'clerk@example.com',
        name: 'Clerk Person',
      })
    }));
  });

  it('reads Clerk default session image and camelCase name claims', async () => {
    vi.mocked(currentUser).mockResolvedValue(null as never);
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn().mockRejectedValue(new Error('CLERK_USER_NOT_FOUND')),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(prisma));
    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_5' } as any);

    await getOrCreateUserFromAuth('user_5', {
      email: 'claim@example.com',
      fullName: 'Claim Person',
      img: 'https://img.clerk.com/claim-person.png',
      username: 'user_3Ea99aSDKtt0UQKIG72VtRSWEtb',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user_5' },
      create: expect.objectContaining({
        email: 'claim@example.com',
        name: 'Claim Person',
      })
    }));
  });

  it('falls back to a stable placeholder email when claims do not include email', async () => {
    vi.mocked(currentUser).mockResolvedValue(null as never);
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn().mockRejectedValue(new Error('USER_HAS_NO_EMAIL')),
      },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(prisma));
    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_2' } as any);

    await getOrCreateUserFromAuth('user_2', { sub: 'user_2' });

    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user_2' },
      create: expect.objectContaining({
        email: 'user_2@clerk.local',
      })
    }));
  });
});


describe('syncUser', () => {
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

    const result = await syncUser('user_race', 'race@example.com', 'Race User');

    expect(result).toEqual(existingUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user_race' } });
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
