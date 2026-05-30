import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ReferralService } from '@/lib/services/referral.service';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { referralCode } = await req.json();
    if (!referralCode) return NextResponse.json({ error: "Referral code is required" }, { status: 400 });

    const referrer = await prisma.user.findFirst({
      where: { OR: [{ referralCode: referralCode }, { id: referralCode }] }
    });

    if (!referrer) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });

    await ReferralService.claimReferral(referrer.id, userId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[REFERRAL_CLAIM_ERROR]', err);
    return NextResponse.json({ error: err.message || "Failed to claim referral" }, { status: 500 });
  }
}
