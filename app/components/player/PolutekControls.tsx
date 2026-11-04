"use client";

import { Captions as CaptionsLayer, Gesture, PlayButton, useMediaState } from "@vidstack/react";
import { cn } from "@/lib/utils";
import { SpinnerArcIcon } from "../icons/MarkerUiIcons";
import { CaptionsSync, CaptionsToggleButton } from "./CaptionsToggle";
import { PlayerSettingsMenu } from "./PlayerSettingsMenu";
import { ChaptersMenu } from "./chapters/ChaptersMenu";
import { ChaptersMenuProvider } from "./chapters/chapters-menu-context";
import {
  DurationLabel,
  FullscreenToggleButton,
  PlayPauseButton,
  PipToggleButton,
  VolumeControl,
} from "./controls/ControlButtons";
import { InstantTapToggle } from "./controls/InstantTapToggle";
import { PlayIcon, ReplayIcon } from "./controls/PlayerIconSet";
import { ScrubBar } from "./controls/ScrubBar";
import { usePlayerCopy } from "./polutek-controls-copy";

/**
 * Rendered size of the centre glyph (`.mc-hero-icon`, 42% of the disc: 27px at the 64px desktop size) and the replay arrow's pen on screen. The set's thin
 * pen (ICON_PEN_PX 1.2px) looked frail next to the solid play triangle in the preview sheet, so the arrow uses 1.8px,
 * the weight at which it balances the filled triangle (still round caps, Marker path).
 */
const HERO_GLYPH_PX = 27;
const HERO_REPLAY_PEN_PX = 1.8;
const HERO_REPLAY_STROKE = Math.round(((HERO_REPLAY_PEN_PX * 24) / HERO_GLYPH_PX) * 1000) / 1000;

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
          <SpinnerArcIcon className="mc-spinner-arc" />
        </div>
      ) : paused ? (
        <PlayButton className="mc-hero" aria-label={label} title={label}>
          {ended
            ? <ReplayIcon className="mc-hero-icon" testId="replay-icon" strokeWidth={HERO_REPLAY_STROKE} />
            : <PlayIcon solid className="mc-hero-icon" testId="play-icon" />}
        </PlayButton>
      ) : null}
    </div>
  );
}

/**
 * The player's own controls (no Vidstack layout, no Controls.Root: a plain div keeps Vidstack's CSS out of it).
 * One slim row over a bottom scrim, everything on one baseline play/pause (left) | progress track with the time chip |
 * duration (wide screens) | sound, captions, chapters, picture-in-picture, quality/settings, fullscreen. Narrow
 * screens drop the duration, the slider part of the volume, the chapters and picture-in-picture buttons (both stay
 * reachable from the settings menu), so a 360px phone keeps a long track. Visibility follows Vidstack's
 * `controlsVisible` (auto-hide after `controlsDelay`, shown on pointer activity and while paused).
 */
export default function PolutekControls({ className }: { className?: string }) {
  const controlsVisible = useMediaState("controlsVisible");

  return (
    <ChaptersMenuProvider>
      <InstantTapToggle />
      <Gesture className="mc-gesture" event="dblpointerup" action="toggle:fullscreen" />
      <CaptionsSync />
      <CaptionsLayer className="vds-captions" />
      <CenterStage />
      <div className={cn("mc-controls", controlsVisible && "mc-controls--visible", className)}>
        <div className="mc-scrim" />
        <div className="mc-bottom">
          <div className="mc-bar">
            <PlayPauseButton />
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
