"use client";

import { Captions as CaptionsLayer, Gesture, PlayButton, useMediaState } from "@vidstack/react";
import { cn } from "@/lib/utils";
import { CaptionsSync, CaptionsToggleButton } from "./CaptionsToggle";
import { PlayerSettingsMenu } from "./PlayerSettingsMenu";
import { ChaptersMenu } from "./chapters/ChaptersMenu";
import { ChaptersMenuProvider } from "./chapters/chapters-menu-context";
import {
  DurationLabel,
  FullscreenToggleButton,
  PipToggleButton,
  VolumeControl,
} from "./controls/ControlButtons";
import { PlayGlyph, ReplayGlyph } from "./controls/PlayerIcons";
import { ScrubBar } from "./controls/ScrubBar";
import { usePlayerCopy } from "./polutek-controls-copy";

function CenterStage() {
  const copy = usePlayerCopy();
  const paused = useMediaState("paused");
  const waiting = useMediaState("waiting");
  const ended = useMediaState("ended");

  // One button, one class set: the ended state only swaps the glyph (replay arrow instead of the
  // play triangle) and the accessible name. Size, circle, shadow, hover and focus ring are shared
  // by construction, so the two cannot drift apart again. No visible label: the icon is the cue.
  const label = ended ? copy.replay : copy.play;

  return (
    <div
      className={cn("mc-center", ended && "mc-center--ended")}
      aria-hidden={!paused && !waiting}
    >
      {waiting ? (
        <div className="mc-spinner" role="status" aria-label={copy.buffering}>
          <span className="mc-spinner-ring" aria-hidden="true" />
        </div>
      ) : paused ? (
        <PlayButton className="mc-hero" aria-label={label} title={label}>
          {ended
            ? <ReplayGlyph className="mc-hero-icon" testId="replay-icon" />
            : <PlayGlyph className="mc-hero-icon" testId="play-icon" />}
        </PlayButton>
      ) : null}
    </div>
  );
}

/**
 * The player's own controls (no Vidstack layout, no Controls.Root: a plain div keeps Vidstack's CSS out of it).
 * One slim row over a bottom scrim, everything on one baseline (no play/pause button: tap the video or press k/space): progress track with the time chip |
 * duration (wide screens) | sound, captions, chapters, picture-in-picture, quality/settings, fullscreen. Narrow
 * screens drop the duration, the slider part of the volume, the chapters and picture-in-picture buttons (both stay
 * reachable from the settings menu), so a 360px phone keeps a long track. Visibility follows Vidstack's
 * `controlsVisible` (auto-hide after `controlsDelay`, shown on pointer activity and while paused).
 */
export default function PolutekControls({ className }: { className?: string }) {
  const controlsVisible = useMediaState("controlsVisible");

  return (
    <ChaptersMenuProvider>
      <Gesture className="mc-gesture" event="pointerup" action="toggle:paused" />
      <Gesture className="mc-gesture" event="dblpointerup" action="toggle:fullscreen" />
      <CaptionsSync />
      <CaptionsLayer className="vds-captions" />
      <CenterStage />
      <div className={cn("mc-controls", controlsVisible && "mc-controls--visible", className)}>
        <div className="mc-scrim" />
        <div className="mc-bottom">
          <div className="mc-bar">
            <div className="mc-track-area">
              <ScrubBar />
            </div>
            <DurationLabel />
            <div className="mc-group">
              <VolumeControl />
              <CaptionsToggleButton />
              <ChaptersMenu />
              <PipToggleButton />
              <PlayerSettingsMenu />
              <FullscreenToggleButton />
            </div>
          </div>
        </div>
      </div>
    </ChaptersMenuProvider>
  );
}
