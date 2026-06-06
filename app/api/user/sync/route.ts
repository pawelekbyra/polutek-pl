import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { prisma } from '@/lib/prisma';
import { normalizePaymentTotals } from '@/lib/services/user-access.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure user exists
    await UserService.getOrCreateUser(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { paymentTotals: true }
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      totalPaid: normalizePaymentTotals(user.paymentTotals),
      isPatron: user.isPatron,
      language: user.language
    });
  } catch (error) {
    scopedLogger.error('[USER_SYNC_API_ERROR]', error);
    return handleApiError(error);
  }
}
