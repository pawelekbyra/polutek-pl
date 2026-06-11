import { AppContext } from "@/lib/modules/shared/app-context";

export interface AdminUsersStatsDto {
  totalUsers: number;
  activeUsers: number;
  /** Count of distinct users with at least one active PatronGrant. */
  patrons: number;
  patronCountSource: 'ACTIVE_PATRON_GRANT';
  totalPayments: number;
  totalComments: number;
  financials: Array<{
    currency: string;
    totalAmount: number;
  }>;
}

export async function getAdminUsersStats(
  ctx: AppContext
): Promise<AdminUsersStatsDto> {
  const { prisma } = ctx;

  const [
    totalUsers,
    activeUsers,
    activePatronUsers,
    totalPayments,
    totalComments
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.patronGrant.findMany({
      where: { revokedAt: null },
      select: { userId: true },
      distinct: ['userId'],
    }),
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
    patrons: activePatronUsers.length,
    patronCountSource: 'ACTIVE_PATRON_GRANT',
    totalPayments,
    totalComments,
    financials: paymentTotals.map(pt => ({
        currency: pt.currency,
        totalAmount: pt._sum.amountMinor || 0
    }))
  };
}
