import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { ReferralService } from '@/lib/services/referral.service';
import { UserService } from '@/lib/services/user.service';
import { handleApiError } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Rate Limiting: 5 claims per hour per user
    const rateLimitResult = await rateLimit({
        key: `referral-claim:${userId}`,
        limit: 5,
        windowMs: 60 * 60 * 1000
    });

    if (!rateLimitResult.success) {
        return NextResponse.json({ error: "Too many attempts. Try again in an hour." }, { status: 429 });
    }

    await UserService.getOrCreateUser(userId);

    const { referralCode } = await req.json();
    if (!referralCode) return NextResponse.json({ error: "Referral code is required" }, { status: 400 });

    const referrer = await prisma.user.findFirst({
      where: { OR: [{ referralCode: referralCode }, { id: referralCode }] }
    });

    if (!referrer) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });

    await ReferralService.claimReferral(referrer.id, userId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
