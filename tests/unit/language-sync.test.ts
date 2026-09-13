import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateUserLanguage } from '@/lib/actions/user';
import { prisma } from '@/lib/prisma';
import { auth, clerkClient } from '@clerk/nextjs/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createScopedLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

describe('updateUserLanguage server action', () => {
  const userId = 'user_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates both database and Clerk metadata', async () => {
    const language = 'pl';
    const mockUser = { id: userId, email: 'test@example.com', language: 'en', isDeleted: false };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.user.upsert).mockResolvedValue({ ...mockUser, language } as any);

    const mockUpdateUserMetadata = vi.fn().mockResolvedValue({});
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        updateUserMetadata: mockUpdateUserMetadata,
      },
    } as any);

    const result = await updateUserLanguage(language);

    expect(result).toEqual({ success: true });

    // Verify DB update
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        update: expect.objectContaining({ language }),
      })
    );

    // Verify Clerk update
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(userId, {
      publicMetadata: {
        language,
      },
    });
  });

  it('does not blank the stored profile of an existing user', async () => {
    // Regression: the shared use case used to pass an explicit null for
    // name/username/imageUrl whenever the local row already had an email,
    // which wiped the display profile on every language change.
    const mockUser = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      username: 'tester',
      imageUrl: 'https://img.clerk.com/avatar.png',
      language: 'en',
      isDeleted: false,
    };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.user.upsert).mockResolvedValue({ ...mockUser, language: 'pl' } as any);
    vi.mocked(clerkClient).mockResolvedValue({
      users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
    } as any);

    await updateUserLanguage('pl');

    const updatePayload = vi.mocked(prisma.user.upsert).mock.calls[0][0].update as Record<string, unknown>;
    expect(updatePayload.name).toBeUndefined();
    expect(updatePayload.username).toBeUndefined();
    expect(updatePayload.imageUrl).toBeUndefined();
  });

  it('continues if Clerk update fails', async () => {
    const language = 'en';
    const mockUser = { id: userId, email: 'test@example.com', language: 'pl', isDeleted: false };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.user.upsert).mockResolvedValue({ ...mockUser, language } as any);

    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        updateUserMetadata: vi.fn().mockRejectedValue(new Error('Clerk API Error')),
      },
    } as any);

    const result = await updateUserLanguage(language);

    expect(result).toEqual({ success: true });
    expect(prisma.user.upsert).toHaveBeenCalled();
  });

  it('rejects a deleted user the same way the API route does', async () => {
    // Both entry points now share update-user-language.use-case, so a
    // soft-deleted account can no longer resurrect itself through the
    // server action while being rejected by PATCH /api/user/language.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: userId, isDeleted: true } as any);

    const result = await updateUserLanguage('pl');

    expect(result).toEqual(
      expect.objectContaining({
        error: 'INTERNAL_ERROR',
        message: `User ${userId} is deleted`,
      })
    );
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('returns AUTH_REQUIRED for signed-out callers', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const result = await updateUserLanguage('pl');

    expect(result).toEqual({ error: 'AUTH_REQUIRED' });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});
