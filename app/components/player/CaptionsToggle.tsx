"use client";

import { useEffect, useId } from "react";
import { isTrackCaptionKind, useMediaPlayer, useMediaRemote, useMediaState } from "@vidstack/react";
import { useCaptionsEnabled } from "./captions";
import { usePlayerCopy } from "./polutek-controls-copy";

// Vidstack's closed-captions glyph (media-icons "closed-captions", 32x32).
const CC_PATH =
  "M4.6661 6.66699C4.29791 6.66699 3.99943 6.96547 3.99943 7.33366V24.667C3.99943 25.0352 4.29791 25.3337 4.6661 25.3337H27.3328C27.701 25.3337 27.9994 25.0352 27.9994 24.667V7.33366C27.9994 6.96547 27.701 6.66699 27.3328 6.66699H4.6661ZM8.66667 21.3333C8.29848 21.3333 8 21.0349 8 20.6667V11.3333C8 10.9651 8.29848 10.6667 8.66667 10.6667H14C14.3682 10.6667 14.6667 10.9651 14.6667 11.3333V12.6667C14.6667 13.0349 14.3682 13.3333 14 13.3333H10.8C10.7264 13.3333 10.6667 13.393 10.6667 13.4667V18.5333C10.6667 18.607 10.7264 18.6667 10.8 18.6667H14C14.3682 18.6667 14.6667 18.9651 14.6667 19.3333V20.6667C14.6667 21.0349 14.3682 21.3333 14 21.3333H8.66667ZM18 21.3333C17.6318 21.3333 17.3333 21.0349 17.3333 20.6667V11.3333C17.3333 10.9651 17.6318 10.6667 18 10.6667H23.3333C23.7015 10.6667 24 10.9651 24 11.3333V12.6667C24 13.0349 23.7015 13.3333 23.3333 13.3333H20.1333C20.0597 13.3333 20 13.393 20 13.4667V18.5333C20 18.607 20.0597 18.6667 20.1333 18.6667H23.3333C23.7015 18.6667 24 18.9651 24 19.3333V20.6667C24 21.0349 23.7015 21.3333 23.3333 21.3333H18Z";

/** The CC glyph; `crossed` adds a diagonal slash with a cut-out gap around it (captions off). */
export function CaptionsIcon({ crossed }: { crossed: boolean }) {
  const maskId = `mc-cc-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 32 32"
      className="mc-icon"
      aria-hidden="true"
      focusable="false"
      data-crossed={crossed ? "true" : "false"}
    >
      {crossed && (
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
            <rect width="32" height="32" fill="white" />
            <line x1="3" y1="3" x2="29" y2="29" stroke="black" strokeWidth="6" strokeLinecap="round" />
          </mask>
        </defs>
      )}
      <path
        d={CC_PATH}
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        mask={crossed ? `url(#${maskId})` : undefined}
      />
      {crossed && (
        <line x1="4" y1="4" x2="28" y2="28" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Captions on/off switch. Shown only when the video has a caption track in the page language
 * (VideoPlayer mounts only that one); without it there is nothing to switch, so no button.
 * Plain CC icon = captions on, crossed CC = off. The label stays "Captions" and the state is in
 * aria-pressed (a toggle button must not also change its name); the tooltip says what a click does.
 */
export function CaptionsToggleButton() {
  const copy = usePlayerCopy();
  const remote = useMediaRemote();
  const hasCaptions = useMediaState("hasCaptions");
  const track = useMediaState("textTrack");
  if (!hasCaptions) return null;

  const isOn = Boolean(track && isTrackCaptionKind(track));
  const hint = isOn ? copy.disableCaptions : copy.enableCaptions;
  return (
    <button
      type="button"
      className="mc-btn mc-caption"
      aria-label={copy.captions}
      aria-pressed={isOn}
      aria-keyshortcuts="c"
      title={`${hint} (c)`}
      onClick={(event) => remote.toggleCaptions(event.nativeEvent)}
    >
      <CaptionsIcon crossed={!isOn} />
    </button>
  );
}

/**
 * Applies the viewer's captions choice to the player's caption track: on its first appearance (a
 * new video, a language switch) and whenever the choice changes, also from another tab.
 */
export function CaptionsSync() {
  const player = useMediaPlayer();
  const tracks = useMediaState("textTracks");
  const enabled = useCaptionsEnabled();

  // `tracks` (state) re-runs this when a track is added; the modes are set on the player's own list.
  useEffect(() => {
    if (!player) return;
    let shown = false;
    for (const track of player.textTracks) {
      if (!isTrackCaptionKind(track)) continue;
      const mode = enabled && !shown ? "showing" : "disabled";
      if (mode === "showing") shown = true;
      if (track.mode !== mode) track.setMode(mode);
    }
  }, [player, tracks, enabled]);

  return null;
}
