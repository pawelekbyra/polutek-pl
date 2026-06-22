import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users/application/sync-user-from-webhook.use-case';
import { UserProfileService } from '@/lib/services/user/profile.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    patronGrant: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock('@/lib/modules/users/infrastructure/user.repository', () => {
  const MockRepo = vi.fn();
  MockRepo.prototype.findById = vi.fn().mockResolvedValue(null);
  MockRepo.prototype.create = vi.fn().mockResolvedValue({});
  MockRepo.prototype.update = vi.fn().mockResolvedValue({});
  return {
    UserRepository: MockRepo,
  };
});

vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue({}),
  },
}));

describe('Referral Decommissioning Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SyncUserFromWebhookUseCase ignores referrerId when creating a new user', async () => {
    const ctx = {
      prisma,
      actor: { type: 'system', reason: 'test' },
      now: () => new Date(),
    } as any;

    const data = {
      id: 'user_1',
      email: 'test@example.com',
      referrerId: 'referrer_1',
    };

    await SyncUserFromWebhookUseCase.execute(ctx, data as any, 'user.created');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('UserProfileService.syncUser ignores referrerId parameter', async () => {
    const id = 'u1';
    const email = 'u1@example.com';
    const referrerId = 'ref1';

    // @ts-ignore
    await UserProfileService.syncUser(id, email, 'Name', 'img', referrerId, 'pl');

    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.not.objectContaining({
        referredBy: expect.anything(),
      }),
    }));
  });
});
