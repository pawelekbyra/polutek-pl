import { describe, it, expect, vi } from 'vitest';
import { grantPatron } from '@/lib/modules/patron/application/grant-patron.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PatronGrantSource } from '@prisma/client';

const mockRepo = {
  findActiveGrantByAdmin: vi.fn(),
  findGrantByPaymentId: vi.fn(),
  findGrantByReferralId: vi.fn(),
  findUserWithPaymentTotals: vi.fn().mockResolvedValue({
      id: 'user-1',
      isPatron: false,
      patronSince: null,
      patronSource: null,
      paymentTotals: []
  }),
  updateUserPatronFields: vi.fn().mockResolvedValue({
      id: 'user-1',
      isPatron: true,
      patronSince: new Date(),
      patronSource: PatronGrantSource.ADMIN,
      paymentTotals: []
  }),
  createGrant: vi.fn(),
  listActiveGrants: vi.fn().mockResolvedValue([{ id: 'grant-1' }]),
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

  it('preserves existing patronSince when granting new status', async () => {
    const historicalDate = new Date('2020-01-01');
    mockRepo.findUserWithPaymentTotals.mockResolvedValueOnce({
        id: 'user-1',
        isPatron: false,
        patronSince: historicalDate,
        patronSource: null,
        paymentTotals: []
    });

    const actor: Actor = { type: 'admin', userId: 'admin-1' };
    const ctx = createAppContext({
        actor,
        prisma: {
            $transaction: async (fn: any) => await fn({}),
        } as any,
    });
    await grantPatron({ userId: 'user-1', source: 'admin' }, ctx);

    expect(mockRepo.updateUserPatronFields).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ isPatron: true }),
        expect.anything(),
        expect.objectContaining({ preserveExistingPatronSince: true })
    );
  });
});
