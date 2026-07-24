import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { PublicVideoDTO } from "@/app/types/video";

export interface SecretProjectFunding {
  raisedPln: number;
  goalPln: number;
  backers: number;
  daysLeft: number;
}

/**
 * Display-only conversion of foreign-currency pledges into the PLN progress
 * number. Approximate static rates are fine here: the progress figure is a
 * campaign visual, never a financial record (Payment rows stay authoritative).
 */
const RATES_TO_PLN: Record<string, number> = {
  PLN: 1,
  EUR: 4.3,
  USD: 4.0,
  GBP: 5.0,
  CHF: 4.5,
};

// Statuses that still count toward the raised total. Partial refunds keep the
// non-refunded remainder (we subtract refundedAmountMinor below).
const COUNTED_STATUSES = ["SUCCEEDED", "PARTIALLY_REFUNDED"] as const;

/**
 * Shared funding aggregation for both /secretproject and /secretproject2 —
 * same underlying campaign, same Payment rows, just presented with different
 * visuals per page. Goal and deadline are passed in per-page since each page
 * file owns its own campaign display constants.
 */
export async function loadSecretProjectFunding(
  goalPln: number,
  endDate: Date,
): Promise<SecretProjectFunding> {
  const daysLeft = Math.max(
    0,
    Math.ceil((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  try {
    const [totalsByCurrency, backerRows] = await Promise.all([
      prisma.payment.groupBy({
        by: ["currency"],
        where: { status: { in: [...COUNTED_STATUSES] } },
        _sum: { amountMinor: true, refundedAmountMinor: true },
      }),
      prisma.payment.findMany({
        where: { status: { in: [...COUNTED_STATUSES] } },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ]);

    const raisedPln = totalsByCurrency.reduce((total, row) => {
      const rate = RATES_TO_PLN[row.currency.toUpperCase()] ?? 1;
      const netMinor = (row._sum.amountMinor ?? 0) - (row._sum.refundedAmountMinor ?? 0);
      return total + Math.max(0, netMinor / 100) * rate;
    }, 0);

    return { raisedPln, goalPln, backers: backerRows.length, daysLeft };
  } catch (error) {
    logger.error("[SECRETPROJECT_FUNDING_ERROR]", error);
    return { raisedPln: 0, goalPln, backers: 0, daysLeft };
  }
}

export async function loadSecretProjectViewerIsPatron(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;

    const [activeGrant, user] = await Promise.all([
      prisma.patronGrant.findFirst({
        where: { userId, revokedAt: null },
        select: { id: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);

    return Boolean(activeGrant) || user?.role === "ADMIN";
  } catch (error) {
    logger.error("[SECRETPROJECT_VIEWER_ERROR]", error);
    return false;
  }
}

export function pickSecretProjectVideos(mainVideo: PublicVideoDTO | null, allVideos: PublicVideoDTO[]) {
  const pitchVideo = mainVideo ?? allVideos[0] ?? null;
  // The reward is the first patron-gated video that isn't the pitch itself; the
  // PlaybackPlan path keeps it locked for non-patrons, playable for patrons.
  const rewardVideo =
    allVideos.find((video) => video.tier === "PATRON" && video.id !== pitchVideo?.id) ?? null;
  return { pitchVideo, rewardVideo };
}
