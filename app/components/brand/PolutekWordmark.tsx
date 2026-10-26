/**
 * The POLUTEK.COM wordmark as outlined SVG paths: no web font, no <text>, crisp at any DPR.
 *
 * Artwork: original geometry (round-capped strokes of a single weight, outlined into filled paths by
 * scripts/brand/generate-wordmark.py), so there are no third-party font outlines and no font licence
 * to attribute. "POLUTEK" uses the ink token, ".COM" (dot included) the brand blue, both overridable
 * from CSS (--chan-ink / --chan-blue), so the wordmark follows the site's tokens. Standalone copies:
 * public/brand/polutek-wordmark.svg and polutek-wordmark-mono.svg.
 *
 * Sizing is height-driven: pass a height class (default 18px on phones, 21px from md up; override with a height class); the width follows the
 * artwork's aspect ratio (viewBox 923.13 x 102, about 9.05 : 1).
 */
import { cn } from "@/lib/utils";

const INK_PATH =
  "M24 12L24 88A12 12 0 0 1 0 88L0 12A12 12 0 0 1 24 12ZM12 0L32 0A12 12 0 0 1 32 24L12 24A12 12 0 0 1 12 0ZM12 56L32 56A12 12 0 0 1 32 80L12 80A12 12 0 0 1 12 56ZM32 0A40 40 0 0 1 32 80A12 12 0 0 1 32 56A16 16 0 0 0 32 24A12 12 0 0 1 32 0ZM130 -2A52 52 0 0 1 130 102A12 12 0 0 1 130 78A28 28 0 0 0 130 22A12 12 0 0 1 130 -2ZM130 102A52 52 0 0 1 130 -2A12 12 0 0 1 130 22A28 28 0 0 0 130 78A12 12 0 0 1 130 102ZM213 12L213 88A12 12 0 0 1 189 88L189 12A12 12 0 0 1 213 12ZM201 76L239 76A12 12 0 0 1 239 100L201 100A12 12 0 0 1 201 76ZM280 12L280 61A12 12 0 0 1 256 61L256 12A12 12 0 0 1 280 12ZM336 12L336 61A12 12 0 0 1 312 61L312 12A12 12 0 0 1 336 12ZM336 61A40 40 0 0 1 256 61A12 12 0 0 1 280 61A16 16 0 0 0 312 61A12 12 0 0 1 336 61ZM355 0L409 0A12 12 0 0 1 409 24L355 24A12 12 0 0 1 355 0ZM394 12L394 88A12 12 0 0 1 370 88L370 12A12 12 0 0 1 394 12ZM450 12L450 88A12 12 0 0 1 426 88L426 12A12 12 0 0 1 450 12ZM438 0L481 0A12 12 0 0 1 481 24L438 24A12 12 0 0 1 438 0ZM438 38L475 38A12 12 0 0 1 475 62L438 62A12 12 0 0 1 438 38ZM438 76L481 76A12 12 0 0 1 481 100L438 100A12 12 0 0 1 438 76ZM524 12L524 88A12 12 0 0 1 500 88L500 12A12 12 0 0 1 524 12ZM576.56 21.32L523.56 64.32A12 12 0 0 1 508.44 45.68L561.44 2.68A12 12 0 0 1 576.56 21.32ZM550.38 31.98L579.38 81.98A12 12 0 0 1 558.62 94.02L529.62 44.02A12 12 0 0 1 550.38 31.98Z";
const BLUE_PATH =
  "M583 88.1A12.2 12.2 0 1 1 607.4 88.1A12.2 12.2 0 1 1 583 88.1ZM703.04 84.79A52 52 0 1 1 703.04 15.21A12 12 0 0 1 685.21 31.26A28 28 0 1 0 685.21 68.74A12 12 0 0 1 703.04 84.79ZM764.13 -2A52 52 0 0 1 764.13 102A12 12 0 0 1 764.13 78A28 28 0 0 0 764.13 22A12 12 0 0 1 764.13 -2ZM764.13 102A52 52 0 0 1 764.13 -2A12 12 0 0 1 764.13 22A28 28 0 0 0 764.13 78A12 12 0 0 1 764.13 102ZM847.13 12L847.13 88A12 12 0 0 1 823.13 88L823.13 12A12 12 0 0 1 847.13 12ZM923.13 12L923.13 88A12 12 0 0 1 899.13 88L899.13 12A12 12 0 0 1 923.13 12ZM845.91 7.04L882.91 59.04A12 12 0 0 1 863.35 72.96L826.35 20.96A12 12 0 0 1 845.91 7.04ZM919.91 20.96L882.91 72.96A12 12 0 0 1 863.35 59.04L900.35 7.04A12 12 0 0 1 919.91 20.96Z";

export const WORDMARK_VIEWBOX = "0 -1 923.13 102";

export default function PolutekWordmark({
  className,
  decorative = false,
}: {
  className?: string;
  /** The parent already supplies the accessible name (for example a labelled link). */
  decorative?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={WORDMARK_VIEWBOX}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "POLUTEK.COM"}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-brand-logo="wordmark"
      className={cn("block h-[18px] w-auto md:h-[21px] shrink-0 select-none overflow-visible", className)}
    >
      <path style={{ fill: "var(--chan-ink, #111827)" }} d={INK_PATH} />
      <path style={{ fill: "var(--chan-blue, #2563eb)" }} d={BLUE_PATH} />
    </svg>
  );
}
