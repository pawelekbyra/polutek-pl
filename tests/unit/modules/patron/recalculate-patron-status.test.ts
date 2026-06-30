import { describe, it, expect, vi } from 'vitest';
import { recalculatePatronStatus } from '@/lib/modules/patron/application/recalculate-patron-status.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { PatronGrantSource } from '@prisma/client';

const mockRepo = {
  findUserWithPaymentTotals: vi.fn(),
  listActiveGrants: vi.fn(),
};

vi.mock('@/lib/modules/patron/infrastructure/patron.repository', () => {
  return {
    PatronRepository: function() { return mockRepo; },
  };
});

describe('recalculatePatronStatus use case', () => {
  const ctx = createAppContext({
    actor: { type: 'system', reason: 'recalculate-test' },
    prisma: {} as any,
  });

  it('returns DTO based on active grants', async () => {
    const grantDate = new Date('2024-01-01');

    mockRepo.findUserWithPaymentTotals.mockResolvedValue({
      id: 'user-1',
      paymentTotals: []
    });

    mockRepo.listActiveGrants.mockResolvedValue([{
      id: 'grant-1',
      source: PatronGrantSource.STRIPE_TIP,
      createdAt: grantDate,
    }]);

    const result = await recalculatePatronStatus('user-1', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isPatron).toBe(true);
      expect(result.data.patronSince).toEqual(grantDate);
      expect(result.data.patronSource).toBe(PatronGrantSource.STRIPE_TIP);
      expect(result.data.userId).toBe('user-1');
    }
  });

  it('returns isPatron: false when no active grants exist', async () => {
    mockRepo.findUserWithPaymentTotals.mockResolvedValue({
      id: 'user-1',
      paymentTotals: []
    });

    mockRepo.listActiveGrants.mockResolvedValue([]);

    const result = await recalculatePatronStatus('user-1', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isPatron).toBe(false);
      expect(result.data.patronSince).toBeNull();
      expect(result.data.patronSource).toBeNull();
    }
  });

  it('returns UserNotFoundError when user does not exist', async () => {
    mockRepo.findUserWithPaymentTotals.mockResolvedValue(null);

    const result = await recalculatePatronStatus('nonexistent', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.name).toBe('UserNotFoundError');
    }
  });
});
