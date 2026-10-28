"use client";

import { useCallback, useEffect, useId, useRef, type KeyboardEvent } from "react";
import { useChapterOptions, useMediaPlayer, useMediaState } from "@vidstack/react";
import { cn } from "@/lib/utils";
import { ChaptersIcon, CheckIcon } from "../controls/PlayerIconSet";
import { formatClock } from "@/lib/video-start-time";
import { usePlayerCopy } from "../polutek-controls-copy";
import { useChaptersMenu } from "./chapters-menu-context";
import { seekPlayerTo } from "./seek-player";

/**
 * The chapters button and its panel (same pattern as PlayerSettingsMenu): a button plus `role="menu"`; arrows, Home and
 * End move, Enter/Space jump to the chapter and close, Escape closes and returns the focus. On a phone the panel is a
 * sheet over the bottom of the player (globals.css), inside its frame, and the button itself gives way to the
 * settings menu's "Chapters" entry (the row keeps its room for the track). Nothing without chapters.
 */
export function ChaptersMenu() {
  const copy = usePlayerCopy();
  const player = useMediaPlayer();
  const options = useChapterOptions();
  const controlsVisible = useMediaState("controlsVisible") as boolean | undefined;
  const { open, setOpen, opener } = useChaptersMenu();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const titleId = `${menuId}-title`;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      // On a phone the panel's own button is hidden by CSS (it cannot take focus): go back to what opened the panel.
      const trigger = triggerRef.current;
      const visible = trigger && getComputedStyle(trigger).display !== "none";
      (visible ? trigger : (opener.current ?? trigger))?.focus();
    }
    opener.current = null;
  }, [setOpen, opener]);

  // Controls hide after inactivity (and take the panel with them): close it too.
  useEffect(() => {
    if (open && controlsVisible === false) setOpen(false);
  }, [open, controlsVisible, setOpen]);

  // A click or tap outside closes it (the settings menu's "Chapters" entry, on narrow screens, opens it).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (rootRef.current?.contains(target as Node) || target?.closest?.(".mc-menu-item--nav")) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, setOpen]);

  // Focus moves to the chapter being played (else the first) when it opens, and that item is scrolled into view.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;
    const current = Array.from(items).find((el) => el.getAttribute("aria-current") === "true") ?? items[0];
    current.focus({ preventScroll: true });
    // Scroll the panel itself (scrollIntoView would also move the page).
    const menu = menuRef.current;
    if (menu) menu.scrollTop = Math.max(0, current.offsetTop - (menu.clientHeight - current.offsetHeight) / 2);
    // Only on opening.
  }, [open]);

  if (options.length === 0) return null;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.selected));
  const label = `${copy.chapters}: ${copy.chapterOf(selectedIndex + 1, options.length)}`;

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => {
      if (items.length > 0) items[(index + items.length) % items.length].focus();
    };
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(current <= 0 ? items.length - 1 : current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "Tab":
        // Leave the menu in the direction of Tab: park the focus on the button first so the browser continues from there.
        close(true);
        break;
      default:
        break;
    }
  };

  const choose = (startTime: number) => {
    if (player) seekPlayerTo(player, startTime);
    close(true);
  };

  return (
    <div className="mc-settings mc-chapters" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="mc-btn"
        aria-label={label}
        title={copy.chapters}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <ChaptersIcon className="mc-icon" />
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={copy.chapters}
          className="mc-menu mc-chapters-panel"
          onKeyDown={onMenuKeyDown}
        >
          <div role="group" aria-labelledby={titleId}>
            <div id={titleId} className="mc-menu-title">{copy.chapters} ({options.length})</div>
            {options.map((option) => (
              <button
                key={option.cue.startTime}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-current={option.selected ? "true" : undefined}
                className={cn("mc-menu-item mc-chapter-item", option.selected && "mc-menu-item--on")}
                onClick={() => choose(option.cue.startTime)}
              >
                <span className="mc-chapter-item-time">{formatClock(option.cue.startTime)}</span>
                <span className="mc-chapter-item-title">{option.label}</span>
                {option.selected && <CheckIcon className="mc-menu-check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
