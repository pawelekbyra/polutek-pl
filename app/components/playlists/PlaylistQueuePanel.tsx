"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import type { PlaylistQueueDto } from "@/lib/modules/playlists/domain/playlist.dto";
import { VIDEO_ENDED_EVENT, type VideoEndedDetail } from "./video-ended-event";
import { planQueueSelect } from "./queue-navigation";

/**
 * The playlist queue on the watch page (`?list=<slug>&i=<n>`): the playlist title, previous/next, an "autoplay next"
 * switch and the visible items in order. The server decided what is in `queue` (only videos this viewer may see);
 * the panel only shows it and reports a choice. Not to be confused with the home sidebar (`SidebarPlaylist`), which
 * is the channel's own curated feed (docs/architecture/playlists.md).
 */

const AUTOPLAY_KEY = "polutek:playlist-autoplay";

// One shared store, so the two panels of the page (phone and desktop placement) always agree.
const autoplayListeners = new Set<() => void>();
let autoplayOverride: boolean | null = null;

function readAutoplay(): boolean {
  if (autoplayOverride !== null) return autoplayOverride;
  try {
    return window.localStorage.getItem(AUTOPLAY_KEY) !== "off";
  } catch {
    return true; // Storage can be unavailable (private window); the default stays.
  }
}

function writeAutoplay(value: boolean) {
  autoplayOverride = value;
  try {
    window.localStorage.setItem(AUTOPLAY_KEY, value ? "on" : "off");
  } catch {
    // Not remembered, still applied for this page.
  }
  autoplayListeners.forEach((listener) => listener());
}

/** The viewer's "autoplay next" choice: on by default, remembered in this browser only. */
export function usePlaylistAutoplay(): [boolean, (value: boolean) => void] {
  const enabled = useSyncExternalStore(
    (listener) => {
      autoplayListeners.add(listener);
      return () => autoplayListeners.delete(listener);
    },
    readAutoplay,
    () => true,
  );
  return [enabled, writeAutoplay];
}

/** Starts the next video of the queue when the open one ends (and the viewer left autoplay on). Renders nothing. */
export function PlaylistAutoAdvance({
  queue,
  currentVideoId,
  onAdvance,
}: {
  queue: PlaylistQueueDto;
  currentVideoId: string;
  onAdvance: (index: number) => void;
}) {
  const [enabled] = usePlaylistAutoplay();
  const currentIndex = queue.items.findIndex((item) => item.id === currentVideoId);
  useEffect(() => {
    if (!enabled || currentIndex < 0 || currentIndex >= queue.items.length - 1) return;
    const onEnded = (event: Event) => {
      const detail = (event as CustomEvent<VideoEndedDetail>).detail;
      if (detail?.videoId === currentVideoId) onAdvance(currentIndex + 1);
    };
    window.addEventListener(VIDEO_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(VIDEO_ENDED_EVENT, onEnded);
  }, [enabled, currentIndex, currentVideoId, queue.items.length, onAdvance]);
  return null;
}

export default function PlaylistQueuePanel({
  queue,
  currentVideoId,
  onSelect,
  className,
}: {
  queue: PlaylistQueueDto;
  currentVideoId: string;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const { tx, language } = useLanguage();
  const [autoplayNext, onAutoplayChange] = usePlaylistAutoplay();
  const currentIndex = queue.items.findIndex((item) => item.id === currentVideoId);
  const total = queue.items.length;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < total - 1;

  return (
    <section
      aria-label={tx("Kolejka playlisty", "Playlist queue")}
      className={`rounded-[24px] border border-[var(--cm-line-80)] bg-[var(--cm-card-88-white)] p-3 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3 px-1 pb-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--chan-muted)]">{tx("Playlista", "Playlist")}</p>
          <a
            href={getLocalizedHref(language, "playlist", { channel: queue.channelSlug, slug: queue.slug })}
            className="block truncate text-[15px] font-bold text-[var(--chan-ink)] hover:underline"
          >
            {queue.title}
          </a>
          {currentIndex >= 0 && (
            <p className="text-[12px] text-[var(--chan-muted)]">{tx("{0} z {1}", "{0} of {1}", currentIndex + 1, total)}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={!hasPrevious}
            onClick={() => onSelect(currentIndex - 1)}
            aria-label={tx("Poprzedni film", "Previous video")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cm-line-80)] text-[16px] text-[var(--chan-ink)] transition hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] disabled:opacity-40"
          >
            <span aria-hidden="true">{"‹"}</span>
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onSelect(currentIndex + 1)}
            aria-label={tx("Następny film", "Next video")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cm-line-80)] text-[16px] text-[var(--chan-ink)] transition hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] disabled:opacity-40"
          >
            <span aria-hidden="true">{"›"}</span>
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 px-1 pb-2 text-[13px] text-[var(--chan-ink)]">
        <input type="checkbox" checked={autoplayNext} onChange={(e) => onAutoplayChange(e.target.checked)} className="h-4 w-4 accent-[var(--chan-ink)]" />
        {tx("Autoodtwarzanie następnego", "Autoplay next")}
      </label>

      <ol className="max-h-72 overflow-y-auto">
        {queue.items.map((item, index) => {
          const active = item.id === currentVideoId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] ${
                  active ? "bg-[var(--chan-surface)]" : "hover:bg-[var(--chan-surface)]"
                }`}
              >
                <span className="w-5 shrink-0 text-center text-[12px] tabular-nums text-[var(--chan-muted)]">{index + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnailUrl} alt="" width={96} height={54} loading="lazy" className="h-[40px] w-[72px] shrink-0 rounded-lg bg-black object-cover" />
                <span className="min-w-0 flex-1">
                  <span className={`line-clamp-2 text-[13px] leading-tight ${active ? "font-bold" : "font-semibold"} text-[var(--chan-ink)]`}>
                    {getVideoDisplayTitle(item, language)}
                  </span>
                  {item.duration && <span className="text-[11px] text-[var(--chan-muted)]">{item.duration}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The queue as the watch page mounts it: the panel plus (once per page, `autoAdvance`) the end-of-video listener.
 * A queue entry opens in place when the video is one of the home list's, otherwise by address (a full load that
 * rebuilds the queue on the server). `onSwitch` is the page's own shallow video switch.
 */
export function PlaylistQueueLayer({
  queue,
  currentVideoId,
  knownVideoIds,
  language,
  onSwitch,
  autoAdvance = false,
}: {
  queue: PlaylistQueueDto;
  currentVideoId: string;
  knownVideoIds: readonly string[];
  language: Locale;
  /** `auto` is true for the hand-over at the end of a video (no focus move for the viewer). */
  onSwitch: (videoId: string, query: string, auto?: boolean) => void;
  autoAdvance?: boolean;
}) {
  const select = (index: number, auto = false) => {
    const plan = planQueueSelect(queue, index, knownVideoIds);
    if (!plan) return;
    if (!plan.inPlace) window.location.assign(`${getLocalizedHref(language, "home")}?${plan.query}`);
    else if (plan.videoId !== currentVideoId) onSwitch(plan.videoId, plan.query, auto);
  };
  return (
    <>
      <PlaylistQueuePanel queue={queue} currentVideoId={currentVideoId} onSelect={select} />
      {autoAdvance && <PlaylistAutoAdvance queue={queue} currentVideoId={currentVideoId} onAdvance={(index) => select(index, true)} />}
    </>
  );
}
