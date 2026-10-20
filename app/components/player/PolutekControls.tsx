"use client";

import {
  Captions as CaptionsLayer,
  FullscreenButton,
  Gesture,
  MuteButton,
  PlayButton,
  Time,
  TimeSlider,
  VolumeSlider,
  useMediaState,
} from "@vidstack/react";
import {
  FullscreenExitIcon,
  FullscreenIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  VolumeHighIcon,
  VolumeLowIcon,
} from "@vidstack/react/icons";
import { cn } from "@/lib/utils";
import { CaptionsSync, CaptionsToggleButton } from "./CaptionsToggle";
import { PlayerSettingsMenu } from "./PlayerSettingsMenu";
import { ChapterLabel } from "./chapters/ChapterLabel";
import { ChaptersMenu } from "./chapters/ChaptersMenu";
import { ChaptersMenuProvider } from "./chapters/chapters-menu-context";
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
            ? <ReplayIcon className="mc-hero-icon" aria-hidden="true" />
            : <PlayIcon className="mc-hero-icon" aria-hidden="true" />}
        </PlayButton>
      ) : null}
    </div>
  );
}

function PlayPauseButton() {
  const copy = usePlayerCopy();
  const paused = useMediaState("paused");
  const label = paused ? copy.play : copy.pause;

  return (
    <PlayButton className="mc-btn" aria-label={label} title={label}>
      {paused
        ? <PlayIcon className="mc-icon" />
        : <PauseIcon className="mc-icon" />}
    </PlayButton>
  );
}

function VolumeControl() {
  const copy = usePlayerCopy();
  const muted = useMediaState("muted");
  const volume = useMediaState("volume");
  const canSetVolume = useMediaState("canSetVolume");
  const isMuted = muted || volume === 0;
  const label = isMuted ? copy.unmute : copy.mute;

  return (
    <div className="mc-volume">
      <MuteButton className="mc-btn" aria-label={label} title={label}>
        {isMuted
          ? <MuteIcon className="mc-icon" />
          : volume < 0.5
            ? <VolumeLowIcon className="mc-icon" />
            : <VolumeHighIcon className="mc-icon" />}
      </MuteButton>
      {canSetVolume && (
        <VolumeSlider.Root className="mc-vol-slider" aria-label={copy.volume}>
          <VolumeSlider.Track className="mc-vol-track">
            <VolumeSlider.TrackFill className="mc-vol-fill" />
          </VolumeSlider.Track>
          <VolumeSlider.Thumb className="mc-vol-thumb" />
        </VolumeSlider.Root>
      )}
    </div>
  );
}

function ScrubBar() {
  const copy = usePlayerCopy();
  return (
    <TimeSlider.Root className="mc-scrub" aria-label={copy.progress}>
      {/* One segment per chapter (Vidstack sizes them); without chapters there is one, as before. */}
      <TimeSlider.Chapters className="mc-scrub-chapters">
        {(cues, forwardRef) =>
          cues.map((cue) => (
            <div key={cue.startTime} ref={forwardRef} className="mc-scrub-chapter">
              <TimeSlider.Track className="mc-scrub-track">
                <TimeSlider.Progress className="mc-scrub-buffer" />
                <TimeSlider.TrackFill className="mc-scrub-fill" />
              </TimeSlider.Track>
            </div>
          ))
        }
      </TimeSlider.Chapters>
      <TimeSlider.Thumb className="mc-scrub-thumb" />
      <TimeSlider.Preview className="mc-scrub-preview">
        <TimeSlider.Value />
        <TimeSlider.ChapterTitle className="mc-scrub-preview-chapter" />
      </TimeSlider.Preview>
    </TimeSlider.Root>
  );
}

function FullscreenToggleButton() {
  const copy = usePlayerCopy();
  const canFullscreen = useMediaState("canFullscreen");
  const isFullscreen = useMediaState("fullscreen");
  if (!canFullscreen) return null;

  const label = isFullscreen ? copy.exitFullscreen : copy.fullscreen;
  return (
    <FullscreenButton className="mc-btn" aria-label={label} title={label}>
      {isFullscreen ? <FullscreenExitIcon className="mc-icon" /> : <FullscreenIcon className="mc-icon" />}
    </FullscreenButton>
  );
}

export default function PolutekControls({ className }: { className?: string }) {
  const controlsVisible = useMediaState("controlsVisible");

  return (
    <ChaptersMenuProvider>
      <Gesture className="mc-gesture" event="pointerup" action="toggle:paused" />
      <Gesture className="mc-gesture" event="dblpointerup" action="toggle:fullscreen" />
      <CaptionsSync />
      <CaptionsLayer className="vds-captions" />
      <CenterStage />
      {/* zwykły div zamiast Controls.Root — eliminuje Vidstack CSS interference */}
      <div
        className={cn(
          "mc-controls",
          controlsVisible && "mc-controls--visible",
          className,
        )}
      >
        <div className="mc-scrim" />
        <div className="mc-bottom">
          <div className="mc-bar">
            <ScrubBar />
            <div className="mc-row">
              <div className="mc-group">
                <PlayPauseButton />
                <VolumeControl />
                <div className="mc-time">
                  <Time type="current" />
                  <span aria-hidden="true" className="mc-time-sep">/</span>
                  <Time type="duration" className="mc-time-dur" />
                  <ChapterLabel />
                </div>
              </div>
              <div className="mc-group mc-group--right">
                <CaptionsToggleButton />
                <ChaptersMenu />
                <PlayerSettingsMenu />
                <FullscreenToggleButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChaptersMenuProvider>
  );
}