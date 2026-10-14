"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useMediaRemote, useMediaState } from "@vidstack/react";
import { cn } from "@/lib/utils";
import { usePlayerCopy } from "./polutek-controls-copy";
import {
  PLAYBACK_RATES,
  pickQualityIndexForHeight,
  readQualityPreference,
  readRatePreference,
  writeQualityPreference,
  writeRatePreference,
} from "./player-preferences";

// Material "settings" glyph (24x24).
const GEAR_PATH =
  "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z";

type QualityLike = { height: number };

function rateLabel(rate: number, normal: string): string {
  return rate === 1 ? normal : `${rate}x`;
}

/**
 * The player's settings menu: quality (Auto + the renditions of the HLS manifest), speed (0.5x-2x)
 * and picture-in-picture where the browser offers it. The viewer's choices are remembered
 * (player-preferences.ts). It is a plain button + menu (roles `menu`, `menuitemradio`): Enter/Space
 * opens it, arrows move, Escape closes and returns the focus. Speed keyboard shortcuts stay off
 * (VideoPlayer's `keyShortcuts`): the menu is the one control, so nothing can change speed silently.
 */
export function PlayerSettingsMenu() {
  const copy = usePlayerCopy();
  const remote = useMediaRemote();
  const qualities = (useMediaState("qualities") as QualityLike[] | undefined) ?? [];
  const quality = useMediaState("quality") as QualityLike | null | undefined;
  const autoQuality = useMediaState("autoQuality") as boolean | undefined;
  const rate = (useMediaState("playbackRate") as number | undefined) ?? 1;
  const canPlay = useMediaState("canPlay") as boolean | undefined;
  const controlsVisible = useMediaState("controlsVisible") as boolean | undefined;
  const canPip = useMediaState("canPictureInPicture") as boolean | undefined;
  const inPip = useMediaState("pictureInPicture") as boolean | undefined;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Quality choices, best first. Auto is always there when the stream has more than one rendition.
  const sortedQualities = qualities
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.height - a.item.height);
  const hasQuality = qualities.length > 1;

  // The saved speed, once the player can play (a new video or a remounted player starts at 1x).
  useEffect(() => {
    if (!canPlay) return;
    const wanted = readRatePreference();
    if (wanted !== 1) remote.changePlaybackRate?.(wanted);
    // Only when the player becomes ready; the menu itself applies later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPlay]);

  // The saved quality, as soon as the manifest's renditions are known. A height this video does not
  // have leaves it on Auto.
  const qualityCount = qualities.length;
  useEffect(() => {
    if (qualityCount < 2) return;
    const wanted = readQualityPreference();
    if (wanted === "auto") return;
    const index = pickQualityIndexForHeight(qualities, wanted);
    if (index >= 0) remote.changeQuality?.(index);
    // Only when the list of renditions appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityCount]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Controls hide after inactivity (and take the menu with them): close it too.
  useEffect(() => {
    if (open && controlsVisible === false) setOpen(false);
  }, [open, controlsVisible]);

  // Click or tap outside closes the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Focus moves into the menu (the checked speed, else the first item) when it opens.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]');
    if (!items || items.length === 0) return;
    const checked = Array.from(items).find((el) => el.getAttribute("aria-checked") === "true");
    (checked ?? items[0]).focus();
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => {
      if (items.length === 0) return;
      items[(index + items.length) % items.length].focus();
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
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const chooseQuality = (index: number) => {
    remote.changeQuality?.(index);
    writeQualityPreference(index < 0 ? "auto" : qualities[index].height);
    close(true);
  };

  const chooseRate = (value: number) => {
    remote.changePlaybackRate?.(value);
    writeRatePreference(value);
    close(true);
  };

  const togglePip = () => {
    if (inPip) remote.exitPictureInPicture?.();
    else remote.enterPictureInPicture?.();
    close(true);
  };

  const qualityTitleId = `${menuId}-quality`;
  const speedTitleId = `${menuId}-speed`;
  const autoLabel =
    autoQuality !== false && quality?.height ? `${copy.qualityAuto} (${quality.height}p)` : copy.qualityAuto;

  return (
    <div className="mc-settings" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="mc-btn"
        aria-label={copy.settings}
        title={copy.settings}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" className="mc-icon" aria-hidden="true" focusable="false">
          <path d={GEAR_PATH} fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={copy.settings}
          className="mc-menu"
          onKeyDown={onMenuKeyDown}
        >
          {hasQuality && (
            <div role="group" aria-labelledby={qualityTitleId}>
              <div id={qualityTitleId} className="mc-menu-title">{copy.quality}</div>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={autoQuality !== false}
                className={cn("mc-menu-item", autoQuality !== false && "mc-menu-item--on")}
                onClick={() => chooseQuality(-1)}
              >
                {autoLabel}
              </button>
              {sortedQualities.map(({ item, index }) => {
                const checked = autoQuality === false && quality?.height === item.height;
                return (
                  <button
                    key={`${item.height}-${index}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    className={cn("mc-menu-item", checked && "mc-menu-item--on")}
                    onClick={() => chooseQuality(index)}
                  >
                    {item.height}p
                  </button>
                );
              })}
            </div>
          )}

          <div role="group" aria-labelledby={speedTitleId}>
            <div id={speedTitleId} className="mc-menu-title">{copy.speed}</div>
            {PLAYBACK_RATES.map((value) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={rate === value}
                className={cn("mc-menu-item", rate === value && "mc-menu-item--on")}
                onClick={() => chooseRate(value)}
              >
                {rateLabel(value, copy.speedNormal)}
              </button>
            ))}
          </div>

          {canPip && (
            <button type="button" role="menuitem" className="mc-menu-item mc-menu-item--pip" onClick={togglePip}>
              {inPip ? copy.exitPictureInPicture : copy.pictureInPicture}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
