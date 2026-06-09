import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users/application/sync-user-from-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('SyncUserFromWebhookUseCase', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    patronGrant: {
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  } as any;

  const ctx = createAppContext({
    actor: { type: 'system', reason: 'clerk_webhook' },
    prisma: mockPrisma
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncUser upserts user correctly', async () => {
    const data = {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      username: 'testuser',
      imageUrl: 'http://image.com',
      language: 'en'
    };

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ ...data, role: 'USER', isPatron: false });

    await SyncUserFromWebhookUseCase.execute(ctx, data);

    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        id: data.id,
        email: data.email,
        name: data.name,
        role: 'USER',
        isPatron: false
      })
    }));
  });

  it('syncUser does not escalate role or isPatron', async () => {
    const data = {
      id: 'user_123',
      email: 'test@example.com',
    };

    mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        role: 'ADMIN',
        isPatron: true,
        name: 'Old Name'
    });

    await SyncUserFromWebhookUseCase.execute(ctx, data);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user_123' },
        data: expect.not.objectContaining({
            role: expect.anything(),
            isPatron: expect.anything()
        })
    }));
  });

  it('softDelete records audit event', async () => {
    const userId = 'user_123';

    await SyncUserFromWebhookUseCase.softDelete(ctx, userId);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            action: 'USER_SOFT_DELETED',
            targetType: 'User',
            targetId: userId
        })
    }));

    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({
            isDeleted: true,
            email: expect.stringContaining('deleted_')
        })
    }));
  });
});
