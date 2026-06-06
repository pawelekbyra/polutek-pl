import { logger, createScopedLogger } from "@/lib/logger";
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { handleApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await UserService.getOrCreateUser(userId);
    return NextResponse.json({
      referralCount: user?.referralCount || 0,
      referralPoints: user?.referralPoints || 0,
      referralCode: user?.referralCode || userId
    });
  } catch (error) {
    scopedLogger.error("[REFERRALS_API_ERROR]", error);
    return handleApiError(error);
  }
}
