"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Captions,
  CaptionButton,
  Controls,
  FullscreenButton,
  Gesture,
  MuteButton,
  PIPButton,
  PlayButton,
  SeekButton,
  Time,
  TimeSlider,
  VolumeSlider,
  isTrackCaptionKind,
  useCaptionOptions,
  useMediaState,
  usePlaybackRateOptions,
  type CaptionOption,
  type PlaybackRateOption,
} from '@vidstack/react';
import { cn } from '@/lib/utils';
import {
  CaptionsOffIcon,
  CaptionsOnIcon,
  CheckIcon,
  FullscreenEnterIcon,
  FullscreenExitIcon,
  PauseIcon,
  PipEnterIcon,
  PipExitIcon,
  PlayIcon,
  ReplayIcon,
  SeekBackIcon,
  SeekForwardIcon,
  SettingsIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from './icons';

function CenterStage() {
  const paused = useMediaState('paused');
  const waiting = useMediaState('waiting');
  const ended = useMediaState('ended');

  return (
    <div className={cn('polutek-player-center', ended && 'polutek-player-center--ended')} aria-hidden={!paused && !waiting}>
      {waiting ? (
        <div className="polutek-player-spinner" role="status" aria-label="Buforowanie" />
      ) : paused ? (
        <div className="polutek-player-hero-wrap">
          <PlayButton className="polutek-player-hero" aria-label={ended ? 'Odtwórz ponownie' : 'Odtwórz'}>
            {ended ? <ReplayIcon className="polutek-player-hero-icon" /> : <PlayIcon className="polutek-player-hero-icon polutek-player-hero-icon--play" />}
          </PlayButton>
          {ended && <span className="polutek-player-replay-label">Jeszcze raz?</span>}
        </div>
      ) : null}
    </div>
  );
}

function PlayPauseButton() {
  const paused = useMediaState('paused');
  const label = paused ? 'Odtwórz' : 'Pauza';
  return <PlayButton className="polutek-player-btn" aria-label={label} title={label}>{paused ? <PlayIcon className="polutek-player-icon" /> : <PauseIcon className="polutek-player-icon" />}</PlayButton>;
}

function VolumeControl() {
  const muted = useMediaState('muted');
  const volume = useMediaState('volume');
  const canSetVolume = useMediaState('canSetVolume');
  const isMuted = muted || volume === 0;

  return (
    <div className="polutek-player-volume">
      <MuteButton className="polutek-player-btn" aria-label={isMuted ? 'Włącz dźwięk' : 'Wycisz'} title={isMuted ? 'Włącz dźwięk' : 'Wycisz'}>
        {isMuted ? <VolumeMuteIcon className="polutek-player-icon" /> : volume < 0.5 ? <VolumeLowIcon className="polutek-player-icon" /> : <VolumeHighIcon className="polutek-player-icon" />}
      </MuteButton>
      {canSetVolume && (
        <VolumeSlider.Root className="polutek-player-volume-slider" aria-label="Głośność">
          <VolumeSlider.Track className="polutek-player-volume-track"><VolumeSlider.TrackFill className="polutek-player-volume-fill" /></VolumeSlider.Track>
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
      <TimeSlider.Preview className="polutek-player-scrub-preview"><TimeSlider.Value className="polutek-player-scrub-preview-value" /></TimeSlider.Preview>
    </TimeSlider.Root>
  );
}

function SpeedMenuSection({ onSelect }: { onSelect: () => void }) {
  const options = usePlaybackRateOptions({ normalLabel: 'Normalna' });
  if (options.disabled) return null;
  return <div className="polutek-player-menu-section"><div className="polutek-player-menu-heading">Prędkość</div>{options.map((option: PlaybackRateOption) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.selected} className="polutek-player-menu-item" onClick={() => { option.select(); onSelect(); }}><span>{option.label}</span>{option.selected && <CheckIcon className="polutek-player-menu-check" />}</button>)}</div>;
}

function CaptionsMenuSection({ onSelect }: { onSelect: () => void }) {
  const options = useCaptionOptions({ off: 'Wyłączone' });
  if (!options.length) return null;
  return <div className="polutek-player-menu-section"><div className="polutek-player-menu-heading">Napisy</div>{options.map((option: CaptionOption) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.selected} className="polutek-player-menu-item" onClick={() => { option.select(); onSelect(); }}><span>{option.label}</span>{option.selected && <CheckIcon className="polutek-player-menu-check" />}</button>)}</div>;
}

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);
  return <div className="polutek-player-menu-root" ref={rootRef}><button type="button" className="polutek-player-btn" aria-label="Ustawienia" title="Ustawienia" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(v => !v)}><SettingsIcon className="polutek-player-icon" /></button>{open && <div className="polutek-player-menu" role="menu" aria-label="Ustawienia odtwarzacza"><SpeedMenuSection onSelect={() => setOpen(false)} /><CaptionsMenuSection onSelect={() => setOpen(false)} /></div>}</div>;
}

