import { logger, createScopedLogger } from "@/lib/logger";
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { getOrCreateCurrentUser, claimReferral } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { handleApiError } from '@/lib/errors';
import { fromUseCaseResult } from '@/lib/api/api-response';

export async function POST(req: Request) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimitResult = await rateLimit({
      key: `referral-claim:${userId}`,
      limit: 5,
      windowMs: 60 * 60 * 1000
  });

  if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many attempts. Try again in an hour." }, { status: 429 });
  }

  try {
    const ctx = createAppContext({ requestId: requestId || undefined });
    await getOrCreateCurrentUser(ctx, userId);

    const { referralCode } = await req.json();
    if (!referralCode) return NextResponse.json({ error: "Referral code is required" }, { status: 400 });

    const result = await claimReferral(ctx, { referralCode, referredUserId: userId });

    return fromUseCaseResult(result);
  } catch (err: unknown) {
    scopedLogger.error('[REFERRAL_CLAIM_ERROR]', err);
    return handleApiError(err);
  }
}
