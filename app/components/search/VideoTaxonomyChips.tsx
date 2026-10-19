import Link from "next/link";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { buildSearchQuery } from "@/lib/search-href";
import { videoCategoryLabel } from "@/lib/video-category-label";
import { cn } from "@/lib/utils";

const chipClass =
  "inline-flex max-w-[11rem] items-center truncate rounded-full border border-[var(--chan-line)] bg-transparent px-2.5 py-[3px] font-sans text-[11px] font-semibold leading-none text-[var(--chan-muted)] transition-colors hover:border-[var(--chan-blue)] hover:text-[var(--chan-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]";

/**
 * Small, quiet category and tag chips; each one is a link to the search page filtered by it (`/search?category=...`,
 * `/search?tag=...`). Presentational on purpose (no hooks): used by the watch page, the video cards and the results,
 * on the server and in the browser.
 */
export default function VideoTaxonomyChips({
  category,
  tags,
  locale,
  tx,
  maxTags = 8,
  className,
}: {
  category?: string | null;
  tags?: readonly string[];
  locale: Locale;
  tx: Tx;
  maxTags?: number;
  className?: string;
}) {
  const categoryName = videoCategoryLabel(tx, category);
  const shownTags = (tags ?? []).slice(0, maxTags);
  if (!categoryName && shownTags.length === 0) return null;
  const searchPath = getLocalizedHref(locale, "search");
  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label={tx("Kategoria i tagi", "Category and tags")}>
      {categoryName && category ? (
        <li>
          <Link
            href={`${searchPath}?${buildSearchQuery({ category })}`}
            prefetch={false}
            className={chipClass}
            title={tx("Filmy w kategorii {0}", "Videos in category {0}", categoryName)}
          >
            {categoryName}
          </Link>
        </li>
      ) : null}
      {shownTags.map((tag) => (
        <li key={tag}>
          <Link
            href={`${searchPath}?${buildSearchQuery({ tag })}`}
            prefetch={false}
            className={chipClass}
            title={tx("Filmy z tagiem {0}", "Videos tagged {0}", tag)}
          >
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
