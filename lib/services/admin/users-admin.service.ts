import { prisma } from '@/lib/prisma';
import { Prisma, SystemRole, PatronGrantSource } from '@prisma/client';
import { normalizePaymentTotals } from '../user-access.service';

export interface UserFilterOptions {
  query?: string;
  role?: SystemRole;
  isPatron?: boolean;
  patronSource?: PatronGrantSource;
  isDeleted?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class UsersAdminService {
  static async getUsers(options: UserFilterOptions) {
    const {
      query,
      role,
      isPatron,
      patronSource,
      isDeleted,
      page = 1,
      pageSize = 20,
      orderBy = 'createdAt',
      orderDir = 'desc'
    } = options;

    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      AND: [
        query ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { username: { contains: query, mode: 'insensitive' } },
          ]
        } : {},
        role ? { role } : {},
        isPatron !== undefined ? { isPatron } : {},
        patronSource ? { patronSource } : {},
        isDeleted !== undefined ? { isDeleted } : {},
      ]
    };

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: {
          paymentTotals: true,
          _count: {
            select: {
              comments: true,
              payments: true,
              referrals: true
            }
          }
        },
        orderBy: this.getOrderBy(orderBy, orderDir),
        skip,
        take: pageSize,
      })
    ]);

    return {
      items: items.map(user => ({
        ...user,
        normalizedTotal: normalizePaymentTotals(user.paymentTotals)
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  static async getStats() {
    const [
      totalUsers,
      activeUsers,
      patrons,
      totalPayments,
      totalComments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.user.count({ where: { isPatron: true } }),
      prisma.payment.count({ where: { status: 'SUCCEEDED' } }),
      prisma.comment.count({ where: { deletedAt: null } })
    ]);

    const paymentTotals = await prisma.userPaymentTotal.groupBy({
        by: ['currency'],
        _sum: {
            amountMinor: true
        }
    });

    return {
      totalUsers,
      activeUsers,
      patrons,
      totalPayments,
      totalComments,
      financials: paymentTotals.map(pt => ({
          currency: pt.currency,
          totalAmount: pt._sum.amountMinor || 0
      }))
    };
  }

  private static getOrderBy(field: string, dir: 'asc' | 'desc'): Prisma.UserOrderByWithRelationInput {
    const whitelist = [
      'createdAt',
      'updatedAt',
      'email',
      'patronSince',
      'referralPoints',
      'referralCount'
    ];

    if (!whitelist.includes(field)) {
      return { createdAt: 'desc' };
    }

    return { [field]: dir };
  }
}
