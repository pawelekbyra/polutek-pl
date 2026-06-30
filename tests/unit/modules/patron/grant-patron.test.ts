import { describe, it, expect, vi } from 'vitest';
import { grantPatron } from '@/lib/modules/patron/application/grant-patron.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';

const mockRepo = {
  findActiveGrantByAdmin: vi.fn(),
  findGrantByPaymentId: vi.fn(),
  findUserWithPaymentTotals: vi.fn().mockResolvedValue({
      id: 'user-1',
      paymentTotals: []
  }),
  createGrant: vi.fn(),
  listActiveGrants: vi.fn().mockResolvedValue([{ id: 'grant-1', createdAt: new Date(), source: 'ADMIN' }]),
};

vi.mock('@/lib/modules/patron/infrastructure/patron.repository', () => {
  return {
    PatronRepository: function() { return mockRepo; },
  };
});

describe('grantPatron use case', () => {
  it('requires admin or system actor', async () => {
    const actor: Actor = { type: 'user', userId: 'u1' };
    const ctx = createAppContext({
        actor,
        prisma: {
            $transaction: async (fn: any) => await fn({}),
        } as any,
    });
    const result = await grantPatron({ userId: 'user-1', source: 'admin' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PATRON_ACTION');
    }
  });

  it('successfully grants patron status for admin actor', async () => {
    const actor: Actor = { type: 'admin', userId: 'admin-1' };
    const ctx = createAppContext({
        actor,
        prisma: {
            $transaction: async (fn: any) => await fn({}),
        } as any,
    });
    const result = await grantPatron({ userId: 'user-1', source: 'admin', note: 'test' }, ctx);

    if (result.ok === false) {
        console.error('Test failed with error:', result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.data.isPatron).toBe(true);
      expect(result.data.userId).toBe('user-1');
    }
  });

  it('calls createGrant with correct parameters', async () => {
    vi.clearAllMocks();
    mockRepo.findUserWithPaymentTotals.mockResolvedValue({ id: 'user-1', paymentTotals: [] });
    mockRepo.listActiveGrants.mockResolvedValue([{ id: 'grant-1', createdAt: new Date(), source: 'ADMIN' }]);

    const actor: Actor = { type: 'admin', userId: 'admin-1' };
    const ctx = createAppContext({
        actor,
        prisma: {
            $transaction: async (fn: any) => await fn({}),
        } as any,
    });
    await grantPatron({ userId: 'user-1', source: 'admin', note: 'manual grant' }, ctx);

    expect(mockRepo.createGrant).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.anything()
    );
  });
});
