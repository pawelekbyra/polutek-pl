"use client";

import { useEffect } from "react";
import { isTrackCaptionKind, useMediaPlayer, useMediaRemote, useMediaState, type TextTrack } from "@vidstack/react";
import { pickCaptionTrack, useCaptionLanguage, useCaptionsEnabled } from "./captions";
import { useOptionalLanguage } from "../LanguageContext";
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
 * it shows the crossed icon, inert (full white, crossed).
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
 * Applies the viewer's captions choice to the available tracks, including after a source renewal or
 * a preference change in another tab.
 */
export function CaptionsSync() {
  const player = useMediaPlayer();
  const tracks = useMediaState("textTracks");
  const enabled = useCaptionsEnabled();
  const preferredLanguage = useCaptionLanguage();
  const pageLanguage = useOptionalLanguage();

  // `tracks` re-runs this when a source is added or renewed. Preserve the viewer's explicit
  // language choice; otherwise prefer the page language and fall back to an available track.
  useEffect(() => {
    if (!player) return;
    const captions = Array.from(player.textTracks).filter((track): track is TextTrack => Boolean(track && isTrackCaptionKind(track)));
    const current = captions.find((track) => track.mode === "showing");
    const target = enabled
      ? (preferredLanguage
          ? pickCaptionTrack(captions, pageLanguage, preferredLanguage)
          : current ?? pickCaptionTrack(captions, pageLanguage))
      : null;
    for (const track of captions) {
      const mode = track === target ? "showing" : "disabled";
      if (track.mode !== mode) track.setMode(mode);
    }
  }, [player, tracks, enabled, preferredLanguage, pageLanguage]);

  return null;
}
