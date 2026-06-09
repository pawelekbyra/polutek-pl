import { logger, createScopedLogger } from "@/lib/logger";
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { ReferralService } from '@/lib/services/referral.service';
import { getOrCreateCurrentUser } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { handleApiError } from '@/lib/errors';

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
    const userCtx = createAppContext();
    await getOrCreateCurrentUser(userCtx, userId);

    const { referralCode } = await req.json();
    if (!referralCode) return NextResponse.json({ error: "Referral code is required" }, { status: 400 });

    const referrer = await prisma.user.findFirst({
      where: { OR: [{ referralCode: referralCode }, { id: referralCode }] }
    });

    if (!referrer) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });

    await ReferralService.claimReferral(referrer.id, userId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    scopedLogger.error('[REFERRAL_CLAIM_ERROR]', err);

    if (err instanceof Error) {
        if (err.message === "Self-referral is not allowed") return NextResponse.json({ error: err.message }, { status: 400 });
        if (err.message === "User already referred") return NextResponse.json({ error: err.message }, { status: 409 });
        if (err.message === "Referred user not found") return NextResponse.json({ error: err.message }, { status: 404 });
    }

    return handleApiError(err);
  }
}
