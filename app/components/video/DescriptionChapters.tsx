"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import { useVideoChapters } from "../player/chapters-store";
import { requestSeek } from "../player/seek-request";
import { formatClock } from "@/lib/video-start-time";
import { pickChapterTitle } from "@/lib/video-chapters";

/** Chapters shown before "Show all". */
const COLLAPSED_COUNT = 5;

/**
 * The chapter list under the description: time + title, the chapter being played highlighted, a click jumps there.
 * Folded to the first five when there are more. Nothing without chapters (and for a viewer who has no player).
 */
export function DescriptionChapters({ videoId }: { videoId: string }) {
  const { t, tx, language } = useLanguage();
  const entry = useVideoChapters(videoId);
  const [expanded, setExpanded] = useState(false);
  const chapters = entry?.chapters ?? [];
  if (chapters.length === 0) return null;

  const foldable = chapters.length > COLLAPSED_COUNT;
  const visible = foldable && !expanded ? chapters.slice(0, COLLAPSED_COUNT) : chapters;
  const activeIndex = entry?.activeIndex ?? -1;
  const toggleClass = "cursor-pointer rounded-sm text-[12px] font-bold text-[var(--chan-blue)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]";

  return (
    // The card around folds on a click: nothing in here may reach it.
    <div className="mt-2 border-t border-[var(--chan-line)] pt-2" onClick={(event) => event.stopPropagation()}>
      <div className="mb-1 text-[12px] font-bold text-[var(--chan-ink)]">
        {tx("Rozdziały", "Chapters")} <span className="font-semibold tabular-nums text-[var(--chan-muted)]">({chapters.length})</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {visible.map((chapter, index) => (
          <li key={chapter.startSeconds}>
            <button
              type="button"
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => requestSeek(videoId, chapter.startSeconds)}
              className={cn(
                "flex min-h-8 w-full cursor-pointer items-baseline gap-3 rounded-xl px-2 py-1 text-left text-[12px] leading-[1.4] hover:bg-[var(--chan-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]",
                index === activeIndex && "bg-[var(--chan-blue-soft)] font-bold",
              )}
            >
              <span className="w-12 shrink-0 font-bold tabular-nums text-[var(--chan-blue)]">{formatClock(chapter.startSeconds)}</span>
              <span className="min-w-0 flex-1 text-[var(--chan-body)]">{pickChapterTitle(chapter, language)}</span>
            </button>
          </li>
        ))}
      </ul>
      {foldable && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={cn(toggleClass, "mt-1 px-2")}
        >
          {expanded ? t.showLess : tx("Pokaż wszystkie ({0})", "Show all ({0})", chapters.length)}
        </button>
      )}
    </div>
  );
}
