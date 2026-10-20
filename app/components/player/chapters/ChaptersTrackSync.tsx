"use client";

import { useEffect, useMemo } from "react";
import { TextTrack, useMediaPlayer, useMediaState } from "@vidstack/react";
import { useOptionalLanguage } from "../../LanguageContext";
import { CHAPTERS_MIN, activeChapterIndex, pickChapterTitle, type Chapter } from "@/lib/video-chapters";
import { clearChapters, publishActiveChapter, publishChapters } from "../chapters-store";

/**
 * Hands the chapters of the playback plan to Vidstack as a "chapters" text track built in code (no .vtt file, no
 * request, nothing in the CSP): the segmented progress bar, the title in its preview and the chapter menu read it.
 * It also publishes them (and the length of the video) to chapters-store.ts for the card under the player.
 *
 * Chapters at or past the end of the video are left out (a re-uploaded video may be shorter than when they were
 * written). Fewer than CHAPTERS_MIN left means no chapters at all: the bar stays one segment, as without them.
 * Renders nothing.
 */
export function ChaptersTrackSync({ videoId, chapters }: { videoId: string; chapters?: readonly Chapter[] }) {
  const player = useMediaPlayer();
  const language = useOptionalLanguage();
  const rawDuration = useMediaState("duration");
  const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;

  // The plan is renewed every few minutes with new array objects: depend on the content, not the reference.
  const signature = chapters ? JSON.stringify(chapters) : "";
  const usable = useMemo<Chapter[]>(() => {
    if (!signature || durationSeconds === null) return [];
    const parsed = JSON.parse(signature) as Chapter[];
    const inside = parsed.filter((chapter) => chapter.startSeconds < durationSeconds);
    return inside.length >= CHAPTERS_MIN ? inside : [];
  }, [signature, durationSeconds]);

  useEffect(() => {
    publishChapters(videoId, usable, durationSeconds);
  }, [videoId, usable, durationSeconds]);
  useEffect(() => () => clearChapters(videoId), [videoId]);

  useEffect(() => {
    if (!player || durationSeconds === null || usable.length === 0) return;
    const track = new TextTrack({ kind: "chapters", label: "Chapters", language, type: "vtt" }); // no src/content: ready at once
    usable.forEach((chapter, index) => {
      const end = usable[index + 1]?.startSeconds ?? durationSeconds;
      track.addCue(new window.VTTCue(chapter.startSeconds, end, pickChapterTitle(chapter, language)));
    });
    player.textTracks.add(track);
    track.mode = "showing"; // the bar follows the first chapters track that is showing
    return () => {
      player.textTracks.remove(track);
    };
  }, [player, usable, durationSeconds, language]);

  // Which chapter is playing, for the list under the description (changes a few times per video, not per frame).
  const currentTime = useMediaState("currentTime");
  const activeIndex = usable.length > 0 ? activeChapterIndex(usable, currentTime) : -1;
  useEffect(() => {
    publishActiveChapter(videoId, activeIndex);
  }, [videoId, activeIndex]);

  return null;
}
