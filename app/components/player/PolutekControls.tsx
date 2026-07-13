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
    <div className="polutek-player-center" aria-hidden={!paused && !waiting}>
      {waiting ? (
        <div className="polutek-player-spinner" role="status" aria-label="Buforowanie" />
      ) : paused ? (
        <PlayButton className="polutek-player-hero" aria-label={ended ? 'Odtwórz ponownie' : 'Odtwórz'}>
          <span className="polutek-player-hero-glow" />
          {ended ? <ReplayIcon className="polutek-player-hero-icon" /> : <PlayIcon className="polutek-player-hero-icon polutek-player-hero-icon--play" />}
        </PlayButton>
      ) : null}
    </div>
  );
}

function PlayPauseButton() {
  const paused = useMediaState('paused');
  return <PlayButton className="polutek-player-btn" aria-label={paused ? 'Odtwórz' : 'Pauza'}>{paused ? <PlayIcon className="polutek-player-icon" /> : <PauseIcon className="polutek-player-icon" />}</PlayButton>;
}

function VolumeControl() {
  const muted = useMediaState('muted');
  const volume = useMediaState('volume');
  const canSetVolume = useMediaState('canSetVolume');
  const isMuted = muted || volume === 0;

  return (
    <div className="polutek-player-volume">
      <MuteButton className="polutek-player-btn" aria-label={isMuted ? 'Włącz dźwięk' : 'Wycisz'}>
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
  return <div className="polutek-player-menu-section"><div className="polutek-player-menu-heading">Prędkość</div>{options.map((option: PlaybackRateOption) => <button key={option.value} type="button" className="polutek-player-menu-item" onClick={() => { option.select(); onSelect(); }}><span>{option.label}</span>{option.selected && <CheckIcon className="polutek-player-menu-check" />}</button>)}</div>;
}

function CaptionsMenuSection({ onSelect }: { onSelect: () => void }) {
  const options = useCaptionOptions({ off: 'Wyłączone' });
  if (!options.length) return null;
  return <div className="polutek-player-menu-section"><div className="polutek-player-menu-heading">Napisy</div>{options.map((option: CaptionOption) => <button key={option.value} type="button" className="polutek-player-menu-item" onClick={() => { option.select(); onSelect(); }}><span>{option.label}</span>{option.selected && <CheckIcon className="polutek-player-menu-check" />}</button>)}</div>;
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
  return <div className="polutek-player-menu-root" ref={rootRef}><button type="button" className="polutek-player-btn" aria-label="Ustawienia" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(v => !v)}><SettingsIcon className="polutek-player-icon" /></button>{open && <div className="polutek-player-menu" role="menu"><SpeedMenuSection onSelect={() => setOpen(false)} /><CaptionsMenuSection onSelect={() => setOpen(false)} /></div>}</div>;
}

function CaptionToggle() {
  const hasCaptions = useMediaState('hasCaptions');
  const track = useMediaState('textTrack');
  const isOn = Boolean(track && isTrackCaptionKind(track));
  if (!hasCaptions) return null;
  return <CaptionButton className="polutek-player-btn" aria-label={isOn ? 'Wyłącz napisy' : 'Włącz napisy'}>{isOn ? <CaptionsOnIcon className="polutek-player-icon" /> : <CaptionsOffIcon className="polutek-player-icon" />}</CaptionButton>;
}

function PipToggleButton() {
  const canPip = useMediaState('canPictureInPicture');
  const isPip = useMediaState('pictureInPicture');
  if (!canPip) return null;
  return <PIPButton className="polutek-player-btn" aria-label={isPip ? 'Wyłącz obraz w obrazie' : 'Obraz w obrazie'}>{isPip ? <PipExitIcon className="polutek-player-icon" /> : <PipEnterIcon className="polutek-player-icon" />}</PIPButton>;
}

