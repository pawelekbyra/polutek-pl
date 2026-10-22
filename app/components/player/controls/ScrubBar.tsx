"use client";

import { useEffect, useRef } from "react";
import { Time, TimeSlider, useChapterTitle } from "@vidstack/react";
import { usePlayerCopy } from "../polutek-controls-copy";

/**
 * The time chip that rides above the playhead ("12:45 · Intro"). It is clamped to the track like Vidstack's own
 * preview, which needs its width in CSS: a ResizeObserver keeps `--mc-chip-w` current (the text grows from 9:59 to
 * 10:00, the chapter title changes). While the viewer hovers or drags, the preview chip takes its place at the
 * same height, so one chip seems to follow the pointer. Decorative for assistive tech: the slider itself announces
 * the time, and the chapters button names the chapter.
 */
function PlayheadChip() {
  const ref = useRef<HTMLDivElement>(null);
  const chapter = useChapterTitle();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => el.style.setProperty("--mc-chip-w", `${el.offsetWidth}px`);
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="mc-chip mc-chip--playhead" aria-hidden="true">
      <Time type="current" className="mc-chip-time" />
      {chapter ? <span className="mc-chip-chapter">{chapter}</span> : null}
    </div>
  );
}

/**
 * Progress track. The slider root is the hit area (24px tall with a mouse, 44px on touch) around a 3px line that
 * grows to 5px while pointed at or dragged; one segment per chapter (Vidstack sizes them; without chapters there
 * is one). Buffered range in translucent white, watched part in the brand blue, a white thumb on interaction.
 */
export function ScrubBar() {
  const copy = usePlayerCopy();
  return (
    <TimeSlider.Root className="mc-scrub" aria-label={copy.progress}>
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
      <PlayheadChip />
      <TimeSlider.Preview className="mc-chip mc-chip--preview">
        <TimeSlider.Value className="mc-chip-time" />
        <TimeSlider.ChapterTitle className="mc-chip-chapter" />
      </TimeSlider.Preview>
    </TimeSlider.Root>
  );
}
