import { prisma } from '@/lib/prisma';
import { Prisma, PaymentStatus } from '@prisma/client';

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
  static async getPayments(options: PaymentFilterOptions) {
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

    const [total, items] = await Promise.all([
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
      })
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  static async getFinancialStats() {
    const succeeded = await prisma.payment.groupBy({
      by: ['currency'],
      where: { status: 'SUCCEEDED' },
      _sum: {
        amountMinor: true
      },
      _count: {
        id: true
      }
    });

    const refunded = await prisma.payment.groupBy({
      by: ['currency'],
      _sum: {
        refundedAmountMinor: true
      }
    });

    const countsPerStatus = await prisma.payment.groupBy({
      by: ['status'],
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
    const whitelist = ['createdAt', 'updatedAt', 'amountMinor', 'status'];
    if (!whitelist.includes(field)) {
      return { createdAt: 'desc' };
    }
    return { [field]: dir };
  }
}
