"use client";

/**
 * The POLUTEK logo with the play symbol in front of the blue wordmark (owner's choice 2026-11-02: variant A of the preview
 * /opt/claude/shots-logo/symbol-variants.png; the same evening the owner removed the two orbit arcs, so the live symbol is the
 * rim + the orange play only; `orbit` brings the arcs back = logo variant "wordmark-blue-symbol-orbit"). One inline svg, no request:
 *   - the rim (and with `orbit` the two arcs) in the wordmark ink `var(--brand-ink)` (#01286a);
 *   - the orange play: gradient #ffb340 -> #ff7a00 (light from the top), a soft deeper tone at the bottom, a white gloss at the top,
 *     and a faint orange halo in the gap between play and rim (the only filter, clipped to the opening);
 *   - the wordmark path itself (polutek-wordmark-blue-paths.ts), shifted right by `wordmarkDx`.
 * Geometry and numbers: scripts/brand/generate-symbol.mjs -> polutek-symbol-paths.ts (and public/brand/polutek-wordmark-blue-symbol*.svg).
 *
 * Header height: the letters keep the size of the plain wordmark (21px on md+, 20px phones, 18px under 350px); the viewBox is a
 * little taller than the letters (the body is 110 units against 100-unit letters; with the arcs 127 units), so the svg is
 * 23.5/21/19px (arcs: 27/24.5/22px): always below the 32px the logo link leaves inside the 40px row, so the bar stays at
 * --header-h (47px). Fixed width/height attributes reserve the box before CSS (no layout shift).
 */
import { useId } from "react";
import { cn } from "@/lib/utils";
import { WORDMARK_BLUE_INK, WORDMARK_BLUE_PATH } from "./polutek-wordmark-blue-paths";
import { SYMBOL, SYMBOL_EFFECT, SYMBOL_ORBIT } from "./polutek-symbol-paths";

// literal class strings (Tailwind only sees literals): svg heights that keep the letters as big as the plain wordmark
const SIZE = {
  plain: { md: 23.5, cls: "h-[21px] max-[350px]:h-[19px] md:h-[23.5px]" },
  orbit: { md: 27, cls: "h-[24.5px] max-[350px]:h-[22px] md:h-[27px]" },
} as const;

export default function PolutekWordmarkBlueSymbol({
  className,
  decorative = false,
  orbit = false,
}: {
  className?: string;
  /** The parent already supplies the accessible name (for example a labelled link). */
  decorative?: boolean;
  /** Draw the two orbit arcs around the symbol (logo variant "wordmark-blue-symbol-orbit"). */
  orbit?: boolean;
}) {
  // gradient/clip/filter ids must be unique per instance (an id in a hidden copy would blank the visible one)
  const id = `pls${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const s = orbit ? SYMBOL_ORBIT : SYMBOL;
  const size = orbit ? SIZE.orbit : SIZE.plain;
  const [, , vbW, vbH] = s.viewBox.split(" ").map(Number);
  const ink = `var(--brand-ink, ${WORDMARK_BLUE_INK})`;
  const [y0, y1] = s.playY;
  const [top, mid, bottom] = SYMBOL_EFFECT.stops;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={s.viewBox}
      width={Math.round((vbW / vbH) * size.md)}
      height={Math.round(size.md)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK"}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-brand-logo={orbit ? "wordmark-blue-symbol-orbit" : "wordmark-blue-symbol"}
      className={cn("m-0 block w-auto shrink-0 select-none overflow-visible p-0", size.cls, className)}
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
          <path d={s.hole} />
        </clipPath>
        <filter id={`${id}-b`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={s.haloBlur} />
        </filter>
      </defs>
      <path data-symbol-rim="" style={{ fill: ink }} fillRule="evenodd" d={s.navy} />
      <g clipPath={`url(#${id}-h)`}>
        <path d={s.play} fill={mid} opacity={SYMBOL_EFFECT.glow} filter={`url(#${id}-b)`} />
      </g>
      <path data-symbol-play="" fill={`url(#${id}-o)`} d={s.play} />
      <path fill={`url(#${id}-s)`} d={s.play} />
      <path fill={`url(#${id}-g)`} d={s.play} />
      <path style={{ fill: ink }} transform={`translate(${s.wordmarkDx} 0)`} d={WORDMARK_BLUE_PATH} />
    </svg>
  );
}
