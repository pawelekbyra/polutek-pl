"use client";

import { useEffect, useRef } from "react";

/**
 * Elements that change the sound themselves: the "Turn sound on" hint and the player's mute
 * button / volume slider. A gesture on them is left to them, or the same click would unmute
 * here and then toggle back to mute there (and be saved as the viewer's own choice).
 */
const SOUND_CONTROL_SELECTOR = "[data-sound-control], .mc-volume";

/**
 * Events that can carry user activation (HTML "activation-triggering input events"): a mouse
 * press, the end of a tap (touch pointers activate on release, not on touchstart), a key press.
 */
const GESTURE_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown"] as const;

function isSoundControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(SOUND_CONTROL_SELECTOR) !== null;
}

/** False only when the browser can tell this event did not activate the page (e.g. a touch press, Escape). */
function eventActivatedPage(): boolean {
  const activation = (typeof navigator === "undefined" ? undefined : navigator.userActivation) as
    | { isActive?: boolean }
    | undefined;
  return activation?.isActive !== false;
}

/**
 * While `enabled` (the video plays muted only because the browser required it: no gesture yet
 * after a reload or Back/Forward, or sound was refused, and NOT because the viewer muted it), the
 * viewer's first gesture anywhere on the page turns the sound on via `unmute`. One-shot: the
 * listeners go away after use, when `enabled` turns false, on a video change and on unmount. It
 * never records a choice; the viewer's own mute (sessionStorage) keeps `enabled` false.
 * The "m" key is skipped: it is the player's mute shortcut and would toggle straight back.
 */
export function useUnmuteOnFirstGesture(enabled: boolean, unmute: () => void, resetKey: unknown): void {
  const unmuteRef = useRef(unmute);
  useEffect(() => {
    unmuteRef.current = unmute;
  }, [unmute]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let done = false;
    const remove = () => {
      for (const type of GESTURE_EVENTS) document.removeEventListener(type, onGesture, true);
    };
    function onGesture(event: Event) {
      if (done) return;
      if (isSoundControl(event.target)) return;
      if (event instanceof KeyboardEvent && (event.key === "m" || event.key === "M")) return;
      if (!eventActivatedPage()) return;
      done = true;
      remove();
      unmuteRef.current();
    }
    for (const type of GESTURE_EVENTS) document.addEventListener(type, onGesture, { capture: true, passive: true });
    return remove;
  }, [enabled, resetKey]);
}
