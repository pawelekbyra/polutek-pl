"use client";

import { useEffect, useId } from "react";
import { isTrackCaptionKind, useMediaPlayer, useMediaRemote, useMediaState } from "@vidstack/react";
import { useCaptionsEnabled } from "./captions";
import { usePlayerCopy } from "./polutek-controls-copy";

/**
 * The CC glyph, drawn like the rest of the bar's line icons (20px box, 1.5px stroke): a rounded frame with two
 * "C" arcs. `crossed` adds a diagonal slash with a cut-out gap around it (captions off).
 */
export function CaptionsIcon({ crossed }: { crossed: boolean }) {
  const maskId = `mc-cc-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 20 20"
      width={20}
      height={20}
      className="mc-icon"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-crossed={crossed ? "true" : "false"}
    >
      {crossed && (
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
            <rect width="20" height="20" fill="white" stroke="none" />
            <line x1="2" y1="2" x2="18" y2="18" stroke="black" strokeWidth="4.5" />
          </mask>
        </defs>
      )}
      <g mask={crossed ? `url(#${maskId})` : undefined}>
        <rect x="2.25" y="4.25" width="15.5" height="11.5" rx="3" />
        <path d="M9.1 8.4a2 2 0 1 0 0 3.2" />
        <path d="M14.1 8.4a2 2 0 1 0 0 3.2" />
      </g>
      {crossed && <line x1="3" y1="3" x2="17" y2="17" />}
    </svg>
  );
}

/**
 * Captions on/off switch. Always in the row so the control is easy to find; when the video has no caption track
 * in the page language (VideoPlayer mounts only that one) it shows the crossed icon, dimmed and inert.
 * Plain CC icon = captions on, crossed CC = off. The label stays "Captions" and the state is in
 * aria-pressed (a toggle button must not also change its name); the tooltip says what a click does.
 */
export function CaptionsToggleButton() {
  const copy = usePlayerCopy();
  const remote = useMediaRemote();
  const hasCaptions = useMediaState("hasCaptions");
  const track = useMediaState("textTrack");
  if (!hasCaptions) {
    return (
      <button type="button" className="mc-btn mc-caption mc-caption--none" aria-label={copy.captions} aria-disabled="true" title={copy.captions} tabIndex={-1}>
        <CaptionsIcon crossed />
      </button>
    );
  }

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
