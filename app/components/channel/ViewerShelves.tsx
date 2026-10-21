"use client";

import { ContinueWatchingShelf } from "./ContinueWatchingShelf";
import { FavoritesShelf } from "./FavoritesShelf";
import type { ContinueWatchingItem } from "@/lib/modules/watch-progress/domain/continue-watching";

type ShelfTarget = Pick<ContinueWatchingItem, "videoId" | "slug">;

/**
 * "Continue watching" under the player is switched off at the owner's request (2026-10-21): the shelf and its data stay in
 * the code, the video page just does not show it. The resume position inside a video keeps working.
 */
const CONTINUE_WATCHING_SHELF_ENABLED = false;

/**
 * The signed-in viewer's own shelves under the player: "Continue watching" (skipping the video that is open) and
 * "Ulubione". One component so the watch page shell carries a single line for both (it has a line budget).
 */
export function ViewerShelves({
  continueWatching,
  currentVideoId,
  onSelect,
}: {
  continueWatching: ContinueWatchingItem[];
  currentVideoId: string;
  onSelect: (item: ShelfTarget) => void;
}) {
  const resume = CONTINUE_WATCHING_SHELF_ENABLED ? continueWatching.filter((item) => item.videoId !== currentVideoId) : [];
  return (
    <>
      {resume.length > 0 && <ContinueWatchingShelf items={resume} onSelect={onSelect} />}
      <FavoritesShelf onSelect={onSelect} />
    </>
  );
}
