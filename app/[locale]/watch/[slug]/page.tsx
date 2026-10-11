import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/utils";
import { getLocaleAlternates, getLocalizedHref, isLocale, type Locale } from "@/lib/i18n/routing";
import { SITE_TITLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function getFeedVideoHref(locale: Locale, slug: string): string {
  return `${getLocalizedHref(locale, "home")}?v=${encodeURIComponent(slug)}`;
}

export async function generateMetadata(props: WatchPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await props.params;
  if (!isLocale(rawLocale)) return { title: SITE_TITLE };

  // The watch URL only redirects to the feed, so the feed URL is the canonical one.
  return {
    title: SITE_TITLE,
    alternates: getLocaleAlternates(rawLocale, "home", { query: `v=${encodeURIComponent(slug)}`, baseUrl: getBaseUrl() }),
  };
}

export default async function WatchPage(props: WatchPageProps) {
  const { locale: rawLocale, slug } = await props.params;
  if (!isLocale(rawLocale)) notFound();

  redirect(getFeedVideoHref(rawLocale, slug));
}
