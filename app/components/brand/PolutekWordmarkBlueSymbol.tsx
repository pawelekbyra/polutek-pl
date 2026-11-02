"use client";

/**
 * The POLUTEK logo with the play symbol in front of the blue wordmark (owner's choice 2026-11-02: variant A of the preview
 * /opt/claude/shots-logo/symbol-variants.png). One inline svg, no extra request:
 *   - rim and the two orbit swooshes in the wordmark ink `var(--brand-ink)` (#01286a), one evenodd path;
 *   - the orange play: gradient #ffb340 -> #ff7a00 (light from the top), a soft deeper tone at the bottom, a white gloss at the top,
 *     and a faint orange halo in the gap between play and rim (the only filter, clipped to the opening);
 *   - the wordmark path itself (polutek-wordmark-blue-paths.ts), shifted right by SYMBOL_WORDMARK_DX.
 * Geometry and numbers: scripts/brand/generate-symbol.mjs -> polutek-symbol-paths.ts (and public/brand/polutek-wordmark-blue-symbol.svg).
 *
 * Header height: the letters keep the size of the plain wordmark (21px on md+). The viewBox is taller than the letters (the
 * swooshes stick out ~12 units above and below), so the svg is 27px on md+, 24.5px on phones, 22px under 350px: always below
 * the 32px the logo link leaves inside the 40px row, so the bar stays at --header-h (47px). Fixed width/height attributes
 * reserve the box before CSS (no layout shift).
 */
import { useId } from "react";
import { cn } from "@/lib/utils";
import { WORDMARK_BLUE_INK, WORDMARK_BLUE_PATH } from "./polutek-wordmark-blue-paths";
import {
  SYMBOL_EFFECT,
  SYMBOL_HALO_BLUR,
  SYMBOL_HOLE_PATH,
  SYMBOL_LOCKUP_VIEWBOX,
  SYMBOL_NAVY_PATH,
  SYMBOL_PLAY_PATH,
  SYMBOL_PLAY_Y,
  SYMBOL_WORDMARK_DX,
} from "./polutek-symbol-paths";

const [, , VB_W, VB_H] = SYMBOL_LOCKUP_VIEWBOX.split(" ").map(Number);
/** svg height for 21px letters (the plain wordmark is 22px for its 104.06-unit viewBox) */
const MD_H = Math.round(((22 * VB_H) / 104.06) * 2) / 2;

export default function PolutekWordmarkBlueSymbol({
  className,
  decorative = false,
}: {
  className?: string;
  /** The parent already supplies the accessible name (for example a labelled link). */
  decorative?: boolean;
}) {
  // gradient/clip/filter ids must be unique per instance (an id in a hidden copy would blank the visible one)
  const id = `pls${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ink = `var(--brand-ink, ${WORDMARK_BLUE_INK})`;
  const [y0, y1] = SYMBOL_PLAY_Y;
  const [top, mid, bottom] = SYMBOL_EFFECT.stops;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={SYMBOL_LOCKUP_VIEWBOX}
      width={Math.round((VB_W / VB_H) * MD_H)}
      height={MD_H}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK"}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-brand-logo="wordmark-blue-symbol"
      className={cn("m-0 block h-[24.5px] w-auto shrink-0 select-none overflow-visible p-0 max-[350px]:h-[22px] md:h-[27px]", className)}
    >
      <defs>
        <linearGradient id={`${id}-o`} gradientUnits="userSpaceOnUse" x1="0" y1={y0} x2="0" y2={y1}>
          <stop offset="0" stopColor={top} />
          <stop offset=".5" stopColor={mid} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={`${id}-s`} gradientUnits="userSpaceOnUse" x1="0" y1={y0} x2="0" y2={y1}>
          <stop offset=".55" stopColor="#b84300" stopOpacity="0" />
          <stop offset="1" stopColor="#b84300" stopOpacity={SYMBOL_EFFECT.shade} />
        </linearGradient>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1={y0} x2="0" y2={y1}>
          <stop offset="0" stopColor="#fff" stopOpacity={SYMBOL_EFFECT.glossTop} />
          <stop offset=".22" stopColor="#fff" stopOpacity={SYMBOL_EFFECT.glossMid} />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-h`}>
          <path d={SYMBOL_HOLE_PATH} />
        </clipPath>
        <filter id={`${id}-b`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={SYMBOL_HALO_BLUR} />
        </filter>
      </defs>
      <path style={{ fill: ink }} fillRule="evenodd" d={SYMBOL_NAVY_PATH} />
      <g clipPath={`url(#${id}-h)`}>
        <path d={SYMBOL_PLAY_PATH} fill={mid} opacity={SYMBOL_EFFECT.glow} filter={`url(#${id}-b)`} />
      </g>
      <path data-symbol-play="" fill={`url(#${id}-o)`} d={SYMBOL_PLAY_PATH} />
      <path fill={`url(#${id}-s)`} d={SYMBOL_PLAY_PATH} />
      <path fill={`url(#${id}-g)`} d={SYMBOL_PLAY_PATH} />
      <path style={{ fill: ink }} transform={`translate(${SYMBOL_WORDMARK_DX} 0)`} d={WORDMARK_BLUE_PATH} />
    </svg>
  );
}
