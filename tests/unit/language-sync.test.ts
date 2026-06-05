import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserService } from '@/lib/services/user.service';
import { prisma } from '@/lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(),
  currentUser: vi.fn(),
}));

describe('UserService.updateUserLanguage Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates both database and Clerk metadata', async () => {
    const userId = 'user_test_123';
    const language = 'pl';
    const mockUser = { id: userId, email: 'test@example.com', language: 'en' };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.user.upsert).mockResolvedValue({ ...mockUser, language } as any);

    const mockUpdateUserMetadata = vi.fn().mockResolvedValue({});
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        updateUserMetadata: mockUpdateUserMetadata,
      },
    } as any);

    await UserService.updateUserLanguage(userId, language);

    // Verify DB update
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        update: { language },
      })
    );

    // Verify Clerk update
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(userId, {
      publicMetadata: {
        language: language,
      },
    });
  });

  it('continues if Clerk update fails', async () => {
    const userId = 'user_test_456';
    const language = 'en';
    const mockUser = { id: userId, email: 'test@example.com', language: 'pl' };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.user.upsert).mockResolvedValue({ ...mockUser, language } as any);

    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        updateUserMetadata: vi.fn().mockRejectedValue(new Error('Clerk API Error')),
      },
    } as any);

    // Should not throw
    const result = await UserService.updateUserLanguage(userId, language);

    expect(result.language).toBe(language);
    expect(prisma.user.upsert).toHaveBeenCalled();
  });
});
