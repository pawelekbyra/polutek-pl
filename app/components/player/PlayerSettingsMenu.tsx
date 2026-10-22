"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { isTrackCaptionKind, useChapterOptions, useChapterTitle, useMediaRemote, useMediaState } from "@vidstack/react";
import { ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChaptersMenu } from "./chapters/chapters-menu-context";
import { LINE_ICON } from "./controls/ControlButtons";
import { usePlayerCopy } from "./polutek-controls-copy";
import { qualityBadge } from "./quality-label";
import { CAPTIONS_IN_MENU_QUERY } from "./controls/ControlButtons";
import { useMediaQuery } from "./use-media-query";
import {
  PLAYBACK_RATES,
  pickQualityIndexForHeight,
  readQualityPreference,
  readRatePreference,
  writeQualityPreference,
  writeRatePreference,
} from "./player-preferences";

type QualityLike = { height: number };

/** The menu's items in DOM order, minus the ones CSS hides on this screen (they cannot take the focus). */
function menuItems(menu: HTMLElement | null): HTMLElement[] {
  const all = Array.from(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  return all.filter((el) => typeof getComputedStyle !== "function" || getComputedStyle(el).display !== "none");
}

function rateLabel(rate: number, normal: string): string {
  return rate === 1 ? normal : `${rate}x`;
}

/**
 * The player's settings menu: quality (Auto + the renditions of the HLS manifest), speed (0.5x-2x)
 * and picture-in-picture where the browser offers it. On narrow screens it also holds the entries the bar drops
 * there (picture-in-picture, the chapters panel; `mc-menu-item--narrow`), and below 400px the captions switch
 * (rendered only then, so the keyboard never lands on a hidden item). The trigger shows the quality of the
 * rendition being played ("HD", "4K", "SD"), or a gear while that is unknown. The viewer's choices are remembered
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
  const chapterOptions = useChapterOptions();
  const chapterTitle = useChapterTitle();
  const chaptersMenu = useChaptersMenu();
  const hasCaptions = useMediaState("hasCaptions") as boolean | undefined;
  const textTrack = useMediaState("textTrack");
  const captionsInMenu = useMediaQuery(CAPTIONS_IN_MENU_QUERY) && Boolean(hasCaptions);
  const captionsOn = Boolean(textTrack && isTrackCaptionKind(textTrack));

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
    const items = menuItems(menuRef.current);
    if (items.length === 0) return;
    const checked = items.find((el) => el.getAttribute("aria-checked") === "true");
    (checked ?? items[0]).focus();
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(menuRef.current);
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

  const toggleCaptions = (event: { nativeEvent: Event }) => {
    remote.toggleCaptions(event.nativeEvent);
    close(true);
  };

  const togglePip = () => {
    if (inPip) remote.exitPictureInPicture?.();
    else remote.enterPictureInPicture?.();
    close(true);
  };

  const openChapters = () => {
    close(false);
    chaptersMenu.setOpen(true);
  };

  const badge = qualityBadge(quality?.height);
  const triggerLabel = badge ? `${copy.settings} (${badge})` : copy.settings;
  const qualityTitleId = `${menuId}-quality`;
  const speedTitleId = `${menuId}-speed`;
  const autoLabel =
    autoQuality !== false && quality?.height ? `${copy.qualityAuto} (${quality.height}p)` : copy.qualityAuto;

  return (
    <div className="mc-settings" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn("mc-btn", badge && "mc-btn--badge")}
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {badge ? <span className="mc-quality-badge" aria-hidden="true">{badge}</span> : <Settings {...LINE_ICON} />}
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

          {captionsInMenu ? (
            <div className="mc-menu-sep" role="separator" />
          ) : (canPip || chapterOptions.length > 0) && <div className="mc-menu-sep mc-menu-item--narrow" role="separator" />}
          {captionsInMenu && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={captionsOn}
              aria-keyshortcuts="c"
              className={cn("mc-menu-item", captionsOn && "mc-menu-item--on")}
              onClick={toggleCaptions}
            >
              {copy.captions}
            </button>
          )}
          {chapterOptions.length > 0 && (
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              className="mc-menu-item mc-menu-item--narrow mc-menu-item--nav"
              onClick={openChapters}
            >
              <span>{copy.chapters}</span>
              <span className="mc-menu-item-hint">
                {chapterTitle ? <span className="mc-menu-item-hint-text">{chapterTitle}</span> : null}
                <ChevronRight size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
              </span>
            </button>
          )}
          {canPip && (
            <button type="button" role="menuitem" className="mc-menu-item mc-menu-item--narrow" onClick={togglePip}>
              {inPip ? copy.exitPictureInPicture : copy.pictureInPicture}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
