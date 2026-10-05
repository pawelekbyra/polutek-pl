"use client";

import { useMemo } from "react";
import type { Tx } from "@/lib/i18n/ui";
import { useOptionalTx } from "@/lib/i18n/language-context";

function buildPlayerCopy(tx: Tx) {
  return {
    buffering: tx("Buforowanie", "Buffering"),
    replay: tx("Odtwórz ponownie", "Play again"),
    play: tx("Odtwórz", "Play"),
    pause: tx("Pauza", "Pause"),
    unmute: tx("Włącz dźwięk", "Unmute"),
    mute: tx("Wycisz", "Mute"),
    volume: tx("Głośność", "Volume"),
    progress: tx("Postęp odtwarzania", "Playback progress"),
    captions: tx("Napisy", "Captions"),
    disableCaptions: tx("Wyłącz napisy", "Turn captions off"),
    enableCaptions: tx("Włącz napisy", "Turn captions on"),
    exitFullscreen: tx("Zamknij pełny ekran", "Exit fullscreen"),
    fullscreen: tx("Pełny ekran", "Fullscreen"),
  };
}

export function usePlayerCopy() {
  const tx = useOptionalTx();
  return useMemo(() => buildPlayerCopy(tx), [tx]);
}
