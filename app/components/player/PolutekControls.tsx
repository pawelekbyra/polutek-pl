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
  LoaderCircle,
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

function CenterStage() {
  const paused = useMediaState("paused");
  const waiting = useMediaState("waiting");
  const ended = useMediaState("ended");

  return (
    <div
      className={cn(
        "polutek-player-center",
        ended && "polutek-player-center--ended",
      )}
      aria-hidden={!paused && !waiting}
    >
      {waiting ? (
        <div className="polutek-player-spinner" role="status" aria-label="Buforowanie">
          <LoaderCircle aria-hidden="true" />
        </div>
      ) : paused ? (
        <PlayButton
          className={cn(
            "polutek-player-hero",
            ended && "polutek-player-hero--replay",
          )}
          aria-label={ended ? "Odtwórz ponownie" : "Odtwórz"}
        >
          {ended ? (
            <>
              <span className="polutek-player-hero-icon-wrap">
                <RotateCcw className="polutek-player-hero-icon" aria-hidden="true" />
              </span>
              <span className="polutek-player-replay-label">Odtwórz ponownie</span>
            </>
          ) : (
            <Play
              className="polutek-player-hero-icon polutek-player-hero-icon--play"
              fill="currentColor"
              aria-hidden="true"
            />
          )}
        </PlayButton>
      ) : null}
    </div>
  );
}

function PlayPauseButton() {
  const paused = useMediaState("paused");
  const label = paused ? "Odtwórz" : "Pauza";

  return (
    <PlayButton className="polutek-player-btn" aria-label={label} title={label}>
      {paused ? (
        <Play className="polutek-player-icon polutek-player-icon--play" fill="currentColor" />
      ) : (
        <Pause className="polutek-player-icon" fill="currentColor" />
      )}
    </PlayButton>
  );
}

function VolumeControl() {
  const muted = useMediaState("muted");
  const volume = useMediaState("volume");
  const canSetVolume = useMediaState("canSetVolume");
  const isMuted = muted || volume === 0;
  const label = isMuted ? "Włącz dźwięk" : "Wycisz";

  return (
    <div className="polutek-player-volume">
      <MuteButton className="polutek-player-btn" aria-label={label} title={label}>
        {isMuted ? (
          <VolumeX className="polutek-player-icon" />
        ) : volume < 0.5 ? (
          <Volume1 className="polutek-player-icon" />
        ) : (
          <Volume2 className="polutek-player-icon" />
        )}
      </MuteButton>
      {canSetVolume && (
        <VolumeSlider.Root className="polutek-player-volume-slider" aria-label="Głośność">
          <VolumeSlider.Track className="polutek-player-volume-track">
            <VolumeSlider.TrackFill className="polutek-player-volume-fill" />
          </VolumeSlider.Track>
          <VolumeSlider.Thumb className="polutek-player-volume-thumb" />
        </VolumeSlider.Root>
      )}
    </div>
  );
}

function ScrubBar() {
  return (
    <TimeSlider.Root className="polutek-player-scrub" aria-label="Postęp odtwarzania">
      <TimeSlider.Track className="polutek-player-scrub-track">
        <TimeSlider.Progress className="polutek-player-scrub-buffer" />
        <TimeSlider.TrackFill className="polutek-player-scrub-fill" />
      </TimeSlider.Track>
      <TimeSlider.Thumb className="polutek-player-scrub-thumb" />
      <TimeSlider.Preview className="polutek-player-scrub-preview">
        <TimeSlider.Value />
      </TimeSlider.Preview>
    </TimeSlider.Root>
  );
}

function SpeedMenuSection({ onSelect }: { onSelect: () => void }) {
  const options = usePlaybackRateOptions({ normalLabel: "Normalna" });
  if (options.disabled) return null;

  return (
    <div className="polutek-player-menu-section">
      <div className="polutek-player-menu-heading">Prędkość</div>
      {options.map((option: PlaybackRateOption) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.selected}
          className="polutek-player-menu-item"
          onClick={() => {
            option.select();
            onSelect();
          }}
        >
          <span>{option.label}</span>
          {option.selected && <Check className="polutek-player-menu-check" />}
        </button>
      ))}
    </div>
  );
}

