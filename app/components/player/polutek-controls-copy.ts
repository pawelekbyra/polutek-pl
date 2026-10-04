"use client";

import { useOptionalLanguage } from "../LanguageContext";

const PLAYER_COPY = {
  pl: {
    buffering: "Buforowanie",
    replay: "Odtwórz ponownie",
    play: "Odtwórz",
    pause: "Pauza",
    unmute: "Włącz dźwięk",
    mute: "Wycisz",
    volume: "Głośność",
    progress: "Postęp odtwarzania",
    normal: "Normalna",
    speed: "Prędkość",
    playbackSpeed: "Prędkość odtwarzania",
    captions: "Napisy",
    disableCaptions: "Wyłącz napisy",
    enableCaptions: "Włącz napisy",
    exitFullscreen: "Zamknij pełny ekran",
    fullscreen: "Pełny ekran",
  },
  en: {
    buffering: "Buffering",
    replay: "Play again",
    play: "Play",
    pause: "Pause",
    unmute: "Unmute",
    mute: "Mute",
    volume: "Volume",
    progress: "Playback progress",
    normal: "Normal",
    speed: "Speed",
    playbackSpeed: "Playback speed",
    captions: "Captions",
    disableCaptions: "Turn captions off",
    enableCaptions: "Turn captions on",
    exitFullscreen: "Exit fullscreen",
    fullscreen: "Fullscreen",
  },
} as const;

export function usePlayerCopy() {
  return PLAYER_COPY[useOptionalLanguage()];
}
