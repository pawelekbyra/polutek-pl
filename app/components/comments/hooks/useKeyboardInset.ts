"use client";

import { useEffect, useState } from "react";

/**
 * Height (px) of the on-screen keyboard (or any other browser UI that covers the bottom of the layout viewport),
 * so a `position: fixed; bottom: 0` bar can be lifted to sit right above it.
 *
 * Mobile browsers differ: iOS Safari and current Android Chrome shrink only the *visual* viewport when the keyboard
 * opens and leave fixed elements anchored to the (unchanged) layout viewport, where the keyboard hides them. The
 * gap between the layout viewport (`innerHeight`) and the visual one is the keyboard. Older Android Chrome resizes
 * the layout viewport instead; there the gap is 0 and the bar already sits above the keyboard.
 *
 * Only listens while `active`, so a closed composer costs nothing.
 */
export function keyboardInsetOf(layoutHeight: number, visualHeight: number, visualOffsetTop: number): number {
  return Math.max(0, Math.round(layoutHeight - visualHeight - visualOffsetTop));
}

export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(keyboardInsetOf(window.innerHeight, viewport.height, viewport.offsetTop));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);

  return inset;
}
