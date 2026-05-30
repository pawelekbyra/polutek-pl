import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/lib/services/user.service';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { referralCode } = await req.json();
    if (!referralCode) return NextResponse.json({ error: "Referral code is required" }, { status: 400 });

    const currentUser = await UserService.getOrCreateUser(userId);
    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (currentUser.referredById) return NextResponse.json({ error: "User already referred" }, { status: 400 });

    const referrer = await prisma.user.findFirst({
      where: { OR: [{ referralCode: referralCode }, { id: referralCode }] }
    });

    if (!referrer) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    if (referrer.id === userId) return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });

    const updatedReferrer = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { referredById: referrer.id } });
      const updated = await tx.user.update({ where: { id: referrer.id }, data: { referralPoints: { increment: 1 } } });

      if (updated.referralPoints >= 5 && updated.totalPaid < 5) {
          await tx.user.update({ where: { id: referrer.id }, data: { totalPaid: 5 } });
          const client = await clerkClient();
          await client.users.updateUserMetadata(referrer.id, {
              publicMetadata: { language: updated.language, isPatron: true, unlockedViaReferral: true }
          });
      }
      return updated;
    });

    return NextResponse.json({ success: true, referrerId: updatedReferrer.id, newPoints: updatedReferrer.referralPoints });
  } catch (err: any) {
    console.error('[REFERRAL_CLAIM_ERROR]', err);
    return NextResponse.json({ error: "Failed to claim referral" }, { status: 500 });
  }
}
