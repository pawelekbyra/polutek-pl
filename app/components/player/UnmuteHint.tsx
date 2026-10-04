"use client";

import { VolumeX } from "lucide-react";
import { usePlayerCopy } from "./polutek-controls-copy";

/**
 * "Turn sound on" button over a video that plays muted although the viewer never chose mute
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
      className="absolute left-3 top-3 z-40 inline-flex min-h-9 items-center gap-2 rounded-full bg-black/70 px-3.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-[transform,background-color] duration-150 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95 motion-reduce:transition-none"
    >
      <VolumeX aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span>{copy.unmute}</span>
    </button>
  );
}
