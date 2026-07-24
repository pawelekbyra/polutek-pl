import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getHomeContentCached } from "@/lib/modules/channel/application/home-content.loader";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import { getBaseUrl } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { PublicVideoDTO } from "@/app/types/video";
import SecretProjectExperience, {
  type SecretProjectFunding,
} from "@/app/components/secretproject/SecretProjectExperience";

export const dynamic = "force-dynamic";

const PAGE_TITLE = "I raise money for my secret project";
const PAGE_DESCRIPTION =
  "Kampania crowdfundingowa Secret Project — jednorazowa wpłata odblokowuje tajny materiał wideo dożywotnio.";

/** Campaign display settings — retune here when the campaign changes. */
const CAMPAIGN_GOAL_PLN = 100_000;
const CAMPAIGN_END = new Date("2026-09-30T23:59:59+02:00");

/**
 * Display-only conversion of foreign-currency pledges into the PLN progress
 * number. Approximate static rates are fine here: the progress bar is a
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

async function loadFunding(): Promise<SecretProjectFunding> {
  const daysLeft = Math.max(
    0,
    Math.ceil((CAMPAIGN_END.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
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

    return {
      raisedPln,
      goalPln: CAMPAIGN_GOAL_PLN,
      backers: backerRows.length,
      daysLeft,
    };
  } catch (error) {
    logger.error("[SECRETPROJECT_FUNDING_ERROR]", error);
    return { raisedPln: 0, goalPln: CAMPAIGN_GOAL_PLN, backers: 0, daysLeft };
  }
}

async function loadViewerIsPatron(): Promise<boolean> {
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

function pickCampaignVideos(mainVideo: PublicVideoDTO | null, allVideos: PublicVideoDTO[]) {
  const pitchVideo = mainVideo ?? allVideos[0] ?? null;
  // The reward is the first patron-gated video that isn't the pitch itself; the
  // PlaybackPlan path keeps it locked for non-patrons, playable for patrons.
  const rewardVideo =
    allVideos.find((video) => video.tier === "PATRON" && video.id !== pitchVideo?.id) ?? null;
  return { pitchVideo, rewardVideo };
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await props.params;
  if (!isLocale(rawLocale)) return { title: PAGE_TITLE };

  const baseUrl = getBaseUrl();
  return {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    alternates: {
      canonical: `${baseUrl}${rawLocale === "en" ? "/en" : ""}/secretproject`,
      languages: {
        pl: `${baseUrl}/secretproject`,
        en: `${baseUrl}/en/secretproject`,
        "x-default": `${baseUrl}/secretproject`,
      },
    },
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      type: "website",
    },
  };
}

export default async function SecretProjectPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await props.params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  void locale;

  const [content, funding, viewerIsPatron] = await Promise.all([
    getHomeContentCached(),
    loadFunding(),
    loadViewerIsPatron(),
  ]);

  const { mainVideo, allVideos } =
    content.status === "ready"
      ? content
      : { mainVideo: null, allVideos: [] as PublicVideoDTO[] };

  const { pitchVideo, rewardVideo } = pickCampaignVideos(mainVideo, allVideos);

  return (
    <SecretProjectExperience
      pitchVideo={pitchVideo}
      rewardVideo={rewardVideo}
      funding={funding}
      viewerIsPatron={viewerIsPatron}
    />
  );
}
