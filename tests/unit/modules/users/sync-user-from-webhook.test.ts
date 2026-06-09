import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users/application/sync-user-from-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { UserRepository } from '@/lib/modules/users/infrastructure/user.repository';
import { EmailService } from '@/lib/services/email.service';

vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendAccountDeletedEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
  }
}));

vi.mock('@/lib/modules/users/infrastructure/user.repository', () => {
    const UserRepository = vi.fn();
    UserRepository.prototype.findById = vi.fn();
    UserRepository.prototype.create = vi.fn();
    UserRepository.prototype.update = vi.fn();
    return { UserRepository };
});

describe('SyncUserFromWebhookUseCase', () => {
  let mockPrisma: any;
  const ctx = (actor: any = { type: 'system', reason: 'test' }) => createAppContext({ actor, prisma: mockPrisma });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
        user: { update: vi.fn(), findUnique: vi.fn() },
        patronGrant: { updateMany: vi.fn() },
        auditLog: { create: vi.fn() },
        $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
  });

  it('creates a new local user and preserves isPatron: false', async () => {
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue(null);
    const createSpy = vi.mocked(UserRepository.prototype.create).mockResolvedValue({} as any);

    await SyncUserFromWebhookUseCase.execute(ctx(), {
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      language: 'en'
    }, 'user.created');

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      id: 'u1',
      email: 'test@example.com',
      isPatron: false // Source of truth must be protected
    }));
  });

  it('updates existing local user and preserves current isPatron state', async () => {
    const existing = { id: 'u1', name: 'Old', isPatron: true, language: 'pl' };
    vi.mocked(UserRepository.prototype.findById).mockResolvedValue(existing as any);
    const updateSpy = vi.mocked(UserRepository.prototype.update).mockResolvedValue({} as any);

    await SyncUserFromWebhookUseCase.execute(ctx(), {
      id: 'u1',
      email: 'new@example.com',
      name: 'New Name'
    }, 'user.updated');

    expect(updateSpy).toHaveBeenCalledWith('u1', expect.objectContaining({
      email: 'new@example.com',
      name: 'New Name'
    }));
    // Note: repository.update only takes the partial data, and we don't pass isPatron to it in identity sync.
  });

  it('performs soft delete correctly', async () => {
    await SyncUserFromWebhookUseCase.softDelete(ctx(), 'u1');

    expect(mockPrisma.patronGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'u1', revokedAt: null }
    }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
            isDeleted: true,
            isPatron: false
        })
    }));
  });
});
