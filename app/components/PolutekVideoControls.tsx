"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CaptionButton,
  Controls,
  FullscreenButton,
  MuteButton,
  VolumeSlider,
  isTrackCaptionKind,
  useMediaRemote,
  useMediaState,
} from "@vidstack/react";
import { cn } from "@/lib/utils";
import { Frame, NajsIcon, PAPER } from "./najs/primitives";

const playerIconClass = "relative z-10 h-[1.2rem] w-[1.2rem] sm:h-[1.35rem] sm:w-[1.35rem]";
const centerPlayIconClass = "relative z-10 h-12 w-12 translate-x-0.5 text-[#f8f3e7] drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)] sm:h-14 sm:w-14";
const sliderAccentClass = "bg-[#1F7A88]";
const roughTrackClass = "relative h-[3px] w-full overflow-visible rounded-full bg-[#f8f3e7]/22 transition-[height] group-data-[dragging]/slider:h-1";
const roughThumbClass = "pointer-events-auto absolute left-[var(--slider-fill)] top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-3 rounded-[0.42rem] border border-[#171717]/35 bg-[#f8f3e7] shadow-[1.5px_2px_0_rgba(23,23,23,0.42),0_0_0_2px_rgba(248,243,231,0.16)] transition-transform group-data-[dragging]/slider:scale-110 sm:h-[11px] sm:w-[11px]";

function PlayerControlFrame({ active = false, seed = 1 }: { active?: boolean; seed?: number }) {
  return (
    <Frame
      radius={13}
      seed={seed}
      stroke={active ? PAPER : "rgba(248,243,231,0.78)"}
      strokeWidth={active ? 1.25 : 0.95}
      fill={active ? "rgba(37,99,235,0.78)" : "rgba(248,243,231,0.10)"}
      showShadow
    />
  );
}

function NajsTrackLine({ className = "" }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none absolute inset-x-[-1px] top-1/2 h-3 -translate-y-1/2 text-[#f8f3e7]/75", className)}
      viewBox="0 0 300 12"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M 2 6 Q 74 4.9 150 6.2 T 298 5.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 2 7.3 Q 75 6.4 151 7.1 T 298 6.7" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.28" />
    </svg>
  );
}

function PlayerTrackFill({ width }: { width?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full shadow-[0_0_0_1px_rgba(248,243,231,0.25)]", sliderAccentClass)}
      style={width ? { width } : undefined}
    />
  );
}

function getPlayerEvent(event: React.SyntheticEvent | PointerEvent | KeyboardEvent) {
  return "nativeEvent" in event ? event.nativeEvent : event;
}

function useTogglePlayback() {
  const remote = useMediaRemote();
  const paused = useMediaState("paused");
  const ended = useMediaState("ended");
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");

  return useCallback((event: React.SyntheticEvent | PointerEvent | KeyboardEvent) => {
    const playerEvent = getPlayerEvent(event);

    if (paused) {
      const shouldResumeFromSeekedEndedState = ended
        && Number.isFinite(currentTime)
        && Number.isFinite(duration)
        && duration > 0
        && currentTime < duration - 0.25;

      if (shouldResumeFromSeekedEndedState) {
        remote.seek(currentTime, playerEvent);
        requestAnimationFrame(() => remote.play(playerEvent));
        return;
      }

      remote.play(playerEvent);
      return;
    }

    remote.pause(playerEvent);
  }, [currentTime, duration, ended, paused, remote]);
}

function PlayerPlayButton({ className }: { className: string }) {
  const paused = useMediaState("paused");
  const togglePlayback = useTogglePlayback();

  return (
    <button
      type="button"
      className={className}
      aria-label={paused ? "Odtwórz" : "Pauza"}
      onClick={(event) => {
        event.stopPropagation();
        togglePlayback(event);
      }}
    >
      <PlayerControlFrame seed={paused ? 11 : 12} />
      <NajsIcon name={paused ? "play" : "pause"} className={playerIconClass} />
    </button>
  );
}

export function PlayerTapTarget() {
  const paused = useMediaState("paused");
  const togglePlayback = useTogglePlayback();

  return (
    <button
      type="button"
      className={cn(
        "absolute inset-0 z-10 grid place-items-center text-white transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/85",
        paused ? "opacity-100" : "opacity-0",
      )}
      aria-label={paused ? "Odtwórz film" : "Pauza"}
      onClick={(event) => {
        event.stopPropagation();
        togglePlayback(event);
      }}
    >
      {paused ? (
        <span className="relative isolate grid h-[4.75rem] w-[4.75rem] rotate-[-2deg] place-items-center rounded-[1.45rem] bg-black/28 sm:h-24 sm:w-24">
          <Frame radius={22} seed={31} stroke="rgba(248,243,231,0.88)" strokeWidth={1.45} fill="rgba(37,99,235,0.46)" showShadow />
          <NajsIcon name="play" className={centerPlayIconClass} />
        </span>
      ) : null}
    </button>
  );
}

