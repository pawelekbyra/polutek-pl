"use client";

import { cn } from "@/lib/utils";
import { enterGlyphFilledPath } from "@/lib/icons/app-icon";

interface BrandNameProps {
  className?: string;
  decorative?: boolean;
  /**
   * Retained for API compatibility with prior SVG logo callers. The wordmark is
   * plain text now, so this is accepted but no longer renders a shine sweep.
   */
  shine?: false | "hover" | "ambient";
  /**
   * Renders the app-icon mark (the same "enter" glyph used by the favicon/PWA
   * icon) to the left of the text, forming a proper mark + wordmark lockup.
   * Defaults to true; set false for contexts too tight for the extra glyph.
   */
  mark?: boolean;
}

const MARK_GLYPH = enterGlyphFilledPath(64);

// enterGlyphFilledPath()'s own viewBox (0 0 canvas canvas) centers the glyph's
// *canvas*, not its ink — the arrow's actual coordinates sit left-and-up of
// that box's center, which reads as off-center once the glyph is the sole
// content of a small square mark (it's fine mixed into the busier bordered
// app icon, where it's less noticeable). Crop the viewBox to the glyph's own
// bounding box instead, so it optically centers here without forking the
// underlying glyph geometry.
function centeredMarkViewBox(path: string, paddingFactor = 1.18): string {
  const coords = Array.from(path.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)).map(
    (match) => [Number(match[1]), Number(match[2])] as const,
  );
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = (Math.max(maxX - minX, maxY - minY) / 2) * paddingFactor;
  return `${cx - half} ${cy - half} ${half * 2} ${half * 2}`;
}

const MARK_VIEW_BOX = centeredMarkViewBox(MARK_GLYPH.path);

/**
 * Logo lockup: an ink rounded-square mark carrying the site's "enter" glyph
 * (the same mark used for the favicon/PWA icon, from `lib/icons/app-icon.ts`)
 * next to the "POLUTEK.PL" wordmark, set in Space Grotesk Bold (self-hosted,
 * `font-brandLogo`). "POLUTEK" is the near-black ink token; the ".PL" (dot +
 * PL) is the site's blue accent.
 */
export default function BrandName({
  className,
  decorative = false,
  mark = true,
}: BrandNameProps) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center whitespace-nowrap leading-none",
        className,
      )}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK.PL"}
      aria-hidden={decorative ? true : undefined}
    >
      {mark && (
        <span
          aria-hidden="true"
          className="mr-[0.32em] flex h-[1.05em] w-[1.05em] shrink-0 items-center justify-center rounded-[0.3em] bg-[var(--chan-ink)]"
        >
          <svg viewBox={MARK_VIEW_BOX} className="h-[80%] w-[80%]">
            <path d={MARK_GLYPH.path} fill="var(--chan-blue)" />
          </svg>
        </span>
      )}
      <span className="font-brandLogo tracking-[0.005em] text-[var(--chan-ink)]">
        POLUTEK
      </span>
      <span className="font-brandLogo tracking-[0.005em] text-[var(--chan-blue)]">
        .PL
      </span>
    </span>
  );
}
