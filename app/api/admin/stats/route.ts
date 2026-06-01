import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const totalUsers = await prisma.user.count();
    const totalVideos = await prisma.video.count();

    // Admin revenue calculations
    const [grossRevenueByCurrency, refundedByCurrency, chargebackLostByCurrency] = await Promise.all([
        prisma.payment.groupBy({
            by: ['currency'],
            where: { status: 'SUCCEEDED' },
            _sum: { amountMinor: true }
        }),
        prisma.payment.groupBy({
            by: ['currency'],
            where: {
                status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] }
            },
            _sum: { refundedAmountMinor: true }
        }),
        prisma.payment.groupBy({
            by: ['currency'],
            where: { status: 'CHARGEBACK_LOST' },
            _sum: { amountMinor: true, refundedAmountMinor: true }
        })
    ]);

    const recentPayments = await prisma.payment.findMany({
        where: { status: { in: ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK_LOST'] } },
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

    // Compile revenue DTO with net revenue logic
    const currencies = Array.from(new Set([
        ...grossRevenueByCurrency.map(r => r.currency),
        ...refundedByCurrency.map(r => r.currency),
        ...chargebackLostByCurrency.map(r => r.currency)
    ]));

    const revenueDTO = currencies.map(curr => {
        const gross = grossRevenueByCurrency.find(r => r.currency === curr)?._sum.amountMinor || 0;
        const refunded = refundedByCurrency.find(r => r.currency === curr)?._sum.refundedAmountMinor || 0;

        const cbLostRecord = chargebackLostByCurrency.find(r => r.currency === curr);
        // For lost chargebacks, the loss is the original amount minus anything already refunded
        const cbLost = (cbLostRecord?._sum.amountMinor || 0) - (cbLostRecord?._sum.refundedAmountMinor || 0);

        const netMinor = gross - refunded - cbLost;

        return {
            currency: curr,
            grossMinor: gross,
            refundedMinor: refunded,
            chargebackLostMinor: cbLost,
            netMinor: netMinor,
            amount: netMinor / 100 // Legacy compatibility for UI displaying "amount"
        };
    });

    const paymentsDTO = recentPayments.map(p => ({
        id: p.id,
        amountMinor: p.amountMinor,
        amount: p.amountMinor / 100,
        refundedAmount: p.refundedAmountMinor / 100,
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
