import { describe, it, expect, vi } from 'vitest';
import { recordAuditEvent } from '@/lib/modules/audit';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('recordAuditEvent Use Case', () => {
  it('calls repository with correct field mapping', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'user', userId: 'user-123' },
    });

    const result = await recordAuditEvent(ctx, {
      action: 'TEST_ACTION',
      targetType: 'VIDEO',
      targetId: 'video-1',
      metadata: { foo: 'bar' },
    });

    expect(result.id).toBe('log-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'user-123',
        action: 'TEST_ACTION',
        targetType: 'VIDEO',
        targetId: 'video-1',
        metadata: { foo: 'bar' },
        actorType: 'user',
        systemReason: null,
        requestId: null,
        ip: null,
        userAgent: null,
      },
    });
  });

  it('stores the system actor reason and the request context', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'log-2' });
    const ctx = createAppContext({
      prisma: { auditLog: { create } } as any,
      actor: { type: 'system', reason: 'stripe_webhook' },
      requestId: 'req-1',
    });

    await recordAuditEvent(ctx, { action: 'X', ip: '203.0.113.7', userAgent: 'jest' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: null,
        actorType: 'system',
        systemReason: 'stripe_webhook',
        requestId: 'req-1',
        ip: '203.0.113.7',
        userAgent: 'jest',
      }),
    });
  });

  it('lets an explicit requestId win over the context one and records guests as guest', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'log-3' });
    const ctx = createAppContext({
      prisma: { auditLog: { create } } as any,
      actor: { type: 'guest' },
      requestId: 'ctx-req',
    });

    await recordAuditEvent(ctx, { action: 'X', requestId: 'explicit' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorType: 'guest', actorUserId: null, systemReason: null, requestId: 'explicit' }),
    });
  });
});
