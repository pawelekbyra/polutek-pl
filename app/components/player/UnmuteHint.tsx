"use client";

import { VolumeMutedIcon } from "./controls/PlayerIconSet";
import { usePlayerCopy } from "./polutek-controls-copy";

/**
 * Crossed-out speaker icon (tap to turn the sound on) over a video that plays muted although the viewer never chose mute
 * (the browser refused to start it with sound, or it started without a gesture). Rendered
 * outside the Vidstack player on purpose: the player's tap-to-pause gesture must not see it.
 */
export function UnmuteHint({ visible, onUnmute }: { visible: boolean; onUnmute: () => void }) {
  const copy = usePlayerCopy();
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onUnmute}
      data-testid="player-unmute-hint"
      data-sound-control=""
      aria-label={copy.unmute}
      title={copy.unmute}
      className="absolute left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-[transform,background-color] duration-150 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95 motion-reduce:transition-none"
    >
      <VolumeMutedIcon className="h-5 w-5 shrink-0" />
    </button>
  );
}
