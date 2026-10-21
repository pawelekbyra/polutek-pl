"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "../LanguageContext";
import { FAVORITES_CHANGED_EVENT } from "../FavoriteButton";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import type { FavoriteVideoItem } from "@/lib/modules/favorites/domain/favorite-rules";

/** Items shown before "Show all". */
const COLLAPSED_COUNT = 6;

/**
 * "Ulubione": the signed-in viewer's own favorite videos (CLAUDE.md 4.26), under the player. Loaded from
 * `/api/user/favorites` and reloaded when the heart button saves or removes a video. Renders nothing while the
 * list is empty or loading, so a viewer without favorites sees no extra block. Items are real links (`?v=slug`);
 * a plain click opens the video in place. Square corners like the "Continue watching" shelf.
 */
export function FavoritesShelf({ onSelect }: { onSelect: (item: Pick<FavoriteVideoItem, "videoId" | "slug">) => void }) {
  const { language, tx } = useLanguage();
  const [items, setItems] = useState<FavoriteVideoItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    fetch("/api/user/favorites", { cache: "no-store", signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { items?: FavoriteVideoItem[] } | null) => {
        if (data && Array.isArray(data.items)) setItems(data.items);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const reload = () => load();
    window.addEventListener(FAVORITES_CHANGED_EVENT, reload);
    return () => {
      controller.abort();
      window.removeEventListener(FAVORITES_CHANGED_EVENT, reload);
    };
  }, [load]);

  if (items.length === 0) return null;

  const heading = tx("Ulubione", "Favorites");
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-label={heading} data-testid="favorites-shelf" className="mt-4 md:mt-5">
      <h2 className="mb-2 font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--chan-muted)]">
        {heading} ({items.length})
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((item) => {
          const title = getVideoDisplayTitle({ title: item.title, titleEn: item.titleEn }, language);
          const href = `${getLocalizedHref(language, "home")}?v=${encodeURIComponent(item.slug)}`;
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
                aria-label={title}
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
                </div>
                <p className="mt-1.5 line-clamp-2 font-sans text-[13px] font-semibold leading-snug text-[var(--chan-ink)]">{title}</p>
                {item.channelName && <p className="truncate font-sans text-[12px] text-[var(--chan-muted)]">{item.channelName}</p>}
              </a>
            </li>
          );
        })}
      </ul>
      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--chan-blue)] hover:underline"
        >
          {expanded ? tx("Pokaż mniej", "Show less") : tx("Pokaż wszystkie", "Show all")}
        </button>
      )}
    </section>
  );
}
