"use client";

const SOUND_SRC = "/sounds/kasa.mp3";
let cashSound: HTMLAudioElement | null = null;

/** Fetch the small checkout sound before an interaction needs to play it. */
export function preloadPassCashSound(): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return;
  if (cashSound) return;
  cashSound = new Audio(SOUND_SRC);
  cashSound.preload = "auto";
  cashSound.load();
}

/** Restart the same short sound for checkout entry and exit. Call from the user's click. */
export function playPassCashSound(): void {
  preloadPassCashSound();
  if (!cashSound) return;
  cashSound.pause();
  cashSound.currentTime = 0;
  void cashSound.play().catch(() => undefined);
}