function FullscreenToggleButton() {
  const canFullscreen = useMediaState('canFullscreen');
  const isFullscreen = useMediaState('fullscreen');
  if (!canFullscreen) return null;
  return <FullscreenButton className="polutek-player-btn" aria-label={isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}>{isFullscreen ? <FullscreenExitIcon className="polutek-player-icon" /> : <FullscreenEnterIcon className="polutek-player-icon" />}</FullscreenButton>;
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
              <SeekButton seconds={-10} className="polutek-player-btn" aria-label="Cofnij 10 sekund"><SeekBackIcon className="polutek-player-icon" /></SeekButton>
              <SeekButton seconds={10} className="polutek-player-btn" aria-label="Przewiń 10 sekund"><SeekForwardIcon className="polutek-player-icon" /></SeekButton>
              <VolumeControl />
              <div className="polutek-player-time"><Time type="current" /><span>/</span><Time type="duration" className="polutek-player-time-duration" /></div>
            </div>
            <div className="polutek-player-row-group polutek-player-row-group--right"><CaptionToggle /><SettingsMenu /><PipToggleButton /><FullscreenToggleButton /></div>
          </div>
        </Controls.Group>
      </Controls.Root>
      <style jsx global>{`
        .polutek-player-gesture { position:absolute; inset:0; z-index:1; }
        .polutek-player-controls { position:absolute; inset:0; z-index:20; pointer-events:none; opacity:0; transition:opacity .18s ease; font-family:var(--font-space-grotesk, sans-serif); }
        .polutek-player-controls--visible { opacity:1; }
        .polutek-player-scrim { position:absolute; inset:0; background:linear-gradient(to bottom,transparent 42%,rgba(0,0,0,.12) 60%,rgba(0,0,0,.88) 100%); }
        .polutek-player-bottom { position:absolute; left:0; right:0; bottom:0; padding:0 16px 14px; pointer-events:auto; }
        .polutek-player-row { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:44px; }
        .polutek-player-row-group { display:flex; align-items:center; gap:4px; min-width:0; }
        .polutek-player-btn { display:grid; place-items:center; width:40px; height:40px; border:1px solid transparent; border-radius:12px; color:#fff; background:transparent; transition:background .15s ease,border-color .15s ease,transform .15s ease; }
        .polutek-player-btn:hover { background:rgba(248,243,231,.14); border-color:rgba(248,243,231,.18); }
        .polutek-player-btn:active { transform:scale(.94); }
        .polutek-player-btn:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
        .polutek-player-icon { width:22px; height:22px; filter:drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
        .polutek-player-time { display:flex; align-items:center; gap:6px; margin-left:4px; color:#fff; font-size:12px; font-weight:700; letter-spacing:.02em; white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,.7); }
        .polutek-player-time-duration { color:rgba(255,255,255,.68); }
        .polutek-player-scrub { position:relative; display:flex; align-items:center; width:100%; height:24px; cursor:pointer; }
        .polutek-player-scrub-track,.polutek-player-volume-track { position:relative; width:100%; height:4px; border-radius:999px; background:rgba(248,243,231,.28); overflow:hidden; }
        .polutek-player-scrub-buffer { position:absolute; inset:0 auto 0 0; width:var(--slider-progress); background:rgba(248,243,231,.35); }
        .polutek-player-scrub-fill,.polutek-player-volume-fill { position:absolute; inset:0 auto 0 0; width:var(--slider-fill); background:#2563eb; border-radius:inherit; }
        .polutek-player-scrub-thumb,.polutek-player-volume-thumb { position:absolute; left:var(--slider-fill); width:14px; height:14px; border-radius:50%; background:#f8f3e7; border:3px solid #2563eb; box-shadow:0 2px 8px rgba(0,0,0,.35); transform:translateX(-50%); }
        .polutek-player-scrub-preview { position:absolute; bottom:28px; padding:5px 8px; border:1px solid rgba(248,243,231,.22); border-radius:8px; background:#171717; color:#f8f3e7; font-size:11px; font-weight:700; }
        .polutek-player-volume { display:flex; align-items:center; }
        .polutek-player-volume-slider { position:relative; display:flex; align-items:center; width:0; height:28px; opacity:0; overflow:hidden; transition:width .2s ease,opacity .2s ease; }
        .polutek-player-volume:hover .polutek-player-volume-slider,.polutek-player-volume:focus-within .polutek-player-volume-slider { width:78px; opacity:1; margin-right:6px; }
        .polutek-player-volume-track { height:3px; }
        .polutek-player-volume-thumb { width:11px; height:11px; border-width:2px; }
        .polutek-player-center { position:absolute; inset:0; z-index:12; display:grid; place-items:center; pointer-events:none; }
        .polutek-player-hero { position:relative; display:grid; place-items:center; width:84px; height:84px; border:2px solid rgba(23,23,23,.9); border-radius:24px; background:#f8f3e7; color:#171717; box-shadow:7px 7px 0 rgba(37,99,235,.95),0 18px 55px rgba(0,0,0,.3); pointer-events:auto; transition:transform .18s ease,box-shadow .18s ease; }
        .polutek-player-hero:hover { transform:translate(-2px,-2px); box-shadow:10px 10px 0 #2563eb,0 22px 60px rgba(0,0,0,.38); }
        .polutek-player-hero-icon { position:relative; z-index:1; width:36px; height:36px; }
        .polutek-player-hero-icon--play { transform:translateX(2px); }
        .polutek-player-hero-glow { position:absolute; inset:-14px; border-radius:30px; border:1px solid rgba(248,243,231,.3); }
        .polutek-player-spinner { width:48px; height:48px; border:4px solid rgba(248,243,231,.28); border-top-color:#2563eb; border-radius:50%; animation:polutek-spin .8s linear infinite; }
        .polutek-player-menu-root { position:relative; }
        .polutek-player-menu { position:absolute; right:0; bottom:48px; width:220px; max-height:min(360px,65vh); overflow:auto; padding:8px; border:1px solid rgba(23,23,23,.18); border-radius:14px; background:#f8f3e7; color:#171717; box-shadow:8px 8px 0 rgba(37,99,235,.85),0 18px 45px rgba(0,0,0,.35); }
        .polutek-player-menu-section + .polutek-player-menu-section { margin-top:8px; padding-top:8px; border-top:1px solid #d8d0bd; }
        .polutek-player-menu-heading { padding:6px 10px; color:#6b665d; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .polutek-player-menu-item { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:38px; padding:8px 10px; border-radius:9px; font-size:13px; font-weight:700; text-align:left; }
        .polutek-player-menu-item:hover { background:#eff3fe; color:#1d4ed8; }
        .polutek-player-menu-check { width:17px; height:17px; color:#2563eb; }
        .polutek-vidstack-player .vds-captions { bottom:78px; font-family:var(--font-space-grotesk, sans-serif); }
        @keyframes polutek-spin { to { transform:rotate(360deg); } }
        @media (max-width:640px) {
          .polutek-player-bottom { padding:0 8px 8px; }
          .polutek-player-btn { width:36px; height:36px; border-radius:10px; }
          .polutek-player-icon { width:20px; height:20px; }
          .polutek-player-row-group { gap:0; }
          .polutek-player-time { font-size:11px; margin-left:2px; }
          .polutek-player-volume-slider { display:none; }
          .polutek-player-row-group--right > :nth-child(3) { display:none; }
          .polutek-player-hero { width:68px; height:68px; border-radius:20px; box-shadow:5px 5px 0 #2563eb,0 14px 40px rgba(0,0,0,.32); }
          .polutek-player-hero-icon { width:30px; height:30px; }
          .polutek-player-menu { right:-36px; width:200px; }
        }
      `}</style>
    </>
  );
}
