"use client";

import Image from "next/image";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "../LanguageContext";
import { formatClock } from "@/lib/video-start-time";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import type { ContinueWatchingItem } from "@/lib/modules/watch-progress/domain/continue-watching";

/**
 * "Continue watching": the signed-in viewer's unfinished videos (up to 6), each with a progress bar.
 * It is the viewer's own list (built on the server from their saved positions), so it may hold a video
 * they opened by link. Thumbnails and the bar have square corners. Items are real links
 * (`?v=slug`), a plain click switches video in place like the sidebar does.
 */
export function ContinueWatchingShelf({
  items,
  onSelect,
}: {
  items: ContinueWatchingItem[];
  onSelect: (item: ContinueWatchingItem) => void;
}) {
  const { language, tx } = useLanguage();
  if (items.length === 0) return null;

  const heading = tx("Kontynuuj oglądanie", "Continue watching");

  return (
    <section aria-label={heading} data-testid="continue-watching" className="mt-4 md:mt-5">
      <h2 className="mb-2 font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--chan-muted)]">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const title = getVideoDisplayTitle({ title: item.title, titleEn: item.titleEn }, language);
          const href = `${getLocalizedHref(language, "home")}?v=${encodeURIComponent(item.slug)}`;
          const percent = item.fraction === null ? null : Math.round(item.fraction * 100);
          return (
            <li key={item.videoId} className="min-w-0">
              <a
                href={href}
                onClick={(event) => {
                  // Let the browser handle new-tab clicks; a plain click switches in place.
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  onSelect(item);
                }}
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`${title}, ${tx("wznów od", "resume at")} ${formatClock(item.positionSeconds)}`}
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-none bg-black">
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 46vw"
                      className="object-cover transition-transform duration-200 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
                    />
                  ) : null}
                  {percent !== null && (
                    <div className="absolute inset-x-0 bottom-0 h-1 rounded-none bg-white/30" aria-hidden="true">
                      <div className="h-full rounded-none bg-[var(--chan-blue)]" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 font-sans text-[13px] font-semibold leading-snug text-[var(--chan-ink)]">
                  {title}
                </p>
                {item.channelName && (
                  <p className="truncate font-sans text-[12px] text-[var(--chan-muted)]">{item.channelName}</p>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
