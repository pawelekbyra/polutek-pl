import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: vi.fn(), user: { findUnique: vi.fn() } } }));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: vi.fn(), currentUser: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/modules/users/infrastructure/user-admin.service', () => ({ UserAdminService: { isConfiguredAdmin: vi.fn().mockReturnValue(false) } }));
vi.mock('@/lib/modules/email/application/send-transactional-email.use-case', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/modules/email/application/send-transactional-email.use-case';
import { syncUser } from '@/lib/modules/users/application/sync-user.use-case';

function txWith(existingById: unknown) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValueOnce(existingById).mockResolvedValueOnce(null),
      upsert: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
    },
  };
}

describe('syncUser welcome email (lazy sync when the Clerk webhook did not arrive)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the welcome email when the sync creates the user', async () => {
    const tx = txWith(null);
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(tx));
    await syncUser('u1', 'a@b.com', 'Ann', null, 'en');
    expect(sendWelcomeEmail).toHaveBeenCalledWith('a@b.com', 'Ann', 'en');
  });

  it('does not send it for an already existing user', async () => {
    const tx = txWith({ id: 'u1', role: 'USER', email: 'a@b.com' });
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(tx));
    await syncUser('u1', 'a@b.com', 'Ann', null, 'en');
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('does not send it to a placeholder address, and a send failure does not break sync', async () => {
    const tx = txWith(null);
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(tx));
    await syncUser('u1', 'u1@clerk.local', null, null, 'en');
    expect(sendWelcomeEmail).not.toHaveBeenCalled();

    vi.mocked(sendWelcomeEmail).mockRejectedValueOnce(new Error('resend down'));
    const tx2 = txWith(null);
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(tx2));
    await expect(syncUser('u1', 'a@b.com', 'Ann', null, 'en')).resolves.toBeTruthy();
  });
});