function CaptionToggle() {
  const hasCaptions = useMediaState('hasCaptions');
  const track = useMediaState('textTrack');
  const isOn = Boolean(track && isTrackCaptionKind(track));
  if (!hasCaptions) return null;
  return <CaptionButton className="polutek-player-btn polutek-player-caption" aria-label={isOn ? 'Wyłącz napisy' : 'Włącz napisy'} title={isOn ? 'Wyłącz napisy' : 'Włącz napisy'}>{isOn ? <CaptionsOnIcon className="polutek-player-icon" /> : <CaptionsOffIcon className="polutek-player-icon" />}</CaptionButton>;
}

function PipToggleButton() {
  const canPip = useMediaState('canPictureInPicture');
  const isPip = useMediaState('pictureInPicture');
  if (!canPip) return null;
  return <PIPButton className="polutek-player-btn polutek-player-pip" aria-label={isPip ? 'Wyłącz obraz w obrazie' : 'Obraz w obrazie'} title={isPip ? 'Wyłącz obraz w obrazie' : 'Obraz w obrazie'}>{isPip ? <PipExitIcon className="polutek-player-icon" /> : <PipEnterIcon className="polutek-player-icon" />}</PIPButton>;
}

function FullscreenToggleButton() {
  const canFullscreen = useMediaState('canFullscreen');
  const isFullscreen = useMediaState('fullscreen');
  if (!canFullscreen) return null;
  return <FullscreenButton className="polutek-player-btn" aria-label={isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'} title={isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}>{isFullscreen ? <FullscreenExitIcon className="polutek-player-icon" /> : <FullscreenEnterIcon className="polutek-player-icon" />}</FullscreenButton>;
}

export default function PolutekControls({ className }: { className?: string }) {
  const controlsVisible = useMediaState('controlsVisible');
  return (
    <>
      <Gesture className="polutek-player-gesture" event="pointerup" action="toggle:paused" />
      <Gesture className="polutek-player-gesture" event="dblpointerup" action="toggle:fullscreen" />
      <Captions className="vds-captions" />
      <CenterStage />
      <Controls.Root className={cn('polutek-player-controls', controlsVisible && 'polutek-player-controls--visible', className)}>
        <div className="polutek-player-scrim" />
        <Controls.Group className="polutek-player-bottom">
          <ScrubBar />
          <div className="polutek-player-row">
            <div className="polutek-player-row-group">
              <PlayPauseButton />
              <SeekButton seconds={-10} className="polutek-player-btn polutek-player-seek" aria-label="Cofnij 10 sekund" title="Cofnij 10 sekund"><SeekBackIcon className="polutek-player-icon" /></SeekButton>
              <SeekButton seconds={10} className="polutek-player-btn polutek-player-seek" aria-label="Przewiń 10 sekund" title="Przewiń 10 sekund"><SeekForwardIcon className="polutek-player-icon" /></SeekButton>
              <VolumeControl />
              <div className="polutek-player-time"><Time type="current" /><span>/</span><Time type="duration" className="polutek-player-time-duration" /></div>
            </div>
            <div className="polutek-player-row-group polutek-player-row-group--right"><CaptionToggle /><SettingsMenu /><PipToggleButton /><FullscreenToggleButton /></div>
          </div>
        </Controls.Group>
      </Controls.Root>
      <style jsx global>{`
        .polutek-player-gesture { position:absolute; inset:0; z-index:1; }
        .polutek-player-controls { position:absolute; inset:0; z-index:20; pointer-events:none; visibility:hidden; opacity:0; transition:opacity .18s ease,visibility 0s linear .18s; font-family:var(--font-space-grotesk, sans-serif); }
        .polutek-player-controls--visible { visibility:visible; opacity:1; transition-delay:0s; }
        .polutek-player-scrim { position:absolute; inset:0; background:linear-gradient(to bottom,transparent 38%,rgba(0,0,0,.16) 60%,rgba(0,0,0,.9) 100%); }
        .polutek-player-bottom { position:absolute; left:0; right:0; bottom:0; padding:0 16px max(12px,env(safe-area-inset-bottom)); pointer-events:auto; }
        .polutek-player-row { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:48px; }
        .polutek-player-row-group { display:flex; align-items:center; gap:5px; min-width:0; }
        .polutek-player-btn { position:relative; isolation:isolate; display:grid; place-items:center; width:42px; height:42px; border:0; color:#fff; background:transparent; transition:color .15s ease,transform .15s ease; }
        .polutek-player-btn::before { content:""; position:absolute; z-index:-1; inset:4px; border:1.5px solid rgba(248,243,231,.55); border-radius:48% 52% 46% 54% / 54% 46% 55% 45%; background:rgba(10,10,10,.38); box-shadow:inset 0 0 0 1px rgba(0,0,0,.22),0 2px 10px rgba(0,0,0,.18); backdrop-filter:blur(5px); transition:background .15s ease,box-shadow .15s ease; }
        .polutek-player-btn:nth-child(even) { transform:rotate(.7deg); }
        .polutek-player-btn:nth-child(even)::before { border-radius:54% 46% 52% 48% / 47% 55% 45% 53%; }
        .polutek-player-btn:hover { color:#171717; transform:translateY(-1px) rotate(-.8deg); }
        .polutek-player-btn:hover::before { background:#fff8e8; box-shadow:2px 3px 0 #2563eb,0 5px 16px rgba(0,0,0,.3); }
        .polutek-player-btn:active { transform:translateY(1px) scale(.95); }
        .polutek-player-btn:active::before { box-shadow:none; }
        .polutek-player-btn:focus-visible { outline:3px solid #fff8e8; outline-offset:2px; box-shadow:0 0 0 5px #2563eb; }
        .polutek-player-icon { width:23px; height:23px; filter:drop-shadow(1px 1px 0 rgba(0,0,0,.45)); }
        .polutek-player-time { display:flex; align-items:center; gap:6px; margin-left:4px; padding:6px 9px; border:1px solid rgba(255,255,255,.16); border-radius:10px 8px 11px 7px; color:#fff; background:rgba(10,10,10,.28); font-size:12px; font-weight:750; letter-spacing:.02em; white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,.7); }
        .polutek-player-time-duration { color:rgba(255,255,255,.68); }
        .polutek-player-scrub { position:relative; display:flex; align-items:center; width:100%; height:28px; cursor:pointer; touch-action:none; }
        .polutek-player-scrub-track,.polutek-player-volume-track { position:relative; width:100%; height:4px; border-radius:52% 48% 45% 55% / 60% 42% 58% 40%; background:rgba(248,243,231,.32); overflow:hidden; box-shadow:0 1px 0 rgba(0,0,0,.45); }
        .polutek-player-scrub-buffer { position:absolute; inset:0 auto 0 0; width:var(--slider-progress); background:rgba(248,243,231,.35); }
        .polutek-player-scrub-fill,.polutek-player-volume-fill { position:absolute; inset:0 auto 0 0; width:var(--slider-fill); background:#2563eb; border-radius:inherit; }
        .polutek-player-scrub-thumb,.polutek-player-volume-thumb { position:absolute; left:var(--slider-fill); width:15px; height:15px; border-radius:47% 53% 45% 55%; background:#fff8e8; border:3px solid #2563eb; box-shadow:1px 2px 0 #171717,0 2px 8px rgba(0,0,0,.35); transform:translateX(-50%) rotate(8deg); }
        .polutek-player-scrub-preview { position:absolute; bottom:29px; padding:6px 9px; border:1.5px solid #fff8e8; border-radius:9px 7px 10px 6px; background:#171717; color:#fff8e8; box-shadow:2px 2px 0 #2563eb; font-size:11px; font-weight:800; }
        .polutek-player-volume { display:flex; align-items:center; }
        .polutek-player-volume-slider { position:relative; display:flex; align-items:center; width:0; height:28px; opacity:0; overflow:hidden; transition:width .2s ease,opacity .2s ease; }
        .polutek-player-volume:hover .polutek-player-volume-slider,.polutek-player-volume:focus-within .polutek-player-volume-slider { width:78px; opacity:1; margin-right:6px; }
        .polutek-player-volume-track { height:3px; }
        .polutek-player-volume-thumb { width:11px; height:11px; border-width:2px; }
        .polutek-player-center { position:absolute; inset:0; z-index:12; display:grid; place-items:center; pointer-events:none; }
        .polutek-player-center--ended { background:rgba(0,0,0,.3); }
        .polutek-player-hero-wrap { position:relative; display:grid; justify-items:center; gap:12px; pointer-events:none; }
        .polutek-player-hero-wrap::before,.polutek-player-hero-wrap::after { content:""; position:absolute; top:7px; width:19px; height:12px; border-top:3px solid #fff8e8; border-radius:50%; filter:drop-shadow(1px 2px 0 #2563eb); opacity:.92; }
        .polutek-player-hero-wrap::before { left:-31px; transform:rotate(-30deg); }
        .polutek-player-hero-wrap::after { right:-31px; transform:rotate(30deg) scaleX(-1); }
        .polutek-player-hero { position:relative; display:grid; place-items:center; width:68px; height:68px; border:2.5px solid #171717; border-radius:48% 52% 45% 55% / 54% 45% 55% 46%; background:#fff8e8; color:#171717; box-shadow:4px 5px 0 #2563eb,0 18px 44px rgba(0,0,0,.34); pointer-events:auto; transform:rotate(-1.5deg); transition:transform .18s ease,box-shadow .18s ease; }
        .polutek-player-hero::after { content:""; position:absolute; inset:4px; border:1px solid rgba(23,23,23,.3); border-radius:54% 46% 52% 48%; transform:rotate(4deg); }
        .polutek-player-hero:hover { transform:translate(-1px,-2px) rotate(1deg); box-shadow:6px 7px 0 #2563eb,0 22px 50px rgba(0,0,0,.4); }
        .polutek-player-hero:focus-visible { outline:3px solid #fff8e8; outline-offset:4px; box-shadow:0 0 0 7px #2563eb; }
        .polutek-player-hero-icon { position:relative; z-index:1; width:30px; height:30px; }
        .polutek-player-hero-icon--play { transform:translateX(2px); }
        .polutek-player-replay-label { padding:7px 12px; border:1.5px solid rgba(255,248,232,.8); border-radius:9px 7px 10px 6px; background:rgba(10,10,10,.72); color:#fff8e8; box-shadow:2px 3px 0 rgba(37,99,235,.9); font-size:13px; font-weight:800; letter-spacing:.02em; transform:rotate(.7deg); }
        .polutek-player-spinner { width:48px; height:48px; border:4px solid rgba(248,243,231,.28); border-top-color:#2563eb; border-radius:47% 53% 45% 55%; animation:polutek-spin .8s linear infinite; }
        .polutek-player-menu-root { position:relative; }
        .polutek-player-menu { position:absolute; right:0; bottom:50px; width:220px; max-height:min(360px,65vh); overflow:auto; padding:8px; border:2px solid #171717; border-radius:15px 11px 16px 10px; background:#fff8e8; color:#171717; box-shadow:5px 6px 0 rgba(37,99,235,.9),0 18px 45px rgba(0,0,0,.35); transform:rotate(-.25deg); }
        .polutek-player-menu-section + .polutek-player-menu-section { margin-top:8px; padding-top:8px; border-top:1px solid #d8d0bd; }
        .polutek-player-menu-heading { padding:6px 10px; color:#6b665d; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .polutek-player-menu-item { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:44px; padding:8px 10px; border-radius:9px 7px 10px 6px; font-size:13px; font-weight:700; text-align:left; }
        .polutek-player-menu-item:hover { background:#eff3fe; color:#1d4ed8; }
        .polutek-player-menu-check { width:17px; height:17px; color:#2563eb; }
        .polutek-vidstack-player .vds-captions { bottom:88px; font-family:var(--font-space-grotesk, sans-serif); }
        @keyframes polutek-spin { to { transform:rotate(360deg); } }
        @media (max-width:640px) {
          .polutek-player-bottom { padding:0 8px max(7px,env(safe-area-inset-bottom)); }
          .polutek-player-row { gap:6px; min-height:46px; }
          .polutek-player-btn { width:44px; height:44px; }
          .polutek-player-icon { width:21px; height:21px; }
          .polutek-player-row-group { gap:3px; }
          .polutek-player-time { margin-left:1px; padding:5px 7px; font-size:11px; }
          .polutek-player-time-duration { display:none; }
          .polutek-player-time span { display:none; }
          .polutek-player-volume,.polutek-player-seek,.polutek-player-pip { display:none; }
          .polutek-player-scrub { height:30px; }
          .polutek-player-scrub-track { height:5px; }
          .polutek-player-scrub-thumb { width:17px; height:17px; }
          .polutek-player-hero { width:56px; height:56px; box-shadow:4px 5px 0 #2563eb,0 14px 38px rgba(0,0,0,.34); }
          .polutek-player-hero-icon { width:25px; height:25px; }
          .polutek-player-menu { right:-44px; bottom:52px; width:min(210px,calc(100vw - 24px)); }
          .polutek-vidstack-player .vds-captions { bottom:80px; }
        }
        @media (max-width:380px) { .polutek-player-caption { display:none; } }
        @media (hover:none) { .polutek-player-scrub-preview { display:none; } }
        @media (prefers-reduced-motion:reduce) { .polutek-player-controls,.polutek-player-btn,.polutek-player-hero,.polutek-player-volume-slider { transition:none; } .polutek-player-spinner { animation-duration:1.4s; } }
      `}</style>
    </>
  );
}
