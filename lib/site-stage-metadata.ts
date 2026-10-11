import { SITE_TITLE } from "@/lib/constants";
import { getServerTx } from "@/lib/i18n/server-tx";
import type { Locale } from "@/lib/i18n/routing";
import { SITE_IS_BETA } from "@/lib/site-stage";
import type { Metadata } from "next";

/** `robots` metadata: noindex while the site is a test version, nothing (default) after launch. */
export function getStageRobots(beta: boolean = SITE_IS_BETA): Metadata["robots"] | undefined {
  return beta ? { index: false, follow: false } : undefined;
}

/**
 * Neutral site title (just the address) and localized description for the beta stage (the home page used the hero
 * video's title as its description). Returns null after launch: callers keep their normal metadata.
 */
export async function getBetaSiteText(locale: Locale, beta: boolean = SITE_IS_BETA): Promise<{ title: string; description: string } | null> {
  if (!beta) return null;
  const tx = await getServerTx(locale);
  return {
    title: SITE_TITLE,
    description: tx(
      "Niezależny kanał wideo twórcy. Strona jest w budowie, a treści mają charakter testowy.",
      "An independent creator's video channel. The site is under construction and its content is for testing.",
    ),
  };
}
