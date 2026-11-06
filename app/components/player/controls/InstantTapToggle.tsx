"use client";

import { useMediaPlayer, useMediaRemote } from "@vidstack/react";
import { useEffect } from "react";

/**
 * Click / tap on the picture toggles play and pause IMMEDIATELY, on the pointer release.
 *
 * Vidstack's own `<Gesture event="pointerup">` holds every single tap back by 250 ms (it waits to see whether a second
 * one makes a double tap), so the centre play button used to appear a quarter of a second after the click. Here the
 * toggle runs at once; the double-tap gesture (fullscreen, `dblpointerup` in PolutekControls) is unchanged and fires on
 * the second release, which here puts play/pause back as it was (net no change) and enters fullscreen, as on YouTube.
 *
 * It listens on the same element Vidstack's gestures do (the media provider), so the control bar, the menus and the
 * centre button (siblings above it) never reach it. Mouse and pen: primary button only. Touch: a scroll or pinch ends
 * in `pointercancel`, never `pointerup`, so only a real tap toggles.
 */
/** Vidstack's own window for pairing two taps into a double tap. */
const DOUBLE_TAP_MS = 275;

export function InstantTapToggle() {
  const player = useMediaPlayer();
  const remote = useMediaRemote();

  useEffect(() => {
    const provider = player?.el?.querySelector<HTMLElement>("[data-media-provider]");
    if (!player || !provider) return;
    // Vidstack's `paused` state only updates when the media element reports back, so a second release a few ms after the
    // first would still see the old state and toggle the wrong way. The second tap of a double tap therefore restores the
    // state from before the first one explicitly.
    let off = () => {};
    const settle = (toPaused: boolean, run: () => void) => {
      if (player.state.paused === toPaused) {
        run();
        return;
      }
      off();
      // `done` guards the callback: unsubscribing from inside it may not take effect before the next state change.
      let done = false;
      const stop = player.subscribe(({ paused }) => {
        if (done || paused !== toPaused) return;
        done = true;
        run();
      });
      off = () => {
        done = true;
        stop();
      };
    };
    let last: { at: number; wasPaused: boolean } | null = null;
    const onUp = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      if (last && event.timeStamp - last.at < DOUBLE_TAP_MS) {
        // Vidstack ignores play()/pause() until its state has caught up with the first toggle, so wait for that.
        const { wasPaused } = last;
        settle(!wasPaused, () => (wasPaused ? remote.pause(event) : remote.play(event)));
        last = null;
        return;
      }
      last = { at: event.timeStamp, wasPaused: player.state.paused };
      remote.togglePaused(event);
    };
    provider.addEventListener("pointerup", onUp);
    return () => {
      off();
      provider.removeEventListener("pointerup", onUp);
    };
  }, [player, remote]);

  return null;
}
