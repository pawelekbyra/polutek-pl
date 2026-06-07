import { createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { normalizePaymentTotals } from '@/lib/services/user-access.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_USER_DETAILS");
  if (response) return response;

  const userId = params.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        paymentTotals: true,
        patronGrants: {
            orderBy: { createdAt: 'desc' }
        },
        payments: {
            orderBy: { createdAt: 'desc' },
            take: 50
        },
        subscriptions: {
            include: { creator: true }
        },
        referredBy: true,
        _count: {
            select: {
                comments: true,
                referrals: true,
                videoLikes: true,
                videoDislikes: true
            }
        }
      }
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const auditLogs = await prisma.auditLog.findMany({
        where: {
            OR: [
                { targetType: 'User', targetId: userId },
                { actorUserId: userId }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    return NextResponse.json({
        ...user,
        normalizedTotal: normalizePaymentTotals(user.paymentTotals),
        auditLogs
    });
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_USER_DETAILS_ERROR]", error);
      return handleApiError(error);
  }
}