function PlayerMuteIcon() {
  const muted = useMediaState("muted");
  const volume = useMediaState("volume");

  return <NajsIcon name={muted || volume === 0 ? "volume-off" : "volume"} className={playerIconClass} />;
}

function PlayerCaptionButton({ className, disabled = false }: { className: string; disabled?: boolean }) {
  const textTrack = useMediaState("textTrack");
  const captionsOn = Boolean(textTrack && isTrackCaptionKind(textTrack));

  return (
    <CaptionButton
      className={cn(className, captionsOn && "text-white")}
      aria-label={captionsOn ? "Wyłącz napisy" : "Włącz napisy"}
      aria-pressed={captionsOn}
      disabled={disabled}
      title={disabled ? "Brak napisów dla tego filmu" : undefined}
    >
      <PlayerControlFrame active={captionsOn} seed={21} />
      <NajsIcon name="subtitles" className={playerIconClass} />
    </CaptionButton>
  );
}

function formatPlayerTime(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value || value < 0) return "0:00";

  const totalSeconds = Math.floor(value);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function PlayerTimeReadout() {
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");

  return (
    <span className="inline-flex min-w-[4.8rem] shrink-0 rotate-[-0.5deg] items-center gap-1 whitespace-nowrap text-left font-[var(--font-najs)] text-[11px] font-bold leading-none tabular-nums text-[#f8f3e7]/92 sm:min-w-[7.4rem] sm:text-[14px]">
      <span>{formatPlayerTime(currentTime)}</span><span className="text-[#f8f3e7]/50">/</span><span className="text-[#f8f3e7]/72">{formatPlayerTime(duration)}</span>
    </span>
  );
}

export function PolutekVideoControls({ hasTextTracks }: { hasTextTracks: boolean }) {
  const buttonClass = "relative isolate grid h-8 w-8 shrink-0 place-items-center rounded-[0.9rem] text-[#f8f3e7]/92 transition-[color,transform,opacity] hover:-rotate-1 hover:scale-[1.03] hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f8f3e7]/85 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:w-10";

  return (
    <Controls.Root className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/78 via-black/38 to-transparent px-2 pb-2 pt-11 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[visible]:opacity-100 sm:px-3 sm:pb-3 sm:pt-12">
      <div className="relative isolate rounded-[1.1rem] bg-[#171717]/68 px-2.5 pb-2 pt-2.5 text-[#f8f3e7] shadow-[0_10px_28px_rgba(0,0,0,0.42)] backdrop-blur-[5px] sm:px-3 sm:pb-2.5 sm:pt-3">
        <Frame radius={18} seed={71} stroke="rgba(248,243,231,0.58)" strokeWidth={0.9} fill="rgba(23,23,23,0.25)" showShadow />
        <PlayerTimeScrubber trackClass={roughTrackClass} thumbClass={roughThumbClass} />

        <Controls.Group className="relative z-10 mt-0 flex min-h-9 min-w-0 items-center justify-between gap-1.5 sm:min-h-10 sm:gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
            <PlayerPlayButton className={buttonClass} />

            <div className="flex shrink-0 items-center gap-1">
              <MuteButton className={buttonClass} aria-label="Wycisz / włącz dźwięk">
                <PlayerControlFrame seed={13} />
                <PlayerMuteIcon />
              </MuteButton>
              <VolumeSlider.Root className="group/slider relative hidden h-9 w-20 shrink-0 cursor-pointer touch-none select-none items-center px-1 py-3 md:flex" aria-label="Głośność">
                <VolumeSlider.Track className={cn(roughTrackClass, "h-[2.5px] group-data-[dragging]/slider:h-[3px]") }>
                  <NajsTrackLine className="opacity-70" />
                  <VolumeSlider.TrackFill className={cn("pointer-events-none absolute left-0 top-1/2 h-[2.5px] -translate-y-1/2 rounded-full shadow-[0_0_0_1px_rgba(248,243,231,0.22)]", sliderAccentClass)} />
                </VolumeSlider.Track>
                <VolumeSlider.Thumb className="pointer-events-auto absolute left-[var(--slider-fill)] top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-3 rounded-[0.35rem] border border-[#171717]/35 bg-[#f8f3e7] shadow-[1px_1.5px_0_rgba(23,23,23,0.45),0_0_0_2px_rgba(248,243,231,0.12)] transition-transform group-data-[dragging]/slider:scale-110" />
              </VolumeSlider.Root>
            </div>

            <PlayerTimeReadout />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <PlayerCaptionButton className={buttonClass} disabled={!hasTextTracks} />
            <FullscreenButton className={buttonClass} aria-label="Pełny ekran">
              <PlayerControlFrame seed={22} />
              <NajsIcon name="fullscreen" className={playerIconClass} />
            </FullscreenButton>
          </div>
        </Controls.Group>
      </div>
    </Controls.Root>
  );
}

