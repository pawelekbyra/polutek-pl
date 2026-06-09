import { createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { normalizePaymentTotals } from '@/lib/modules/users';
import { getAdminUserDetails } from '@/lib/modules/users';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_USER_DETAILS");
  if (response) return response;

  const userId = params.userId;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    // Core user lookup is main-channel scoped (not applicable for global users but following pattern)
    // and modularized.
    const result = await getAdminUserDetails(userId, ctx);

    if (!result.ok) return fromUseCaseResult(result);

    const user = result.data;

    // R5 remaining blocker: admin user legacy extensions (payments, subscriptions) still use direct Prisma/Services.
    // Core user identity lookup is modularized.
    const [paymentTotals, patronGrants, payments, subscriptions, auditLogs] = await Promise.all([
        prisma.userPaymentTotal.findMany({ where: { userId } }),
        prisma.patronGrant.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.subscription.findMany({ where: { userId }, include: { creator: true } }),
        prisma.auditLog.findMany({
            where: {
                OR: [
                    { targetType: 'User', targetId: userId },
                    { actorUserId: userId }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        })
    ]);

    return NextResponse.json({
        ...user,
        paymentTotals,
        patronGrants,
        payments,
        subscriptions,
        normalizedTotal: normalizePaymentTotals(paymentTotals),
        auditLogs
    });
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_USER_DETAILS_ERROR]", error);
      return handleApiError(error);
  }
}
