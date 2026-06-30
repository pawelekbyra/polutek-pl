import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users/application/sync-user-from-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { sendWelcomeEmail, sendAccountDeletedEmail, sendPasswordChangedEmail } from '@/lib/modules/email';

vi.mock('@/lib/modules/email/application/send-transactional-email.use-case', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendAccountDeletedEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('SyncUserFromWebhookUseCase', () => {
  let mockPrisma: any;
  const ctx = (actor: any = { type: 'system', reason: 'test' }) => createAppContext({ actor, prisma: mockPrisma });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
        user: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
        patronGrant: { updateMany: vi.fn() },
        subscription: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        emailPreference: { deleteMany: vi.fn() },
        creator: { updateMany: vi.fn() },
        auditLog: { create: vi.fn() },
        $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
  });

  it('creates a new local user without patron fields', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await SyncUserFromWebhookUseCase.execute(ctx(), {
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      language: 'en'
    }, 'user.created');

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'u1',
        email: 'test@example.com',
      }),
    });
    expect(mockPrisma.user.create.mock.calls[0][0].data).not.toHaveProperty('isPatron');
  });

  it('updates existing local user and preserves current isPatron state', async () => {
    const existing = { id: 'u1', name: 'Old', language: 'pl' };
    mockPrisma.user.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);

    await SyncUserFromWebhookUseCase.execute(ctx(), {
      id: 'u1',
      email: 'new@example.com',
      name: 'New Name'
    }, 'user.updated');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        email: 'new@example.com',
        name: 'New Name',
      }),
    });
    expect(mockPrisma.user.update.mock.calls[0][0].data).not.toHaveProperty('isPatron');
  });

  it('performs soft delete correctly with full anonymization', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'john@example.com', isDeleted: false });

    await SyncUserFromWebhookUseCase.softDelete(ctx(), 'u1');

    expect(mockPrisma.patronGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date), reason: 'Clerk user.deleted webhook' }
    }));

    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
            isDeleted: true,
            imageUrl: null,
            stripeCustomerId: null,
            name: "Usunięty Użytkownik"
        })
    }));

    const updateCall = mockPrisma.user.update.mock.calls[0][0];
    expect(updateCall.data.email).toMatch(/^deleted_.*@deleted\.com$/);
    expect(updateCall.data.username).toMatch(/^deleted_/);

    expect(sendAccountDeletedEmail).toHaveBeenCalledWith('john@example.com');
  });

  it('guarantees that softDelete never calls hard delete on user', async () => {
      mockPrisma.user.delete = vi.fn();
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'john@example.com', isDeleted: false });
      await SyncUserFromWebhookUseCase.softDelete(ctx(), 'u1');
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });
});
