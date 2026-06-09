import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdminPayments } from '@/lib/modules/payments/application/list-admin-payments.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PaymentRepository } from '@/lib/modules/payments/infrastructure/payment.repository';
import { PaymentStatus } from '@prisma/client';

const mockRepo = {
    countPayments: vi.fn(),
    findPaymentsWithRelations: vi.fn(),
    getFinancialStats: vi.fn(),
};

vi.mock('@/lib/modules/payments/infrastructure/payment.repository', () => {
    return {
        PaymentRepository: vi.fn().mockImplementation(function() {
            return mockRepo;
        }),
    };
});

describe('listAdminPayments Use Case', () => {
  let ctx: AppContext;

  beforeEach(() => {
    vi.clearAllMocks();

    ctx = {
      actor: { type: 'admin', userId: 'admin_1' } as Actor,
      db: {
        read: {} as any,
      },
      prisma: {} as any,
      now: () => new Date(),
    } as unknown as AppContext;
  });

  it('should list payments with pagination and summary', async () => {
    mockRepo.countPayments.mockResolvedValue(100);
    mockRepo.findPaymentsWithRelations.mockResolvedValue([
      {
        id: 'p1',
        userId: 'u1',
        amountMinor: 1000,
        refundedAmountMinor: 0,
        currency: 'PLN',
        status: PaymentStatus.SUCCEEDED,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeIntentId: 'si1',
        stripeSessionId: 'ss1',
        metadata: {},
        user: { email: 'u1@example.com', name: 'User 1' },
        creator: { id: 'c1', name: 'Creator 1', slug: 'c1' }
      }
    ]);
    mockRepo.getFinancialStats.mockResolvedValue({
      succeeded: [{ currency: 'PLN', totalAmount: 1000, count: 1 }],
      refunded: [{ currency: 'PLN', totalAmount: 0 }],
      statusCounts: [{ status: PaymentStatus.SUCCEEDED, count: 1 }]
    });

    const result = await listAdminPayments({ page: 2, pageSize: 10 }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.items).toHaveLength(1);
        expect(result.data.total).toBe(100);
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(10);
        expect(result.data.totalPages).toBe(10);
        expect(result.data.summary?.totalSucceeded[0].amountMinor).toBe(1000);
        expect(result.data.summary?.countByStatus[PaymentStatus.SUCCEEDED]).toBe(1);
    }
  });

  it('should apply filters and search query', async () => {
    mockRepo.countPayments.mockResolvedValue(1);
    mockRepo.findPaymentsWithRelations.mockResolvedValue([]);
    mockRepo.getFinancialStats.mockResolvedValue({ succeeded: [], refunded: [], statusCounts: [] });

    await listAdminPayments({
        search: 'test@example.com',
        status: PaymentStatus.REFUNDED,
        currency: 'USD',
        refundedOnly: true
    }, ctx);

    expect(mockRepo.findPaymentsWithRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
            status: PaymentStatus.REFUNDED,
            currency: 'USD',
            AND: expect.arrayContaining([
                expect.objectContaining({ OR: expect.any(Array) }), // Search OR block
                expect.objectContaining({ refundedAmountMinor: { gt: 0 } })
            ])
        })
      }),
      expect.anything()
    );
  });

  it('should reject non-admin actors', async () => {
    ctx.actor = { type: 'user', userId: 'user_1', isPatron: false } as Actor;

    const result = await listAdminPayments({}, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.message).toContain('Forbidden');
    }
  });
});
