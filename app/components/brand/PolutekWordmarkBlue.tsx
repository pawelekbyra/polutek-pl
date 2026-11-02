/**
 * The POLUTEK wordmark, blue (owner image of 2026-11-02, redrawn as pure geometry: lines and circular arcs, one path, no font,
 * no <text>, no raster). Single colour: `var(--brand-ink)` (token in globals.css, fallback #01286a = the mean of the letter
 * interiors in the original image, rgb 1,40,106). The viewBox is tight around the letters (0 0 627.57 104.06; 100 units = the
 * cap height of L, E, T), so `h-[22px]` gives letters ~21.2px tall.
 *
 * Artwork and numbers: scripts/brand/generate-wordmark-blue.mjs -> polutek-wordmark-blue-paths.ts (and the standalone
 * public/brand/polutek-wordmark-blue.svg / -mono.svg, both svgo-optimised).
 *
 * Header height: like the other variants this svg never decides the height of the top bar. It is `display: block`, has a fixed
 * height from its class (20px phones, 22px md+, 18px under 350px; always below the 40px row of the bar's controls), no margin
 * or padding (tests/unit/components/navbar-logo-height.test.tsx), so the bar stays at --header-h (47px).
 */
import { cn } from "@/lib/utils";
import { WORDMARK_BLUE_INK, WORDMARK_BLUE_PATH, WORDMARK_BLUE_VIEWBOX } from "./polutek-wordmark-blue-paths";

export default function PolutekWordmarkBlue({
  className,
  decorative = false,
}: {
  className?: string;
  /** The parent already supplies the accessible name (for example a labelled link). */
  decorative?: boolean;
}) {
  const [, , vbWidth, vbHeight] = WORDMARK_BLUE_VIEWBOX.split(" ").map(Number);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={WORDMARK_BLUE_VIEWBOX}
      // reserved box (no layout shift): the real size comes from the height class, the ratio from the viewBox
      width={Math.round((vbWidth / vbHeight) * 22)}
      height={22}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK"}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-brand-logo="wordmark-blue"
      className={cn("m-0 block h-[20px] w-auto shrink-0 select-none overflow-visible p-0 max-[350px]:h-[18px] md:h-[22px]", className)}
    >
      <path style={{ fill: `var(--brand-ink, ${WORDMARK_BLUE_INK})` }} d={WORDMARK_BLUE_PATH} />
    </svg>
  );
}
