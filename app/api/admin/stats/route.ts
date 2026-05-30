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

    return NextResponse.json({
        totalUsers,
        totalVideos,
        revenueByCurrency,
        recentPayments
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
