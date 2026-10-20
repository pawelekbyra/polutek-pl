"use client";

import type { Chapter } from "@/lib/video-chapters";
import { ChaptersSeekListener } from "./ChaptersSeekListener";
import { ChaptersTrackSync } from "./ChaptersTrackSync";

/** The invisible chapter parts of a player (render inside `<MediaPlayer>`): the chapters track and the jump listener. */
export function ChaptersParts({ videoId, chapters }: { videoId: string; chapters?: readonly Chapter[] }) {
  return (
    <>
      <ChaptersTrackSync videoId={videoId} chapters={chapters} />
      <ChaptersSeekListener videoId={videoId} />
    </>
  );
}
