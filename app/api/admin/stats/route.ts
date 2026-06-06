import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_STATS");
  if (response) return response;

  try {
    const totalUsers = await prisma.user.count();
    const totalVideos = await prisma.video.count();

    // Admin revenue grouped by currency
    const revenueByCurrency = await prisma.payment.groupBy({
        by: ['currency'],
        where: { status: 'SUCCEEDED' },
        _sum: { amountMinor: true }
    });

    const recentPayments = await prisma.payment.findMany({
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
    });

    const revenueDTO = revenueByCurrency.map(r => ({
        currency: r.currency,
        amountMinor: r._sum.amountMinor || 0,
        amount: (r._sum.amountMinor || 0) / 100
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

    return NextResponse.json({
        totalUsers,
        totalVideos,
        revenueByCurrency: revenueDTO,
        recentPayments: paymentsDTO
    });
  } catch (error: unknown) {
    scopedLogger.error("[GET_ADMIN_STATS_ERROR]", error);
    return handleApiError(error);
  }
}
