"use client";

import { useEffect, useRef, useState } from "react";
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
  usePlaybackRateOptions,
  type PlaybackRateOption,
} from "@vidstack/react";
import {
  CheckIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  MuteIcon,
  OdometerIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  VolumeHighIcon,
  VolumeLowIcon,
} from "@vidstack/react/icons";
import { cn } from "@/lib/utils";
import { CaptionsSync, CaptionsToggleButton } from "./CaptionsToggle";
import { usePlayerCopy } from "./polutek-controls-copy";

function CenterStage() {
  const copy = usePlayerCopy();
  const paused = useMediaState("paused");
  const waiting = useMediaState("waiting");
  const ended = useMediaState("ended");

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
        <PlayButton
          className={cn("mc-hero", ended && "mc-hero--replay")}
          aria-label={ended ? copy.replay : copy.play}
        >
          {ended ? (
            <>
              <span className="mc-hero-icon-wrap">
                <ReplayIcon className="mc-hero-icon" aria-hidden="true" />
              </span>
              <span className="mc-replay-label">{copy.replay}</span>
            </>
          ) : (
            <PlayIcon className="mc-hero-icon" aria-hidden="true" />
          )}
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
      <TimeSlider.Track className="mc-scrub-track">
        <TimeSlider.Progress className="mc-scrub-buffer" />
        <TimeSlider.TrackFill className="mc-scrub-fill" />
      </TimeSlider.Track>
      <TimeSlider.Thumb className="mc-scrub-thumb" />
      <TimeSlider.Preview className="mc-scrub-preview">
        <TimeSlider.Value />
      </TimeSlider.Preview>
    </TimeSlider.Root>
  );
}

/** Playback speed: its own button (odometer icon) and menu. Captions have their own switch. */
function SpeedMenu() {
  const copy = usePlayerCopy();
  const options = usePlaybackRateOptions({ normalLabel: copy.normal });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (options.disabled) return null;

  return (
    <div className="mc-menu-root" ref={rootRef}>
      <button
        type="button"
        className="mc-btn"
        aria-label={copy.playbackSpeed}
        title={copy.playbackSpeed}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
      >
        <OdometerIcon className="mc-icon" />
      </button>
      {open && (
        <div className="mc-menu" role="menu" aria-label={copy.playbackSpeed}>
          <div className="mc-menu-heading">{copy.speed}</div>
          {options.map((option: PlaybackRateOption) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.selected}
              className="mc-menu-item"
              onClick={() => { option.select(); setOpen(false); }}
            >
              <span>{option.label}</span>
              {option.selected && <CheckIcon className="mc-menu-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
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
    <>
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
                </div>
              </div>
              <div className="mc-group mc-group--right">
                <CaptionsToggleButton />
                <SpeedMenu />
                <FullscreenToggleButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}