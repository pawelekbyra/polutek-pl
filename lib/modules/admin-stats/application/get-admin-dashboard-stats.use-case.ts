import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";

export interface AdminDashboardStatsDto {
  totalUsers: number;
  totalVideos: number;
  revenueByCurrency: Array<{
    currency: string;
    amountMinor: number;
    amount: number;
  }>;
  recentPayments: Array<{
    id: string;
    amountMinor: number;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
    userEmail: string | null | undefined;
  }>;
}

export async function getAdminDashboardStats(
  ctx: AppContext
): Promise<UseCaseResult<AdminDashboardStatsDto>> {
  const { db } = ctx;

  const [totalUsers, totalVideos, revenueByCurrency, recentPayments] = await Promise.all([
    db.read.user.count(),
    db.read.video.count(),
    db.read.payment.groupBy({
      by: ['currency'],
      where: { status: 'SUCCEEDED' },
      _sum: { amountMinor: true }
    }),
    db.read.payment.findMany({
      where: { status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    })
  ]);

  const revenueDTO = revenueByCurrency.map(r => ({
    currency: r.currency,
    amountMinor: Number(r._sum.amountMinor || 0),
    amount: Number(r._sum.amountMinor || 0) / 100
  }));

  const paymentsDTO = recentPayments.map(p => ({
    id: p.id,
    amountMinor: p.amountMinor,
    amount: p.amountMinor / 100,
    currency: p.currency,
    status: p.status,
    createdAt: p.createdAt,
    userEmail: p.user?.email
  }));

  return ok({
    totalUsers,
    totalVideos,
    revenueByCurrency: revenueDTO,
    recentPayments: paymentsDTO
  });
}
