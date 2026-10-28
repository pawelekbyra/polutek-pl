"use client";

import { useEffect } from "react";
import { isTrackCaptionKind, useMediaPlayer, useMediaRemote, useMediaState } from "@vidstack/react";
import { useCaptionsEnabled } from "./captions";
import { CaptionsOffIcon, CaptionsOnIcon } from "./controls/PlayerIconSet";
import { usePlayerCopy } from "./polutek-controls-copy";

/**
 * The CC glyph of the "Marker" set: `CaptionsOnIcon` (rounded frame with two "C" arcs), and for captions off
 * `CaptionsOffIcon` (the same with a diagonal slash). `data-crossed` tells the two apart for CSS and tests.
 */
export function CaptionsIcon({ crossed }: { crossed: boolean }) {
  const Icon = crossed ? CaptionsOffIcon : CaptionsOnIcon;
  return <Icon className="mc-icon" data-crossed={crossed ? "true" : "false"} />;
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
