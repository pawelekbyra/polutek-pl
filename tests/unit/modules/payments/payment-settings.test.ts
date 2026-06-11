import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPaymentSettings } from '@/lib/modules/payments/application/get-payment-settings.use-case';
import { updatePaymentSettings } from '@/lib/modules/payments/application/update-payment-settings.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PaymentRepository } from '@/lib/modules/payments/infrastructure/payment.repository';

const mockRepo = {
    getCurrencySettings: vi.fn(),
    upsertCurrencySetting: vi.fn(),
};

vi.mock('@/lib/modules/payments/infrastructure/payment.repository', () => {
    return {
        PaymentRepository: vi.fn().mockImplementation(function() {
            return mockRepo;
        }),
    };
});

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('Payment Settings Use Cases', () => {
  let ctx: AppContext;

  beforeEach(() => {
    vi.clearAllMocks();

    ctx = {
      actor: { type: 'admin', userId: 'admin_1' } as Actor,
      db: {
        read: {} as any,
        writeTransaction: vi.fn((cb) => cb({} as any)),
      },
      prisma: {} as any,
      now: () => new Date(),
    } as unknown as AppContext;
  });

  describe('getPaymentSettings', () => {
    it('should return default settings when no overrides exist', async () => {
      mockRepo.getCurrencySettings.mockResolvedValue([]);

      const result = await getPaymentSettings(ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
          expect(result.data.PLN.minAmount).toBe(10); // Default for PLN from lib/constants.ts
          expect(result.data.USD.minAmount).toBe(10); // Default for USD from lib/constants.ts
          // Verify response shape
          expect(result.data).toHaveProperty('PLN');
          expect(result.data.PLN).toHaveProperty('currency', 'PLN');
          expect(result.data.PLN).toHaveProperty('minAmountMinor');
      }
    });

    it('should return overridden settings when they exist', async () => {
      mockRepo.getCurrencySettings.mockResolvedValue([
        { currency: 'PLN', minAmountMinor: 2000 },
      ]);

      const result = await getPaymentSettings(ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
          expect(result.data.PLN.minAmount).toBe(20);
          expect(result.data.USD.minAmount).toBe(10); // Still default
      }
    });
  });

  describe('updatePaymentSettings', () => {
    it('should reject non-admin actors', async () => {
      ctx.actor = { type: 'user', userId: 'user_1', isPatron: false } as Actor;

      const result = await updatePaymentSettings({
        limits: [{ currency: 'PLN', minAmount: 20 }]
      }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
          expect(result.error.message).toContain('Forbidden');
      }
    });

    it('should upsert settings and record audit log for admin', async () => {
      mockRepo.getCurrencySettings.mockResolvedValue([]);

      const result = await updatePaymentSettings({
        limits: [{ currency: 'PLN', minAmount: 30 }]
      }, ctx);

      expect(result.ok).toBe(true);
      expect(mockRepo.upsertCurrencySetting).toHaveBeenCalledWith('PLN', 3000, expect.anything());
      // Verify response shape of update is same as get
      if (result.ok) {
        expect(result.data.PLN.minAmount).toBe(10); // Note: getPaymentSettings called with fresh mock repo result
      }
    });
  });
});
