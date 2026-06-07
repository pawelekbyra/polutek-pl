import { prisma } from '@/lib/prisma';
import { Prisma, PaymentStatus } from '@prisma/client';
import { AdminPaymentListItem, AdminPaymentsListResponse, PAYMENT_SORT_FIELDS, PaymentSortField } from './payments-admin.dto';

export interface PaymentFilterOptions {
  userId?: string;
  creatorId?: string;
  status?: PaymentStatus;
  currency?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  refundedOnly?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class PaymentsAdminService {
  static async getPayments(options: PaymentFilterOptions): Promise<AdminPaymentsListResponse> {
    const {
      userId,
      creatorId,
      status,
      currency,
      search,
      dateFrom,
      dateTo,
      refundedOnly,
      page = 1,
      pageSize = 20,
      orderBy = 'createdAt',
      orderDir = 'desc'
    } = options;

    const skip = (page - 1) * pageSize;

    const where: Prisma.PaymentWhereInput = {
      userId,
      creatorId,
      status,
      currency,
      AND: [
        search ? {
          OR: [
            { id: { contains: search, mode: 'insensitive' } },
            { stripeIntentId: { contains: search, mode: 'insensitive' } },
            { stripeSessionId: { contains: search, mode: 'insensitive' } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { user: { id: { contains: search, mode: 'insensitive' } } },
          ]
        } : {},
        dateFrom ? { createdAt: { gte: dateFrom } } : {},
        dateTo ? { createdAt: { lte: dateTo } } : {},
        refundedOnly ? { refundedAmountMinor: { gt: 0 } } : {},
      ]
    };

    const [total, items, financialStats] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
              imageUrl: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: this.getOrderBy(orderBy, orderDir),
        skip,
        take: pageSize,
      }),
      this.getFinancialStats(where)
    ]);

    const mappedItems: AdminPaymentListItem[] = items.map(p => ({
        id: p.id,
        userId: p.userId,
        email: p.user.email,
        userName: p.user.name || p.user.username,
        amountMinor: p.amountMinor,
        refundedAmountMinor: p.refundedAmountMinor,
        currency: p.currency,
        status: p.status,
        stripeIntentId: p.stripeIntentId,
        stripeSessionId: p.stripeSessionId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        metadata: p.metadata,
        creator: p.creator ? {
          id: p.creator.id,
          name: p.creator.name,
          slug: p.creator.slug,
        } : null
    }));

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: {
          totalSucceeded: financialStats.succeeded.map(s => ({ currency: s.currency, amountMinor: s.totalAmount })),
          totalRefunded: financialStats.refunded.map(r => ({ currency: r.currency, amountMinor: r.totalAmount })),
          countByStatus: financialStats.statusCounts.reduce((acc, curr) => ({ ...acc, [curr.status]: curr.count }), {})
      }
    };
  }

  static async getFinancialStats(where: Prisma.PaymentWhereInput = {}) {
    const succeededWhere = { ...where, status: 'SUCCEEDED' as const };

    const succeeded = await prisma.payment.groupBy({
      by: ['currency'],
      where: succeededWhere,
      _sum: {
        amountMinor: true
      },
      _count: {
        id: true
      }
    });

    const refunded = await prisma.payment.groupBy({
      by: ['currency'],
      where,
      _sum: {
        refundedAmountMinor: true
      }
    });

    const countsPerStatus = await prisma.payment.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true
      }
    });

    return {
      succeeded: succeeded.map(s => ({
        currency: s.currency,
        totalAmount: s._sum.amountMinor || 0,
        count: s._count.id
      })),
      refunded: refunded.map(r => ({
        currency: r.currency,
        totalAmount: r._sum.refundedAmountMinor || 0
      })),
      statusCounts: countsPerStatus.map(c => ({
        status: c.status,
        count: c._count.id
      }))
    };
  }

  private static getOrderBy(field: string, dir: 'asc' | 'desc'): Prisma.PaymentOrderByWithRelationInput {
    if (!PAYMENT_SORT_FIELDS.includes(field as PaymentSortField)) {
      return { createdAt: 'desc' };
    }
    return { [field]: dir };
  }
}
