import { describe, it, expect, vi } from 'vitest';
import { recordAuditEvent } from '@/lib/modules/audit';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('Audit Module', () => {
  it('should record an audit event with the correct actor userId', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'test-audit-id' }),
      },
    } as any;

    const ctx = createAppContext({
      prisma: mockPrisma,
      actor: { type: 'admin', userId: 'admin-123' },
    });

    const input = {
      action: 'TEST_ACTION',
      targetType: 'TEST_TARGET',
      targetId: 'target-456',
      metadata: { key: 'value' },
    };

    await recordAuditEvent(ctx, input);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-123',
        action: 'TEST_ACTION',
        targetType: 'TEST_TARGET',
        targetId: 'target-456',
        metadata: { key: 'value' },
      },
    });
  });

  it('should record an audit event for a guest actor with null userId', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'test-audit-id' }),
      },
    } as any;

    const ctx = createAppContext({
      prisma: mockPrisma,
      actor: { type: 'guest' },
    });

    const input = {
      action: 'GUEST_ACTION',
    };

    await recordAuditEvent(ctx, input);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: null,
        action: 'GUEST_ACTION',
        targetType: undefined,
        targetId: undefined,
        metadata: expect.anything(), // Default JsonNull
      },
    });
  });

  it('should record an audit event with correct actor userId for user actor', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'test-audit-id' }),
      },
    } as any;

    const ctx = createAppContext({
      prisma: mockPrisma,
      actor: { type: 'user', userId: 'user-123', isPatron: false },
    });

    await recordAuditEvent(ctx, { action: 'USER_ACTION' });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorUserId: 'user-123',
        action: 'USER_ACTION',
      }),
    }));
  });

  it('should support recording event within a transaction', async () => {
    const mockTx = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'test-audit-id' }),
      },
    } as any;

    const ctx = createAppContext({
        prisma: {} as any, // Should NOT be used
        actor: { type: 'system', reason: 'maintenance' }
    });

    await recordAuditEvent(ctx, { action: 'TX_ACTION' }, mockTx);

    expect(mockTx.auditLog.create).toHaveBeenCalled();
  });
});
