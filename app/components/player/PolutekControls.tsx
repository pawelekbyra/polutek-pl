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
          {/* progress bar */}
          <ScrubBar />

          {/* pasek przycisków */}
          <div className="mc-bar">
            {/* lewa grupa */}
            <div className="mc-group">
              <PlayPauseButton />
              <VolumeControl />
              <div className="mc-time">
                <Time type="current" />
                <span aria-hidden="true" className="mc-time-sep">/</span>
                <Time type="duration" className="mc-time-dur" />
              </div>
            </div>
            {/* prawa grupa */}
            <div className="mc-group mc-group--right">
              <CaptionToggle />
              <SettingsMenu />
              <FullscreenToggleButton />
            </div>
          </div>
        </Controls.Group>
      </Controls.Root>

      <style jsx global>{`
        /* ── Gesty ── */
        .mc-gesture { position:absolute; inset:0; z-index:1; }

        /* ── Wrapper kontrolek ── */
        .mc-controls {
          position:absolute; inset:0; z-index:20;
          pointer-events:none;
          opacity:0; visibility:hidden;
          transition: opacity .18s ease, visibility 0s linear .18s;
          font-family: var(--font-geist-sans, ui-sans-serif), sans-serif;
        }
        .mc-controls--visible {
          opacity:1; visibility:visible;
          transition-delay:0s;
        }

        /* ── Scrim ── */
        .mc-scrim {
          position:absolute; inset:0;
          background: linear-gradient(
            to bottom,
            transparent 50%,
            rgba(0,0,0,.08) 68%,
            rgba(0,0,0,.72) 100%
          );
        }

        /* ── Bottom group ── */
        .mc-bottom {
          position:absolute; left:0; right:0; bottom:0;
          padding: 0 8px max(8px, env(safe-area-inset-bottom));
          pointer-events:auto;
        }

        /* ── Pasek przycisków ── */
        .mc-bar {
          display:flex;
          align-items:center;
          justify-content:space-between;
          height: 44px;
          gap: 4px;
          /* ciemne tło à la media-chrome */
          background: rgba(0,0,0,.62);
          backdrop-filter: blur(10px) saturate(1.4);
          -webkit-backdrop-filter: blur(10px) saturate(1.4);
          border-radius: 10px;
          padding: 0 4px;
          margin-top: 2px;
        }

        .mc-group { display:flex; align-items:center; gap:0; min-width:0; }
        .mc-group--right { justify-content:flex-end; }

        /* ── Przyciski ── */
        .mc-btn {
          display:grid; place-items:center;
          width:38px; height:38px;
          border:0; border-radius:8px;
          background:transparent;
          color: rgba(255,255,255,.9);
          transition: background .12s ease, color .12s ease, transform .1s ease;
          flex-shrink:0;
        }
        .mc-btn:hover { background: rgba(255,255,255,.12); color:#fff; }
        .mc-btn:active { transform:scale(.9); background: rgba(255,255,255,.18); }
        .mc-btn:focus-visible {
          outline:2px solid rgba(255,255,255,.8);
          outline-offset:1px;
        }

        /* ── Ikony (Lucide) ── */
        .mc-icon { width:18px; height:18px; stroke-width:1.75; flex-shrink:0; }
        .mc-icon--play { transform: translateX(1px); }

        /* ── Czas ── */
        .mc-time {
          display:flex; align-items:center; gap:4px;
          margin-left:2px;
          color: rgba(255,255,255,.9);
          font-size:12px; font-weight:600;
          font-variant-numeric: tabular-nums;
          white-space:nowrap;
          letter-spacing:.01em;
        }
        .mc-time-sep { color: rgba(255,255,255,.4); }
        .mc-time-dur { color: rgba(255,255,255,.5); }

        /* ── Progress scrubber ── */
        .mc-scrub {
          position:relative; display:flex;
          width:100%; height:20px;
          align-items:center;
          cursor:pointer; touch-action:none;
          margin-bottom:2px;
        }
        .mc-scrub-track {
          position:relative; width:100%;
          height:3px; border-radius:999px;
          background: rgba(255,255,255,.22);
          transition: height .14s ease;
          overflow:hidden;
        }
        .mc-scrub:hover .mc-scrub-track,
        .mc-scrub:focus-visible .mc-scrub-track { height:5px; }

        .mc-scrub-buffer {
          position:absolute; inset:0 auto 0 0;
          width:var(--slider-progress);
          background: rgba(255,255,255,.25);
        }
        .mc-scrub-fill {
          position:absolute; inset:0 auto 0 0;
          width:var(--slider-fill);
          background: #fff;
          border-radius:inherit;
        }
        .mc-scrub-thumb {
          position:absolute;
          left:var(--slider-fill);
          width:13px; height:13px;
          border-radius:999px;
          background:#fff;
          box-shadow:0 1px 4px rgba(0,0,0,.4);
          transform:translateX(-50%) scale(.6);
          opacity:0;
          transition: opacity .14s ease, transform .14s ease;
        }
        .mc-scrub:hover .mc-scrub-thumb,
        .mc-scrub:focus-within .mc-scrub-thumb,
        .mc-scrub[data-dragging] .mc-scrub-thumb {
          opacity:1; transform:translateX(-50%) scale(1);
        }

        /* preview tooltip */
        .mc-scrub-preview {
          position:absolute; bottom:24px;
          padding:4px 8px;
          border-radius:6px;
          background:rgba(0,0,0,.85);
          color:#fff;
          font-size:11px; font-weight:600;
          font-variant-numeric:tabular-nums;
          backdrop-filter:blur(8px);
          pointer-events:none;
          white-space:nowrap;
        }

        /* ── Volume slider ── */
        .mc-volume { display:flex; align-items:center; }
        .mc-vol-slider {
          position:relative; display:flex;
          width:0; height:28px;
          align-items:center;
          overflow:hidden; opacity:0;
          transition: width .18s ease, opacity .18s ease, margin .18s ease;
        }
        .mc-volume:hover .mc-vol-slider,
        .mc-volume:focus-within .mc-vol-slider {
          width:70px; margin-right:4px; opacity:1;
        }
        .mc-vol-track {
          position:relative; width:100%;
          height:3px; border-radius:999px;
          background: rgba(255,255,255,.25);
          overflow:hidden;
        }
        .mc-vol-fill {
          position:absolute; inset:0 auto 0 0;
          width:var(--slider-fill);
          background:#fff; border-radius:inherit;
        }
        .mc-vol-thumb {
          position:absolute; left:var(--slider-fill);
          width:11px; height:11px;
          border-radius:999px; background:#fff;
          box-shadow:0 1px 3px rgba(0,0,0,.35);
          transform:translateX(-50%);
          opacity:1;
        }

        /* ── Centrum (play hero / spinner) ── */
        .mc-center {
          position:absolute; inset:0; z-index:12;
          display:grid; place-items:center;
          pointer-events:none;
        }
        .mc-center--ended {
          background:linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.52));
        }

        .mc-hero {
          display:grid; place-items:center;
          width:58px; height:58px;
          border:0; border-radius:999px;
          background:rgba(0,0,0,.55);
          backdrop-filter:blur(8px);
          color:#fff;
          box-shadow:0 0 0 1px rgba(255,255,255,.2), 0 12px 32px rgba(0,0,0,.35);
          pointer-events:auto;
          transition: background .15s ease, transform .15s ease, box-shadow .15s ease;
        }
        .mc-hero:hover {
          background:rgba(0,0,0,.72);
          transform:scale(1.06);
          box-shadow:0 0 0 1px rgba(255,255,255,.3), 0 16px 40px rgba(0,0,0,.42);
        }
        .mc-hero:active { transform:scale(.95); }
        .mc-hero:focus-visible { outline:2px solid #fff; outline-offset:3px; }

        .mc-hero--replay {
          display:flex; align-items:center;
          width:auto; height:48px;
          padding:0 16px 0 10px; gap:10px;
          border-radius:12px;
          background:rgba(0,0,0,.65);
        }
        .mc-hero-icon-wrap {
          display:grid; place-items:center;
          width:30px; height:30px;
          border-radius:8px;
          background:rgba(255,255,255,.15);
        }
        .mc-hero-icon { width:24px; height:24px; stroke-width:1.75; }
        .mc-hero-icon-wrap .mc-hero-icon { width:16px; height:16px; }
        .mc-hero-icon--play { transform:translateX(2px); }
        .mc-replay-label { font-size:13px; font-weight:650; letter-spacing:-.01em; }

        .mc-spinner {
          display:grid; place-items:center;
          width:48px; height:48px;
          border-radius:999px;
          background:rgba(0,0,0,.5);
          backdrop-filter:blur(8px);
          color:#fff;
          box-shadow:0 0 0 1px rgba(255,255,255,.15);
        }
        .mc-spinner svg { width:22px; height:22px; animation:mc-spin .9s linear infinite; }

        /* ── Settings menu ── */
        .mc-menu-root { position:relative; }
        .mc-menu {
          position:absolute; right:0; bottom:46px;
          width:200px;
          max-height:min(320px,60vh);
          overflow:auto;
          padding:6px;
          border-radius:12px;
          background:rgba(10,10,10,.92);
          border:1px solid rgba(255,255,255,.1);
          box-shadow:0 16px 40px rgba(0,0,0,.5);
          backdrop-filter:blur(16px);
          color:#fff;
        }
        .mc-menu-section + .mc-menu-section {
          margin-top:6px; padding-top:6px;
          border-top:1px solid rgba(255,255,255,.08);
        }
        .mc-menu-heading {
          padding:4px 8px 3px;
          font-size:10px; font-weight:700;
          letter-spacing:.12em; text-transform:uppercase;
          color:rgba(255,255,255,.4);
        }
        .mc-menu-item {
          display:flex; align-items:center; justify-content:space-between;
          width:100%; min-height:38px;
          padding:6px 8px;
          border-radius:8px;
          font-size:13px; font-weight:600;
          color:rgba(255,255,255,.85);
          text-align:left;
          transition: background .12s ease, color .12s ease;
        }
        .mc-menu-item:hover,
        .mc-menu-item:focus-visible {
          background:rgba(255,255,255,.1); color:#fff; outline:none;
        }
        .mc-menu-check { width:15px; height:15px; stroke-width:2.4; color:rgba(255,255,255,.7); }

        /* ── Napisy ── */
        .polutek-vidstack-player .vds-captions { bottom:76px; font-family:var(--font-geist-sans,sans-serif); }

        /* ── Animacje ── */
        @keyframes mc-spin { to { transform:rotate(360deg); } }

        /* ── Mobile ── */
        @media (max-width:640px) {
          .mc-bottom { padding:0 4px max(6px,env(safe-area-inset-bottom)); }
          .mc-bar { height:42px; border-radius:8px; padding:0 2px; gap:2px; }
          .mc-btn { width:40px; height:40px; border-radius:8px; }
          .mc-icon { width:18px; height:18px; }
          .mc-time { font-size:11px; margin-left:0; }
          .mc-time-sep, .mc-time-dur { display:none; }
          .mc-volume { display:none; }
          .mc-scrub { height:18px; margin-bottom:1px; }
          .mc-hero { width:52px; height:52px; }
          .polutek-vidstack-player .vds-captions { bottom:70px; }
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion:reduce) {
          .mc-controls, .mc-btn, .mc-hero,
          .mc-vol-slider, .mc-scrub-track, .mc-scrub-thumb { transition:none; }
          .mc-spinner svg { animation:none; }
        }

        /* ── No hover (touch) — ukryj preview ── */
        @media (hover:none) { .mc-scrub-preview { display:none; } }
      `}</style>
    </>
  );
}
