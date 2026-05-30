import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const totalUsers = await prisma.user.count();
    const totalVideos = await prisma.video.count();
    const totalRevenueResult = await prisma.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
    });
    const totalRevenue = totalRevenueResult._sum.amount || 0;

    const recentTransactions = await prisma.transaction.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { email: true } } }
    });

    return NextResponse.json({
        totalUsers,
        totalVideos,
        totalRevenue,
        recentTransactions
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
