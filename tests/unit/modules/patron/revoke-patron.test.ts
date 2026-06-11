import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revokePatron } from '@/lib/modules/patron/application/revoke-patron.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';

const mockRepo = {
  findUserWithPaymentTotals: vi.fn(),
  revokeActiveGrants: vi.fn(),
  revokeGrantByPaymentId: vi.fn(),
  updateUserPatronFields: vi.fn(),
  listActiveGrants: vi.fn(),
  findFirstActiveGrant: vi.fn(),
};

vi.mock('@/lib/modules/patron/infrastructure/patron.repository', () => {
  return {
    PatronRepository: function() { return mockRepo; },
  };
});

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

describe('revokePatron use case', () => {
  const actor: Actor = { type: 'admin', userId: 'admin-1' };
  const ctx = createAppContext({
      actor,
      prisma: {
          $transaction: async (fn: any) => await fn({}),
      } as any,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires admin or system actor', async () => {
    const userActor: Actor = { type: 'user', userId: 'u1', isPatron: true };
    const userCtx = createAppContext({
        actor: userActor,
        prisma: {
            $transaction: async (fn: any) => await fn({}),
        } as any,
    });
    const result = await revokePatron({ userId: 'user-1' }, userCtx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PATRON_ACTION');
    }
  });

  it('successfully revokes all patron status if no paymentId provided', async () => {
    mockRepo.findUserWithPaymentTotals.mockResolvedValue({ id: 'user-1', paymentTotals: [] });
    mockRepo.findFirstActiveGrant.mockResolvedValue(null);
    mockRepo.updateUserPatronFields.mockResolvedValue({ id: 'user-1', isPatron: false, paymentTotals: [] });
    mockRepo.listActiveGrants.mockResolvedValue([]);

    const result = await revokePatron({ userId: 'user-1', note: 'test revoke' }, ctx);

    expect(result.ok).toBe(true);
    expect(mockRepo.revokeActiveGrants).toHaveBeenCalledWith('user-1', 'test revoke', expect.anything());
    expect(mockRepo.revokeGrantByPaymentId).not.toHaveBeenCalled();
    if (result.ok === true) {
      expect(result.data.isPatron).toBe(false);
    }
  });

  it('successfully revokes specific grant if paymentId provided', async () => {
    mockRepo.findUserWithPaymentTotals.mockResolvedValue({ id: 'user-1', paymentTotals: [] });
    mockRepo.findFirstActiveGrant.mockResolvedValue({ id: 'g2', source: 'admin', createdAt: new Date() });
    mockRepo.updateUserPatronFields.mockResolvedValue({ id: 'user-1', isPatron: true, patronSource: 'admin', paymentTotals: [] });
    mockRepo.listActiveGrants.mockResolvedValue([{ id: 'g2' }]);

    const result = await revokePatron({ userId: 'user-1', paymentId: 'pay_123', note: 'refund' }, ctx);

    expect(result.ok).toBe(true);
    expect(mockRepo.revokeGrantByPaymentId).toHaveBeenCalledWith('pay_123', 'refund', expect.anything());
    expect(mockRepo.revokeActiveGrants).not.toHaveBeenCalled();
    if (result.ok === true) {
      expect(result.data.isPatron).toBe(true);
      expect(result.data.activeGrants).toHaveLength(1);
    }
  });

  it('sets isPatron to false if last grant revoked', async () => {
    mockRepo.findUserWithPaymentTotals.mockResolvedValue({ id: 'user-1', paymentTotals: [] });
    mockRepo.findFirstActiveGrant.mockResolvedValue(null);
    mockRepo.updateUserPatronFields.mockResolvedValue({ id: 'user-1', isPatron: false, paymentTotals: [] });
    mockRepo.listActiveGrants.mockResolvedValue([]);

    const result = await revokePatron({ userId: 'user-1', paymentId: 'pay_123' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.data.isPatron).toBe(false);
    }
  });
});
