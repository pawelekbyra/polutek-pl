import { describe, it, expect, vi } from 'vitest';
import { revokePatron } from '@/lib/modules/patron/application/revoke-patron.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';

const mockRepo = {
  findUserWithPaymentTotals: vi.fn().mockResolvedValue({
      id: 'user-1',
      isPatron: true,
      patronSince: new Date(),
      patronSource: 'ADMIN',
      paymentTotals: []
  }),
  revokeActiveGrants: vi.fn(),
  updateUserPatronFields: vi.fn().mockResolvedValue({
      id: 'user-1',
      isPatron: false,
      patronSince: null,
      patronSource: null,
      paymentTotals: []
  }),
  listActiveGrants: vi.fn().mockResolvedValue([]),
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
  it('requires admin or system actor', async () => {
    const actor: Actor = { type: 'user', userId: 'u1', isPatron: true };
    const ctx = createAppContext({
        actor,
        prisma: {
            $transaction: async (fn: any) => await fn({}),
        } as any,
    });
    const result = await revokePatron({ userId: 'user-1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PATRON_ACTION');
    }
  });

  it('successfully revokes patron status for admin actor', async () => {
    const actor: Actor = { type: 'admin', userId: 'admin-1' };
    const ctx = createAppContext({
        actor,
        prisma: {
            $transaction: async (fn: any) => await fn({}),
        } as any,
    });
    const result = await revokePatron({ userId: 'user-1', note: 'test revoke' }, ctx);

    if (result.ok === false) {
        console.error('Test failed with error:', result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.data.isPatron).toBe(false);
      expect(result.data.userId).toBe('user-1');
    }
  });
});