function CaptionsMenuSection({ onSelect }: { onSelect: () => void }) {
  const options = useCaptionOptions({ off: "Wyłączone" });
  if (!options.length) return null;

  return (
    <div className="polutek-player-menu-section">
      <div className="polutek-player-menu-heading">Napisy</div>
      {options.map((option: CaptionOption) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.selected}
          className="polutek-player-menu-item"
          onClick={() => {
            option.select();
            onSelect();
          }}
        >
          <span>{option.label}</span>
          {option.selected && <Check className="polutek-player-menu-check" />}
        </button>
      ))}
    </div>
  );
}

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="polutek-player-menu-root" ref={rootRef}>
      <button
        type="button"
        className="polutek-player-btn"
        aria-label="Ustawienia"
        title="Ustawienia"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Settings className="polutek-player-icon" />
      </button>
      {open && (
        <div className="polutek-player-menu" role="menu" aria-label="Ustawienia odtwarzacza">
          <SpeedMenuSection onSelect={() => setOpen(false)} />
          <CaptionsMenuSection onSelect={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function CaptionToggle() {
  const hasCaptions = useMediaState("hasCaptions");
  const track = useMediaState("textTrack");
  const isOn = Boolean(track && isTrackCaptionKind(track));
  if (!hasCaptions) return null;

  const label = isOn ? "Wyłącz napisy" : "Włącz napisy";
  return (
    <CaptionButton
      className="polutek-player-btn polutek-player-caption"
      aria-label={label}
      title={label}
    >
      {isOn ? (
        <Captions className="polutek-player-icon" />
      ) : (
        <CaptionsOff className="polutek-player-icon" />
      )}
    </CaptionButton>
  );
}

function FullscreenToggleButton() {
  const canFullscreen = useMediaState("canFullscreen");
  const isFullscreen = useMediaState("fullscreen");
  if (!canFullscreen) return null;

  const label = isFullscreen ? "Zamknij pełny ekran" : "Pełny ekran";
  return (
    <FullscreenButton className="polutek-player-btn" aria-label={label} title={label}>
      {isFullscreen ? (
        <Minimize className="polutek-player-icon" />
      ) : (
        <Maximize className="polutek-player-icon" />
      )}
    </FullscreenButton>
  );
}

export default function PolutekControls({ className }: { className?: string }) {
  const controlsVisible = useMediaState("controlsVisible");

  return (
    <>
      <Gesture className="polutek-player-gesture" event="pointerup" action="toggle:paused" />
      <Gesture className="polutek-player-gesture" event="dblpointerup" action="toggle:fullscreen" />
      <CaptionsLayer className="vds-captions" />
      <CenterStage />
      <Controls.Root
        className={cn(
          "polutek-player-controls",
          controlsVisible && "polutek-player-controls--visible",
          className,
        )}
      >
        <div className="polutek-player-scrim" />
        <Controls.Group className="polutek-player-bottom">
          <ScrubBar />
          <div className="polutek-player-row">
            <div className="polutek-player-row-group">
              <PlayPauseButton />
              <VolumeControl />
              <div className="polutek-player-time">
                <Time type="current" />
                <span aria-hidden="true">/</span>
                <Time type="duration" className="polutek-player-time-duration" />
              </div>
            </div>
            <div className="polutek-player-row-group polutek-player-row-group--right">
              <CaptionToggle />
              <SettingsMenu />
              <FullscreenToggleButton />
            </div>
          </div>
        </Controls.Group>
      </Controls.Root>
      <style jsx global>{`
        .polutek-player-gesture { position:absolute; inset:0; z-index:1; }
        .polutek-player-controls { position:absolute; inset:0; z-index:20; pointer-events:none; visibility:hidden; opacity:0; transition:opacity .24s ease,visibility 0s linear .24s; font-family:var(--font-space-grotesk,sans-serif); }
        .polutek-player-controls--visible { visibility:visible; opacity:1; transition-delay:0s; }
        .polutek-player-scrim { position:absolute; inset:0; background:linear-gradient(to bottom,transparent 60%,rgba(0,0,0,.5) 85%,rgba(0,0,0,.8) 100%); }
        .polutek-player-bottom { position:absolute; right:0; bottom:0; left:0; padding:16px 14px max(10px,env(safe-area-inset-bottom)); background:linear-gradient(to bottom,rgba(0,0,0,0),rgba(0,0,0,.7)); pointer-events:auto; }
        .polutek-player-row { display:flex; min-height:40px; align-items:center; justify-content:space-between; gap:10px; }
        .polutek-player-row-group { display:flex; min-width:0; align-items:center; gap:2px; }
        .polutek-player-row-group--right { justify-content:flex-end; }
        .polutek-player-btn { display:grid; width:36px; height:36px; place-items:center; border:0; border-radius:4px; color:#fff; background:transparent; cursor:pointer; transition:opacity .16s ease,transform .16s ease; }
        .polutek-player-btn:hover { opacity:.8; transform:scale(1.08); }
        .polutek-player-btn:active { opacity:.6; transform:scale(.96); }
        .polutek-player-btn:focus-visible { outline:2px solid #fff; outline-offset:2px; }
        .polutek-player-icon { width:20px; height:20px; stroke-width:2; }
        .polutek-player-icon--play { transform:translateX(1px); }
        .polutek-player-time { display:flex; align-items:center; gap:4px; margin-left:8px; color:#fff; font-size:12px; font-weight:500; letter-spacing:.01em; white-space:nowrap; font-variant-numeric:tabular-nums; }
        .polutek-player-time-duration,.polutek-player-time span { color:rgba(255,255,255,.7); }

        /* ---- Progress scrubber ---- */
        .polutek-player-scrub { position:relative; display:flex; width:100%; height:24px; align-items:center; cursor:pointer; touch-action:none; margin-bottom:8px; }
        .polutek-player-scrub-track,.polutek-player-volume-track { position:relative; width:100%; height:4px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.25); transition:height .16s ease; }
        .polutek-player-scrub:hover .polutek-player-scrub-track,.polutek-player-scrub:focus-visible .polutek-player-scrub-track { height:5px; }
        .polutek-player-scrub-buffer { position:absolute; inset:0 auto 0 0; width:var(--slider-progress); background:rgba(255,255,255,.45); }
        .polutek-player-scrub-fill,.polutek-player-volume-fill { position:absolute; inset:0 auto 0 0; width:var(--slider-fill); border-radius:inherit; background:#fff; }
        .polutek-player-scrub-thumb,.polutek-player-volume-thumb { position:absolute; left:var(--slider-fill); width:12px; height:12px; border:0; border-radius:999px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.6); opacity:0; transform:translateX(-50%) scale(.6); transition:opacity .16s ease,transform .16s ease; }
        .polutek-player-scrub:hover .polutek-player-scrub-thumb,.polutek-player-scrub:focus-within .polutek-player-scrub-thumb,.polutek-player-scrub[data-dragging] .polutek-player-scrub-thumb { opacity:1; transform:translateX(-50%) scale(1); }
        .polutek-player-scrub-preview { position:absolute; bottom:28px; padding:5px 8px; border-radius:4px; background:rgba(0,0,0,.9); color:#fff; box-shadow:0 4px 16px rgba(0,0,0,.6); font-size:11px; font-weight:500; font-variant-numeric:tabular-nums; white-space:nowrap; }

        /* ---- Volume ---- */
        .polutek-player-volume { display:flex; align-items:center; }
        .polutek-player-volume-slider { position:relative; display:flex; width:0; height:26px; align-items:center; overflow:hidden; opacity:0; transition:width .18s ease,opacity .18s ease,margin .18s ease; }
        .polutek-player-volume:hover .polutek-player-volume-slider,.polutek-player-volume:focus-within .polutek-player-volume-slider { width:72px; margin-right:6px; opacity:1; }
        .polutek-player-volume-track { height:3px; }
        .polutek-player-volume-thumb { width:10px; height:10px; opacity:1; transform:translateX(-50%); }

        /* ---- Center play button ---- */
        .polutek-player-center { position:absolute; inset:0; z-index:12; display:grid; place-items:center; pointer-events:none; }
        .polutek-player-center--ended { background:rgba(0,0,0,.3); }
        .polutek-player-hero { position:relative; display:grid; width:72px; height:72px; place-items:center; border:2px solid #fff; border-radius:999px; background:rgba(255,255,255,.95); color:#000; pointer-events:auto; transition:transform .18s ease,box-shadow .18s ease,background .18s ease; }
        .polutek-player-hero:hover { background:#fff; transform:scale(1.08); box-shadow:0 8px 32px rgba(0,0,0,.6); }
        .polutek-player-hero:active { transform:scale(.94); }
        .polutek-player-hero:focus-visible { outline:2px solid #fff; outline-offset:4px; box-shadow:0 8px 32px rgba(0,0,0,.6); }
        .polutek-player-hero--replay { display:flex; width:auto; height:48px; padding:0 20px 0 12px; gap:10px; border-radius:12px; background:#fff; color:#000; border:none; }
        .polutek-player-hero--replay:hover { background:#f5f5f5; }
        .polutek-player-hero-icon-wrap { display:grid; width:32px; height:32px; place-items:center; border-radius:6px; background:rgba(0,0,0,.08); color:#000; }
        .polutek-player-hero-icon { width:28px; height:28px; stroke-width:2; }
        .polutek-player-hero-icon-wrap .polutek-player-hero-icon { width:18px; height:18px; }
        .polutek-player-hero-icon--play { transform:translateX(2px); }
        .polutek-player-replay-label { font-size:13px; font-weight:600; letter-spacing:-.01em; }
        .polutek-player-spinner { display:grid; width:52px; height:52px; place-items:center; border:2px solid rgba(255,255,255,.3); border-radius:999px; background:rgba(0,0,0,.3); color:#fff; box-shadow:0 4px 16px rgba(0,0,0,.5); }
        .polutek-player-spinner svg { width:24px; height:24px; animation:polutek-spin .8s linear infinite; }

        /* ---- Settings menu ---- */
        .polutek-player-menu-root { position:relative; }
        .polutek-player-menu { position:absolute; right:0; bottom:44px; width:200px; max-height:min(320px,60vh); overflow:auto; padding:8px 0; border-radius:4px; background:rgba(0,0,0,.95); color:#fff; box-shadow:0 8px 32px rgba(0,0,0,.8); border:1px solid rgba(255,255,255,.1); }
        .polutek-player-menu-section + .polutek-player-menu-section { border-top:1px solid rgba(255,255,255,.1); padding-top:8px; margin-top:8px; }
        .polutek-player-menu-heading { padding:8px 16px 6px; color:rgba(255,255,255,.6); font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
        .polutek-player-menu-item { display:flex; width:100%; min-height:38px; align-items:center; justify-content:space-between; padding:0 16px; border:0; background:transparent; color:#fff; font-size:13px; font-weight:500; text-align:left; cursor:pointer; transition:background-color .14s ease,color .14s ease; }
        .polutek-player-menu-item:hover { background:rgba(255,255,255,.1); }
        .polutek-player-menu-item:focus-visible { outline:2px solid #fff; outline-offset:-2px; }
        .polutek-player-menu-check { width:16px; height:16px; color:#fff; stroke-width:2.4; }

        .polutek-vidstack-player .vds-captions { bottom:88px; font-family:var(--font-space-grotesk,sans-serif); }
        @keyframes polutek-spin { to { transform:rotate(360deg); } }

        @media (max-width:640px) {
          .polutek-player-bottom { padding:12px 10px max(8px,env(safe-area-inset-bottom)); }
          .polutek-player-row { min-height:40px; gap:4px; }
          .polutek-player-btn { width:40px; height:40px; }
          .polutek-player-icon { width:20px; height:20px; }
          .polutek-player-row-group { gap:0; }
          .polutek-player-time { margin-left:6px; font-size:11px; }
          .polutek-player-time-duration,.polutek-player-time span { display:none; }
          .polutek-player-volume { display:none; }
          .polutek-player-scrub { height:26px; margin-bottom:10px; }
          .polutek-player-scrub-track { height:5px; }
          .polutek-player-scrub-thumb { width:14px; height:14px; opacity:1; transform:translateX(-50%) scale(1); }
          .polutek-player-hero { width:64px; height:64px; }
          .polutek-player-hero--replay { width:auto; height:46px; padding:0 18px 0 11px; }
          .polutek-player-menu { right:-32px; bottom:48px; width:min(196px,calc(100vw - 20px)); }
          .polutek-vidstack-player .vds-captions { bottom:82px; }
        }
        @media (max-width:360px) { .polutek-player-caption { display:none; } }
        @media (hover:none) { .polutek-player-scrub-preview { display:none; } }
        @media (prefers-reduced-motion:reduce) { .polutek-player-controls,.polutek-player-btn,.polutek-player-hero,.polutek-player-volume-slider,.polutek-player-scrub-track,.polutek-player-scrub-thumb { transition:none; } .polutek-player-spinner svg { animation-duration:1.4s; } }
      `}</style>
    </>
  );
}
