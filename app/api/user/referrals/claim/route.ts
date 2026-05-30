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

    const referrer = await prisma.user.findFirst({
      where: { OR: [{ referralCode: referralCode }, { id: referralCode }] }
    });

    if (!referrer) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    if (referrer.id === userId) return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });

    const updatedReferrer = await prisma.$transaction(async (tx) => {
      // 1. Odczyt z blokadą wewnątrz transakcji:
      const currentUserInTx = await tx.user.findUnique({
        where: { id: userId },
        select: { referredById: true }
      });

      if (!currentUserInTx) throw new Error('USER_NOT_FOUND');
      if (currentUserInTx.referredById) throw new Error('ALREADY_REFERRED');

      // 2. Update użytkownika i referrera
      await tx.user.update({ where: { id: userId }, data: { referredById: referrer.id } });

      const updated = await tx.user.update({
        where: { id: referrer.id },
        data: { referralPoints: { increment: 1 } },
        select: { id: true, referralPoints: true, totalPaid: true, language: true, isPatron: true }
      });

      // 3. Przyznanie statusu Patrona jeśli próg przekroczony
      if (!updated.isPatron && updated.referralPoints >= 5) {
          await tx.user.update({
            where: { id: referrer.id },
            data: { isPatron: true, patronSince: new Date() }
          });
          // Note: we update the returned object as well to reflect state for sync
          updated.isPatron = true;
      }

      return updated;
    });

    // 4. Clerk sync POZA transakcją
    if (updatedReferrer.isPatron) {
        try {
            const client = await clerkClient();
            await client.users.updateUserMetadata(updatedReferrer.id, {
                publicMetadata: { language: updatedReferrer.language, isPatron: true, unlockedViaReferral: true }
            });
        } catch (syncErr) {
            console.error("[Referral Sync] Clerk metadata update failed:", syncErr);
        }
    }

    return NextResponse.json({ success: true, referrerId: updatedReferrer.id, newPoints: updatedReferrer.referralPoints });
  } catch (err: any) {
    console.error('[REFERRAL_CLAIM_ERROR]', err);
    return NextResponse.json({ error: "Failed to claim referral" }, { status: 500 });
  }
}
