import { describe, it, expect, vi } from 'vitest';
import { recalculatePatronStatus } from '@/lib/modules/patron/application/recalculate-patron-status.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { PatronGrantSource } from '@prisma/client';

const mockRepo = {
  findFirstActiveGrant: vi.fn(),
  updateUserPatronFields: vi.fn(),
  listActiveGrants: vi.fn(),
  findUserWithPaymentTotals: vi.fn(),
};

vi.mock('@/lib/modules/patron/infrastructure/patron.repository', () => {
  return {
    PatronRepository: function() { return mockRepo; },
  };
});

describe('recalculatePatronStatus use case', () => {
  it('returns DTO based on active grants, not legacy user fields', async () => {
    const grantDate = new Date('2024-01-01');
    const legacyDate = new Date('2020-01-01');

    mockRepo.findFirstActiveGrant.mockResolvedValue({
      id: 'grant-1',
      source: PatronGrantSource.STRIPE_TIP,
      createdAt: grantDate,
    });

    mockRepo.updateUserPatronFields.mockResolvedValue({
      id: 'user-1',
      isPatron: true, // legacy cache field might be set
      patronSince: legacyDate, // legacy cache field might be different
      patronSource: PatronGrantSource.ADMIN, // legacy cache field might be different
      paymentTotals: []
    });

    mockRepo.listActiveGrants.mockResolvedValue([{
      id: 'grant-1',
      source: PatronGrantSource.STRIPE_TIP,
      createdAt: grantDate,
    }]);

    const ctx = createAppContext({
      actor: { type: 'system', reason: 'recalculate-test' },
      prisma: {
        $transaction: async (fn: any) => await fn({}),
      } as any,
    });

    const result = await recalculatePatronStatus('user-1', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isPatron).toBe(true);
      expect(result.data.patronSince).toEqual(grantDate);
      expect(result.data.patronSource).toBe(PatronGrantSource.STRIPE_TIP);
    }
  });

  it('returns isPatron: false when no active grants exist', async () => {
    mockRepo.findFirstActiveGrant.mockResolvedValue(null);

    mockRepo.updateUserPatronFields.mockResolvedValue({
      id: 'user-1',
      isPatron: true, // legacy cache field is wrong
      patronSince: new Date(),
      patronSource: PatronGrantSource.ADMIN,
      paymentTotals: []
    });

    mockRepo.listActiveGrants.mockResolvedValue([]);

    const ctx = createAppContext({
      actor: { type: 'system', reason: 'recalculate-test' },
      prisma: {
        $transaction: async (fn: any) => await fn({}),
      } as any,
    });

    const result = await recalculatePatronStatus('user-1', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isPatron).toBe(false);
      expect(result.data.patronSince).toBeNull();
      expect(result.data.patronSource).toBeNull();
    }
  });
});
