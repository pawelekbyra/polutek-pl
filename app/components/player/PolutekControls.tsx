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
          <div className="polutek-glass polutek-glass--bar">
            <span className="polutek-glass-effect" aria-hidden="true" />
            <span className="polutek-glass-noise" aria-hidden="true" />
            <span className="polutek-glass-edge" aria-hidden="true" />
            <div className="polutek-glass-content">
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
            </div>
          </div>
        </Controls.Group>
      </Controls.Root>
      <style jsx global>{`
        .polutek-player-gesture { position:absolute; inset:0; z-index:1; }
        .polutek-player-controls { position:absolute; inset:0; z-index:20; pointer-events:none; visibility:hidden; opacity:0; transition:opacity .2s ease,visibility 0s linear .2s; font-family:var(--font-space-grotesk,sans-serif); }
        .polutek-player-controls--visible { visibility:visible; opacity:1; transition-delay:0s; }
        .polutek-player-scrim { position:absolute; inset:0; background:linear-gradient(to bottom,transparent 52%,rgba(3,7,18,.28) 78%,rgba(3,7,18,.6) 100%); }
        .polutek-player-bottom { position:absolute; right:0; bottom:0; left:0; padding:0 12px max(12px,env(safe-area-inset-bottom)); pointer-events:auto; }

        /* ---- Liquid glass surface ---- */
        .polutek-glass { position:relative; isolation:isolate; }
        .polutek-glass--bar { border-radius:22px; overflow:hidden; box-shadow:0 10px 34px rgba(0,0,0,.42); }
        .polutek-glass-effect { position:absolute; inset:0; z-index:0; border-radius:inherit; background:rgba(15,23,42,.48); -webkit-backdrop-filter:blur(18px) saturate(180%); backdrop-filter:blur(18px) saturate(180%); }
        @supports (backdrop-filter: blur(1px)) {
          .polutek-glass-effect { background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.04) 60%,rgba(255,255,255,.09)); }
        }
        .polutek-glass-noise { position:absolute; inset:0; z-index:1; border-radius:inherit; opacity:.5; mix-blend-mode:overlay; pointer-events:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
        .polutek-glass-edge { position:absolute; inset:0; z-index:2; border-radius:inherit; pointer-events:none; border:1px solid transparent; box-shadow:inset 1px 1px 0 0 rgba(255,255,255,.5),inset -1px -1px 0 1px rgba(255,255,255,.14),inset 0 0 0 1px rgba(255,255,255,.06); }
        .polutek-glass-content { position:relative; z-index:3; padding:8px 12px 10px; }

        .polutek-player-row { display:flex; min-height:44px; align-items:center; justify-content:space-between; gap:10px; }
        .polutek-player-row-group { display:flex; min-width:0; align-items:center; gap:2px; }
        .polutek-player-row-group--right { justify-content:flex-end; }
        .polutek-player-btn { position:relative; display:grid; width:40px; height:40px; place-items:center; border:0; border-radius:12px; color:#fff; background:transparent; transition:background-color .16s ease,transform .16s ease,box-shadow .16s ease; }
        .polutek-player-btn:hover { background:rgba(255,255,255,.16); box-shadow:inset 1px 1px 0 0 rgba(255,255,255,.4),inset -1px -1px 0 0 rgba(255,255,255,.1); transform:scale(1.06); }
        .polutek-player-btn:active { transform:scale(.92); background:rgba(255,255,255,.24); }
        .polutek-player-btn:focus-visible { outline:2px solid #fff; outline-offset:2px; box-shadow:0 0 0 4px rgba(37,99,235,.7); }
        .polutek-player-icon { width:20px; height:20px; stroke-width:2; filter:drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
        .polutek-player-icon--play { transform:translateX(1px); }
        .polutek-player-time { display:flex; align-items:center; gap:5px; margin-left:6px; color:#fff; font-size:12px; font-weight:650; letter-spacing:.01em; white-space:nowrap; font-variant-numeric:tabular-nums; text-shadow:0 1px 3px rgba(0,0,0,.7); }
        .polutek-player-time-duration,.polutek-player-time span { color:rgba(255,255,255,.68); }

        /* ---- Progress scrubber ---- */
        .polutek-player-scrub { position:relative; display:flex; width:100%; height:26px; align-items:center; cursor:pointer; touch-action:none; }
        .polutek-player-scrub-track,.polutek-player-volume-track { position:relative; width:100%; height:6px; overflow:hidden; border-radius:9999px; background:rgba(255,255,255,.22); box-shadow:inset 0 1px 2px rgba(0,0,0,.35); transition:height .16s ease; }
        .polutek-player-scrub:hover .polutek-player-scrub-track,.polutek-player-scrub:focus-visible .polutek-player-scrub-track { height:8px; }
        .polutek-player-scrub-buffer { position:absolute; inset:0 auto 0 0; width:var(--slider-progress); background:rgba(255,255,255,.34); }
        .polutek-player-scrub-fill,.polutek-player-volume-fill { position:absolute; inset:0 auto 0 0; width:var(--slider-fill); border-radius:inherit; background:linear-gradient(90deg,rgba(255,255,255,.85),#fff); box-shadow:0 0 8px rgba(255,255,255,.55); }
        .polutek-player-scrub-thumb,.polutek-player-volume-thumb { position:absolute; left:var(--slider-fill); width:15px; height:15px; border:1px solid rgba(255,255,255,.85); border-radius:999px; background:radial-gradient(circle at 32% 28%,#fff,rgba(255,255,255,.72)); box-shadow:0 2px 8px rgba(0,0,0,.4),inset 0 1px 1px rgba(255,255,255,.9); opacity:0; transform:translateX(-50%) scale(.7); transition:opacity .16s ease,transform .16s ease; }
        .polutek-player-scrub:hover .polutek-player-scrub-thumb,.polutek-player-scrub:focus-within .polutek-player-scrub-thumb,.polutek-player-scrub[data-dragging] .polutek-player-scrub-thumb { opacity:1; transform:translateX(-50%) scale(1); }
        .polutek-player-scrub-preview { position:absolute; bottom:30px; padding:6px 9px; border:1px solid rgba(255,255,255,.22); border-radius:10px; background:rgba(15,23,42,.8); color:#fff; box-shadow:0 8px 24px rgba(0,0,0,.34); font-size:11px; font-weight:700; font-variant-numeric:tabular-nums; -webkit-backdrop-filter:blur(14px) saturate(160%); backdrop-filter:blur(14px) saturate(160%); }
        @supports (backdrop-filter: blur(1px)) {
          .polutek-player-scrub-preview { background:rgba(15,23,42,.6); }
        }

        /* ---- Volume capsule ---- */
        .polutek-player-volume { display:flex; align-items:center; }
        .polutek-player-volume-slider { position:relative; display:flex; width:0; height:28px; align-items:center; overflow:hidden; opacity:0; transition:width .2s ease,opacity .2s ease,margin .2s ease; }
        .polutek-player-volume:hover .polutek-player-volume-slider,.polutek-player-volume:focus-within .polutek-player-volume-slider { width:78px; margin-right:6px; opacity:1; }
        .polutek-player-volume-track { height:5px; }
        .polutek-player-volume-thumb { width:12px; height:12px; opacity:1; transform:translateX(-50%); }

        /* ---- Center hero / spinner ---- */
        .polutek-player-center { position:absolute; inset:0; z-index:12; display:grid; place-items:center; pointer-events:none; }
        .polutek-player-center--ended { background:linear-gradient(rgba(3,7,18,.34),rgba(3,7,18,.58)); }
        .polutek-player-hero { position:relative; display:grid; width:70px; height:70px; place-items:center; border:1px solid rgba(255,255,255,.5); border-radius:999px; background:rgba(37,99,235,.7); color:#fff; -webkit-backdrop-filter:blur(16px) saturate(180%); backdrop-filter:blur(16px) saturate(180%); box-shadow:0 16px 44px rgba(0,0,0,.4),inset 1px 1px 0 rgba(255,255,255,.6),inset -1px -1px 0 rgba(255,255,255,.14); pointer-events:auto; transition:transform .18s ease,box-shadow .18s ease,background .18s ease; }
        @supports (backdrop-filter: blur(1px)) {
          .polutek-player-hero { background:linear-gradient(160deg,rgba(255,255,255,.28),rgba(255,255,255,.08)); }
        }
        .polutek-player-hero:hover { background:linear-gradient(160deg,rgba(255,255,255,.38),rgba(255,255,255,.12)); transform:scale(1.06); box-shadow:0 20px 50px rgba(0,0,0,.45),inset 1px 1px 0 rgba(255,255,255,.7),inset -1px -1px 0 rgba(255,255,255,.18); }
        .polutek-player-hero:active { transform:scale(.95); }
        .polutek-player-hero:focus-visible { outline:3px solid #fff; outline-offset:4px; box-shadow:0 0 0 7px rgba(37,99,235,.7); }
        .polutek-player-hero--replay { display:flex; width:auto; height:54px; padding:0 20px 0 11px; gap:11px; border-radius:16px; }
        .polutek-player-hero-icon-wrap { display:grid; width:34px; height:34px; place-items:center; border-radius:11px; background:rgba(255,255,255,.2); color:#fff; box-shadow:inset 1px 1px 0 rgba(255,255,255,.5); }
        .polutek-player-hero-icon { width:30px; height:30px; stroke-width:2.2; filter:drop-shadow(0 1px 3px rgba(0,0,0,.5)); }
        .polutek-player-hero-icon-wrap .polutek-player-hero-icon { width:19px; height:19px; }
        .polutek-player-hero-icon--play { transform:translateX(2px); }
        .polutek-player-replay-label { font-size:14px; font-weight:750; letter-spacing:-.01em; text-shadow:0 1px 3px rgba(0,0,0,.5); }
        .polutek-player-spinner { display:grid; width:56px; height:56px; place-items:center; border:1px solid rgba(255,255,255,.32); border-radius:999px; background:rgba(15,23,42,.6); color:#fff; box-shadow:0 16px 40px rgba(0,0,0,.34),inset 1px 1px 0 rgba(255,255,255,.4); -webkit-backdrop-filter:blur(14px) saturate(160%); backdrop-filter:blur(14px) saturate(160%); }
        @supports (backdrop-filter: blur(1px)) {
          .polutek-player-spinner { background:linear-gradient(160deg,rgba(255,255,255,.2),rgba(255,255,255,.05)); }
        }
        .polutek-player-spinner svg { width:26px; height:26px; animation:polutek-spin .8s linear infinite; }

        /* ---- Glass settings flyout ---- */
        .polutek-player-menu-root { position:relative; }
        .polutek-player-menu { position:absolute; right:0; bottom:52px; width:222px; max-height:min(360px,65vh); overflow:auto; padding:8px; border:1px solid rgba(255,255,255,.16); border-radius:16px; background:rgba(14,16,22,.85); color:#fff; box-shadow:0 18px 48px rgba(0,0,0,.5),inset 1px 1px 0 rgba(255,255,255,.24); -webkit-backdrop-filter:blur(22px) saturate(180%); backdrop-filter:blur(22px) saturate(180%); }
        @supports (backdrop-filter: blur(1px)) {
          .polutek-player-menu { background:linear-gradient(160deg,rgba(24,26,32,.72),rgba(14,16,22,.68)); }
        }
        .polutek-player-menu-section + .polutek-player-menu-section { margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.12); }
        .polutek-player-menu-heading { padding:6px 10px 5px; color:rgba(255,255,255,.55); font-size:10px; font-weight:750; letter-spacing:.1em; text-transform:uppercase; }
        .polutek-player-menu-item { display:flex; width:100%; min-height:42px; align-items:center; justify-content:space-between; padding:8px 11px; border-radius:11px; color:#fff; font-size:13px; font-weight:650; text-align:left; transition:background-color .14s ease,color .14s ease; }
        .polutek-player-menu-item:hover,.polutek-player-menu-item:focus-visible { background:rgba(255,255,255,.14); outline:none; }
        .polutek-player-menu-item:focus-visible { box-shadow:inset 0 0 0 2px rgba(255,255,255,.4); }
        .polutek-player-menu-item[aria-checked="true"] { color:#fff; }
        .polutek-player-menu-check { width:17px; height:17px; color:#fff; stroke-width:2.6; }

        .polutek-vidstack-player .vds-captions { bottom:96px; font-family:var(--font-space-grotesk,sans-serif); }
        @keyframes polutek-spin { to { transform:rotate(360deg); } }

        @media (max-width:640px) {
          .polutek-player-bottom { padding:0 8px max(8px,env(safe-area-inset-bottom)); }
          .polutek-glass--bar { border-radius:18px; }
          .polutek-glass-content { padding:6px 8px 8px; }
          .polutek-player-row { min-height:44px; gap:4px; }
          .polutek-player-btn { width:44px; height:44px; border-radius:13px; }
          .polutek-player-icon { width:20px; height:20px; }
          .polutek-player-row-group { gap:0; }
          .polutek-player-time { margin-left:2px; font-size:11px; }
          .polutek-player-time-duration,.polutek-player-time span { display:none; }
          .polutek-player-volume { display:none; }
          .polutek-player-scrub { height:28px; }
          .polutek-player-scrub-track { height:6px; }
          .polutek-player-scrub-thumb { width:16px; height:16px; opacity:1; transform:translateX(-50%) scale(1); }
          .polutek-player-hero { width:62px; height:62px; }
          .polutek-player-hero--replay { width:auto; height:52px; padding:0 18px 0 10px; }
          .polutek-player-menu { right:-40px; bottom:54px; width:min(214px,calc(100vw - 20px)); }
          .polutek-vidstack-player .vds-captions { bottom:92px; }
        }
        @media (max-width:360px) { .polutek-player-caption { display:none; } }
        @media (hover:none) { .polutek-player-scrub-preview { display:none; } }
        @media (prefers-reduced-motion:reduce) {
          .polutek-player-controls,.polutek-player-btn,.polutek-player-hero,.polutek-player-volume-slider,.polutek-player-scrub-track,.polutek-player-scrub-thumb { transition:none; }
          .polutek-player-spinner svg { animation-duration:1.4s; }
        }
      `}</style>
    </>
  );
}
