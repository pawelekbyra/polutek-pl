import { AppContext } from "@/lib/modules/shared/app-context";

export interface AdminUsersStatsDto {
  totalUsers: number;
  activeUsers: number;
  patrons: number;
  totalPayments: number;
  totalComments: number;
  financials: Array<{
    currency: string;
    totalAmount: number;
  }>;
}

export class GetAdminUsersStatsUseCase {
  static async execute(ctx: AppContext): Promise<AdminUsersStatsDto> {
    const { prisma } = ctx;

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
}
