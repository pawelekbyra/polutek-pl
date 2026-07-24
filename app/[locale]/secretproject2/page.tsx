import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHomeContentCached } from "@/lib/modules/channel/application/home-content.loader";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import { getBaseUrl } from "@/lib/utils";
import type { PublicVideoDTO } from "@/app/types/video";
import {
  loadSecretProjectFunding,
  loadSecretProjectViewerIsPatron,
  pickSecretProjectVideos,
} from "@/lib/modules/campaign/secret-project-funding";
import SecretProject2Experience from "@/app/components/secretproject2/SecretProject2Experience";

export const dynamic = "force-dynamic";

const PAGE_TITLE = "I raise money for my secret project";
const PAGE_DESCRIPTION =
  "Kampania crowdfundingowa Secret Project — jednorazowa wpłata odblokowuje tajny materiał wideo dożywotnio.";

/**
 * Same underlying campaign as /secretproject — same Payment rows, same goal
 * and deadline — just a different, light editorial presentation. Keep these
 * two constants in sync with app/[locale]/secretproject/page.tsx when the
 * campaign's numbers change.
 */
const CAMPAIGN_GOAL_PLN = 100_000;
const CAMPAIGN_END = new Date("2026-09-30T23:59:59+02:00");

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
      canonical: `${baseUrl}${rawLocale === "en" ? "/en" : ""}/secretproject2`,
      languages: {
        pl: `${baseUrl}/secretproject2`,
        en: `${baseUrl}/en/secretproject2`,
        "x-default": `${baseUrl}/secretproject2`,
      },
    },
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      type: "website",
    },
  };
}

export default async function SecretProject2Page(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await props.params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  void locale;

  const [content, funding, viewerIsPatron] = await Promise.all([
    getHomeContentCached(),
    loadSecretProjectFunding(CAMPAIGN_GOAL_PLN, CAMPAIGN_END),
    loadSecretProjectViewerIsPatron(),
  ]);

  const { mainVideo, allVideos } =
    content.status === "ready"
      ? content
      : { mainVideo: null, allVideos: [] as PublicVideoDTO[] };

  const { pitchVideo, rewardVideo } = pickSecretProjectVideos(mainVideo, allVideos);

  return (
    <SecretProject2Experience
      pitchVideo={pitchVideo}
      rewardVideo={rewardVideo}
      funding={funding}
      viewerIsPatron={viewerIsPatron}
    />
  );
}
