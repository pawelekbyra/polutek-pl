import { prisma } from '@/lib/prisma';
import { Prisma, SystemRole, PatronGrantSource } from '@prisma/client';
import { normalizePaymentTotals } from '../user-access.service';
import { AdminUserListItem, AdminUsersListResponse, USER_SORT_FIELDS, UserSortField } from './users-admin.dto';

export interface UserFilterOptions {
  query?: string;
  role?: SystemRole;
  isPatron?: boolean;
  patronSource?: PatronGrantSource;
  isDeleted?: boolean;
  language?: string;
  hasPayments?: boolean;
  hasSubscriptions?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class UsersAdminService {
  static async getUsers(options: UserFilterOptions): Promise<AdminUsersListResponse> {
    const {
      query,
      role,
      isPatron,
      patronSource,
      isDeleted,
      language,
      hasPayments,
      hasSubscriptions,
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
        language ? { language } : {},
        hasPayments ? { payments: { some: {} } } : {},
        hasSubscriptions ? { subscriptions: { some: {} } } : {},
      ]
    };

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: {
          paymentTotals: true,
          subscriptions: { take: 1 },
          _count: {
            select: {
              comments: true,
              payments: true,
              referrals: true,
              subscriptions: true
            }
          },
          payments: {
              where: { status: 'SUCCEEDED' },
              orderBy: { createdAt: 'desc' },
              take: 1
          }
        },
        orderBy: this.getOrderBy(orderBy, orderDir),
        skip,
        take: pageSize,
      })
    ]);

    const mappedItems: AdminUserListItem[] = items.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        imageUrl: user.imageUrl,
        language: user.language,
        role: user.role,
        isDeleted: user.isDeleted,
        isPatron: user.isPatron,
        patronSince: user.patronSince?.toISOString() || null,
        patronSource: user.patronSource,
        hasSubscriptions: user._count.subscriptions > 0,
        paymentCount: user._count.payments,
        paymentTotals: user.paymentTotals.map(pt => ({
            currency: pt.currency,
            totalPaidMinor: pt.amountMinor,
            // Refund logic would need more complex join or pre-calculation
            refundedAmountMinor: 0
        })),
        lastPaymentAt: user.payments[0]?.createdAt.toISOString() || null,
        referralPoints: user.referralPoints,
        referralCount: user.referralCount,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    }));

    return {
      items: mappedItems,
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
    if (!USER_SORT_FIELDS.includes(field as UserSortField)) {
      return { createdAt: 'desc' };
    }

    return { [field]: dir };
  }
}
