'use server';

import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import crypto from 'crypto';

export async function checkReferralStatus() {
  try {
    const { userId } = await auth();
    if (!userId) return { isLoggedIn: false };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true }
    });

    return {
      isLoggedIn: true,
      hasReferrer: !!user?.referredById
    };
  } catch (error) {
    logger.error("[CHECK_REFERRAL_STATUS_ERROR]", error);
    return { error: "DB_ERROR", isLoggedIn: false };
  }
}

export async function getReferralData() {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "AUTH_REQUIRED" };

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, referralPoints: true, id: true }
    });

    // If for some reason referralCode is missing (old user without auto-healing yet)
    if (user && !user.referralCode) {
        try {
            user = await prisma.user.update({
                where: { id: userId },
                data: { referralCode: crypto.randomBytes(6).toString('hex') },
                select: { referralCode: true, referralPoints: true, id: true }
            });
        } catch (e) {
            logger.error("[getReferralData] Failed to update missing referralCode", e);
        }
    }

    return {
      referralCode: user?.referralCode || userId,
      referralPoints: user?.referralPoints || 0,
      userId: user?.id
    };
  } catch (error) {
    logger.error("[GET_REFERRAL_DATA_ERROR]", error);
    return { error: "DB_ERROR" };
  }
}
