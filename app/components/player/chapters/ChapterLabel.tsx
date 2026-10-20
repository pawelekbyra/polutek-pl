"use client";

import { useChapterOptions, useChapterTitle } from "@vidstack/react";
import { usePlayerCopy } from "../polutek-controls-copy";
import { useChaptersMenu } from "./chapters-menu-context";

/**
 * Title of the chapter being played, next to the time ("0:42 / 10:00 · Intro"). Touch screens have no hover preview
 * over the bar, so this is where a phone viewer sees the chapter. It is also a shortcut to the chapters panel.
 * Nothing without chapters.
 */
export function ChapterLabel() {
  const copy = usePlayerCopy();
  const options = useChapterOptions();
  const title = useChapterTitle();
  const { open, setOpen } = useChaptersMenu();
  if (options.length === 0 || !title) return null;

  return (
    <button
      type="button"
      className="mc-chapter-label"
      aria-haspopup="menu"
      aria-expanded={open}
      title={copy.chapters}
      onClick={() => setOpen((value) => !value)}
    >
      {title}
    </button>
  );
}
