"use client";

import { FullscreenButton, MuteButton, PlayButton, Time, VolumeSlider, useMediaRemote, useMediaState } from "@vidstack/react";
import { Maximize, Minimize, PictureInPicture2, Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlayerCopy } from "../polutek-controls-copy";
import { PlayPauseGlyph } from "./PlayerIcons";

/**
 * Line icons of the control bar: one family (lucide), one optical size (20px box) and one true stroke width
 * (1.5 CSS px whatever the box, `absoluteStrokeWidth`). Play and pause stay filled glyphs (Vidstack's), the
 * convention every player uses for the primary action.
 */
/** Below this width the captions switch leaves the row for the settings menu (globals.css hides the button). */
export const CAPTIONS_IN_MENU_QUERY = "(max-width: 399px)";

export const LINE_ICON = { size: 20, strokeWidth: 1.5, absoluteStrokeWidth: true, className: "mc-icon", "aria-hidden": true } as const;

/** Play/pause: the one control with a surface of its own, a compact dark pill at the left of the row. */
export function PlayPauseButton() {
  const copy = usePlayerCopy();
  const paused = useMediaState("paused");
  const label = paused ? copy.play : copy.pause;

  return (
    <PlayButton className="mc-btn mc-play" aria-label={label} title={`${label} (k)`}>
      <PlayPauseGlyph paused={paused} className="mc-glyph" />
    </PlayButton>
  );
}

/**
 * Mute toggle plus, where the device has a pointer and lets a page set the volume, a slider that slides out on
 * hover or focus. Touch screens get only the toggle: the hardware buttons set the level there (iOS does not even
 * allow a page to), and the row needs the room for the progress track.
 */
export function VolumeControl() {
  const copy = usePlayerCopy();
  const muted = useMediaState("muted");
  const volume = useMediaState("volume");
  const canSetVolume = useMediaState("canSetVolume");
  const isMuted = muted || volume === 0;
  const label = isMuted ? copy.unmute : copy.mute;

  return (
    <div className="mc-volume">
      <MuteButton className="mc-btn" aria-label={label} title={`${label} (m)`}>
        {isMuted ? <VolumeX {...LINE_ICON} /> : volume < 0.5 ? <Volume1 {...LINE_ICON} /> : <Volume2 {...LINE_ICON} />}
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

/**
 * Picture-in-picture on the bar, only where the browser offers it. Narrow screens hide it (CSS) and keep the same
 * action in the settings menu, so the phone row stays: play, track, sound, captions, quality, fullscreen.
 */
export function PipToggleButton() {
  const copy = usePlayerCopy();
  const remote = useMediaRemote();
  const canPip = useMediaState("canPictureInPicture") as boolean | undefined;
  const inPip = useMediaState("pictureInPicture") as boolean | undefined;
  if (!canPip) return null;

  const label = inPip ? copy.exitPictureInPicture : copy.pictureInPicture;
  return (
    <button
      type="button"
      className="mc-btn mc-pip"
      aria-label={label}
      title={label}
      onClick={(event) => (inPip ? remote.exitPictureInPicture?.(event.nativeEvent) : remote.enterPictureInPicture?.(event.nativeEvent))}
    >
      <PictureInPicture2 {...LINE_ICON} />
    </button>
  );
}

export function FullscreenToggleButton() {
  const copy = usePlayerCopy();
  const canFullscreen = useMediaState("canFullscreen");
  const isFullscreen = useMediaState("fullscreen");
  if (!canFullscreen) return null;

  const label = isFullscreen ? copy.exitFullscreen : copy.fullscreen;
  return (
    <FullscreenButton className="mc-btn" aria-label={label} title={`${label} (f)`}>
      {isFullscreen ? <Minimize {...LINE_ICON} /> : <Maximize {...LINE_ICON} />}
    </FullscreenButton>
  );
}

/**
 * Total length at the end of the track (wide screens only, CSS): the chip above the track already says where the
 * playhead is, so this is the second half of "12:45 / 58:10" without a second readout. Nothing for a live stream.
 */
export function DurationLabel() {
  const duration = useMediaState("duration") as number | undefined;
  const live = useMediaState("live") as boolean | undefined;
  if (live || typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return null;
  return <Time type="duration" className="mc-duration" />;
}
