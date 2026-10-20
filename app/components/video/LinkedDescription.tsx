"use client";

import { Fragment, useMemo } from "react";
import { useLanguage } from "../LanguageContext";
import { useVideoChapters } from "../player/chapters-store";
import { requestSeek } from "../player/seek-request";
import { scanTimestamps } from "@/lib/video-chapters";

/**
 * The text of a video description, with the times in it ("12:30") as buttons that jump the player there. Plain text
 * otherwise, exactly as the description was rendered before (the parent keeps `whitespace-pre-wrap`). The times are
 * links only while a player is mounted for this video: for a guest of a LOGGED_IN video, a premiere or a video
 * that cannot be played there is nothing to jump in, so they stay text.
 */
export function LinkedDescription({ text, videoId }: { text: string; videoId: string }) {
  const { tx } = useLanguage();
  const entry = useVideoChapters(videoId);
  const duration = entry?.durationSeconds ?? null;
  const playable = entry !== null && (entry.chapters.length > 0 || duration !== null);
  const parts = useMemo(() => (playable ? scanTimestamps(text) : []), [playable, text]);
  if (!playable || parts.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  parts.forEach((part, index) => {
    // A time beyond the end of a video of known length is not a place in it.
    if (duration !== null && part.seconds > duration) return;
    const label = text.slice(part.index, part.index + part.length);
    nodes.push(
      <Fragment key={`t${index}`}>
        {text.slice(cursor, part.index)}
        <button
          type="button"
          className="cursor-pointer rounded-sm font-bold tabular-nums text-[var(--chan-blue)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
          aria-label={tx("Przejdź do {0}", "Go to {0}", label)}
          onClick={(event) => {
            event.stopPropagation(); // the card toggles its folded state on a click
            requestSeek(videoId, part.seconds);
          }}
        >
          {label}
        </button>
      </Fragment>,
    );
    cursor = part.index + part.length;
  });
  nodes.push(<Fragment key="rest">{text.slice(cursor)}</Fragment>);
  return <>{nodes}</>;
}
