"use client";

import { useEffect, useRef, useState } from "react";
import {
  CaptionButton,
  Captions as CaptionsLayer,
  Controls,
  FullscreenButton,
  Gesture,
  MuteButton,
  PlayButton,
  Time,
  TimeSlider,
  VolumeSlider,
  isTrackCaptionKind,
  useCaptionOptions,
  useMediaState,
  usePlaybackRateOptions,
  type CaptionOption,
  type PlaybackRateOption,
} from "@vidstack/react";
import {
  Captions,
  CaptionsOff,
  Check,
  Loader,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
          <Loader aria-hidden="true" />
        </div>
      ) : paused ? (
        <PlayButton
          className={cn("mc-hero", ended && "mc-hero--replay")}
          aria-label={ended ? copy.replay : copy.play}
        >
          {ended ? (
            <>
              <span className="mc-hero-icon-wrap">
                <RotateCcw className="mc-hero-icon" aria-hidden="true" />
              </span>
              <span className="mc-replay-label">{copy.replay}</span>
            </>
          ) : (
            <Play className="mc-hero-icon mc-hero-icon--play" fill="currentColor" aria-hidden="true" />
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
        ? <Play className="mc-icon mc-icon--play" fill="currentColor" />
        : <Pause className="mc-icon" fill="currentColor" />}
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
          ? <VolumeX className="mc-icon" />
          : volume < 0.5
            ? <Volume1 className="mc-icon" />
            : <Volume2 className="mc-icon" />}
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

function SpeedMenuSection({ onSelect }: { onSelect: () => void }) {
  const copy = usePlayerCopy();
  const options = usePlaybackRateOptions({ normalLabel: copy.normal });
  if (options.disabled) return null;

  return (
    <div className="mc-menu-section">
      <div className="mc-menu-heading">{copy.speed}</div>
      {options.map((option: PlaybackRateOption) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.selected}
          className="mc-menu-item"
          onClick={() => { option.select(); onSelect(); }}
        >
          <span>{option.label}</span>
          {option.selected && <Check className="mc-menu-check" />}
        </button>
      ))}
    </div>
  );
}

function CaptionsMenuSection({ onSelect }: { onSelect: () => void }) {
  const copy = usePlayerCopy();
  const options = useCaptionOptions({ off: copy.captionsOff });
  if (!options.length) return null;

  return (
    <div className="mc-menu-section">
      <div className="mc-menu-heading">{copy.captions}</div>
      {options.map((option: CaptionOption) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.selected}
          className="mc-menu-item"
          onClick={() => { option.select(); onSelect(); }}
        >
          <span>{option.label}</span>
          {option.selected && <Check className="mc-menu-check" />}
        </button>
      ))}
    </div>
  );
}

function SettingsMenu() {
  const copy = usePlayerCopy();
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

  return (
    <div className="mc-menu-root" ref={rootRef}>
      <button
        type="button"
        className="mc-btn"
        aria-label={copy.settings}
        title={copy.settings}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
      >
        <Settings className="mc-icon" />
      </button>
      {open && (
        <div className="mc-menu" role="menu" aria-label={copy.playerSettings}>
          <SpeedMenuSection onSelect={() => setOpen(false)} />
          <CaptionsMenuSection onSelect={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function CaptionToggle() {
  const copy = usePlayerCopy();
  const hasCaptions = useMediaState("hasCaptions");
  const track = useMediaState("textTrack");
  const isOn = Boolean(track && isTrackCaptionKind(track));
  if (!hasCaptions) return null;

  const label = isOn ? copy.disableCaptions : copy.enableCaptions;
  return (
    <CaptionButton className="mc-btn mc-caption" aria-label={label} title={label}>
      {isOn ? <Captions className="mc-icon" /> : <CaptionsOff className="mc-icon" />}
    </CaptionButton>
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
      {isFullscreen ? <Minimize className="mc-icon" /> : <Maximize className="mc-icon" />}
    </FullscreenButton>
  );
}

export default function PolutekControls({ className }: { className?: string }) {
  const controlsVisible = useMediaState("controlsVisible");

  return (
    <>
      <Gesture className="mc-gesture" event="pointerup" action="toggle:paused" />
      <Gesture className="mc-gesture" event="dblpointerup" action="toggle:fullscreen" />
      <CaptionsLayer className="vds-captions" />
      <CenterStage />
      <Controls.Root
        className={cn(
          "mc-controls",
          controlsVisible && "mc-controls--visible",
          className,
        )}
      >
        {/* scrim — gradient od dołu */}
        <div className="mc-scrim" />

        <Controls.Group className="mc-bottom">
          <div className="mc-bar">
            {/* scrubber na górze paska */}
            <ScrubBar />
            {/* przyciski pod scrubberem */}
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
                <CaptionToggle />
                <SettingsMenu />
                <FullscreenToggleButton />
              </div>
            </div>
          </div>
        </Controls.Group>
      </Controls.Root>

    </>
  );
}