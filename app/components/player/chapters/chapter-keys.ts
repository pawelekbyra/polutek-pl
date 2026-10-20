import type { MediaPlayerInstance } from "@vidstack/react";
import { adjacentChapterStart, type Chapter } from "@/lib/video-chapters";
import { seekPlayerTo } from "./seek-player";

/** The chapters the bar shows: the first "chapters" text track that is showing (ChaptersTrackSync builds it). */
function chaptersOfPlayer(player: MediaPlayerInstance): Chapter[] {
  for (const track of player.textTracks) {
    if (track.kind !== "chapters" || track.mode !== "showing") continue;
    return track.cues.map((cue) => ({ startSeconds: cue.startTime, title: cue.text }));
  }
  return [];
}

function jumpToChapter(player: MediaPlayerInstance, event: KeyboardEvent, dir: -1 | 1): void {
  const target = adjacentChapterStart(chaptersOfPlayer(player), player.currentTime, dir);
  if (target === null) return;
  // Vidstack does not cancel the key of a custom shortcut: Alt+Left would still go "back" in the browser.
  event.preventDefault();
  event.stopPropagation();
  seekPlayerTo(player, target);
}

/**
 * Chapter shortcuts for Vidstack's `keyShortcuts`: next/previous chapter on Ctrl+Right/Left (Windows, Linux) and
 * Alt+Right/Left (Mac), exactly YouTube's keys, plus "]" and "[". Vidstack matches the modifiers exactly, so these do
 * not clash with the plain arrows (5 s seek), and it ignores keys typed in inputs and menus. Without chapters the
 * keys do nothing (and are not cancelled). A constant: the callbacks read the chapters from the player when pressed.
 */
export const CHAPTER_KEY_SHORTCUTS = {
  nextChapter: {
    keys: "Ctrl+ArrowRight Alt+ArrowRight ]",
    onKeyDown: ({ event, player }: { event: KeyboardEvent; player: MediaPlayerInstance }) => jumpToChapter(player, event, 1),
  },
  previousChapter: {
    keys: "Ctrl+ArrowLeft Alt+ArrowLeft [",
    onKeyDown: ({ event, player }: { event: KeyboardEvent; player: MediaPlayerInstance }) => jumpToChapter(player, event, -1),
  },
};