function PlayerTimeScrubber({ trackClass, thumbClass }: { trackClass: string; thumbClass: string }) {
  const remote = useMediaRemote();
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [optimisticSeekTime, setOptimisticSeekTime] = useState<number | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const displayTime = isDragging ? dragTime : optimisticSeekTime ?? currentTime;
  const safeTime = safeDuration ? Math.min(Math.max(displayTime || 0, 0), safeDuration) : 0;
  const fillPercent = safeDuration ? (safeTime / safeDuration) * 100 : 0;

  useEffect(() => {
    if (optimisticSeekTime === null || isDragging) return;

    const resolvedTime = Number.isFinite(currentTime) ? currentTime : 0;
    if (Math.abs(resolvedTime - optimisticSeekTime) < 0.35) {
      setOptimisticSeekTime(null);
    }
  }, [currentTime, optimisticSeekTime, isDragging]);

  const setDraggingState = useCallback((nextValue: boolean) => {
    isDraggingRef.current = nextValue;
    setIsDragging(nextValue);
  }, []);

  const getTimeFromPointer = useCallback((clientX: number) => {
    const rect = scrubberRef.current?.getBoundingClientRect();
    if (!rect || !safeDuration) return null;

    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return ratio * safeDuration;
  }, [safeDuration]);

  const seekToPointerTime = useCallback((nextTime: number, event: React.SyntheticEvent | PointerEvent | KeyboardEvent, keepDragging: boolean, playAfterSeek = false) => {
    if (!safeDuration || !Number.isFinite(nextTime)) {
      setDraggingState(false);
      return;
    }

    const playerEvent = getPlayerEvent(event);
    const clampedTime = Math.min(Math.max(nextTime, 0), safeDuration);
    setDragTime(clampedTime);
    setOptimisticSeekTime(clampedTime);
    setDraggingState(keepDragging);
    remote.seek(clampedTime, playerEvent);

    if (playAfterSeek) {
      requestAnimationFrame(() => remote.play(playerEvent));
    }
  }, [remote, safeDuration, setDraggingState]);

  return (
    <div
      ref={scrubberRef}
      className="najs-player-progress group/slider relative z-40 mt-2 flex h-10 w-full cursor-pointer touch-none select-none items-center py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f8f3e7]/85 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60"
      style={{ "--slider-fill": `${fillPercent}%` } as React.CSSProperties}
      data-dragging={isDragging ? "" : undefined}
      data-disabled={!safeDuration}
      role="slider"
      tabIndex={safeDuration ? 0 : -1}
      aria-label="Postęp filmu"
      aria-valuemin={0}
      aria-valuemax={safeDuration || 0}
      aria-valuenow={safeTime}
      aria-valuetext={`${formatPlayerTime(safeTime)} / ${formatPlayerTime(safeDuration)}`}
      aria-disabled={!safeDuration}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextTime = getTimeFromPointer(event.clientX);
        if (nextTime === null) return;

        event.currentTarget.setPointerCapture?.(event.pointerId);
        seekToPointerTime(nextTime, event, true);
      }}
      onPointerMove={(event) => {
        if (!isDraggingRef.current) return;

        event.preventDefault();
        event.stopPropagation();
        const nextTime = getTimeFromPointer(event.clientX);
        if (nextTime === null) return;
        seekToPointerTime(nextTime, event, true);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (!isDraggingRef.current) return;

        const nextTime = getTimeFromPointer(event.clientX) ?? dragTime;
        seekToPointerTime(nextTime, event, false, true);
      }}
      onPointerCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (!isDraggingRef.current) return;
        seekToPointerTime(dragTime, event, false);
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (!safeDuration) return;

        const step = event.shiftKey ? 10 : 5;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          seekToPointerTime(safeTime - step, event, false);
        }
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          seekToPointerTime(safeTime + step, event, false);
        }
        if (event.key === "Home") {
          event.preventDefault();
          seekToPointerTime(0, event, false);
        }
        if (event.key === "End") {
          event.preventDefault();
          seekToPointerTime(safeDuration, event, false);
        }
      }}
    >
      <div className={trackClass}>
        <NajsTrackLine />
        <PlayerTrackFill width={`${fillPercent}%`} />
      </div>
      <div className={thumbClass} />
    </div>
  );
}
