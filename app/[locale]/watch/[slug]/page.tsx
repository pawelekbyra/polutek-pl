import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/utils";
import { getLocalizedHref, isLocale, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function getFeedVideoHref(locale: Locale, slug: string): string {
  return `${getLocalizedHref(locale, "home")}?v=${encodeURIComponent(slug)}`;
}

export async function generateMetadata(props: WatchPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await props.params;
  if (!isLocale(rawLocale)) return { title: "POLUTEK.PL" };

  const baseUrl = getBaseUrl();
  const canonicalPath = getFeedVideoHref(rawLocale, slug);

  return {
    title: "POLUTEK.PL",
    alternates: {
      canonical: `${baseUrl}${canonicalPath}`,
      languages: {
        pl: `${baseUrl}${getFeedVideoHref("pl", slug)}`,
        en: `${baseUrl}${getFeedVideoHref("en", slug)}`,
        "x-default": `${baseUrl}${getFeedVideoHref("pl", slug)}`,
      },
    },
  };
}

export default async function WatchPage(props: WatchPageProps) {
  const { locale: rawLocale, slug } = await props.params;
  if (!isLocale(rawLocale)) notFound();

  redirect(getFeedVideoHref(rawLocale, slug));
}
