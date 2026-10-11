/**
 * Which white rabbit the entry gate shows, and where the entry warp goes in. ONE SWITCH:
 * change `GATE_RABBIT_VARIANT` below ("eye" or "rear"), run the tests and deploy; nothing else needs
 * to change (CLAUDE.md §4.13, "Królik i wejście").
 *
 * - "eye":  the first rabbit, seen from the side (public/rabbit-gate.svg); the warp zooms into the
 *           black core of the eye's pupil;
 * - "rear": the rabbit seen from behind (public/rabbit-gate-2.svg, the owner's drawing of 2026-10-11);
 *           the warp goes in through the black dot under its tail.
 *
 * Each variant has its own picture file (never overwrite a picture with another drawing under the
 * same name: it is cached by browsers and Cloudflare for hours, and a cached picture with the other
 * variant's target would send the zoom into the wrong spot), its target and its placement.
 */

export type GateRabbitVariant = {
  /** Vector picture (traced SVG, three flat layers: white silhouette, light shading, black lines). */
  svg: string;
  /**
   * Where the warp goes in, as a share of the picture's (square) edge: the centre of the black spot
   * and the radius that is still solid black. Named "pupil" throughout the warp code.
   */
  target: { x: number; y: number; core: number };
  /**
   * Shift of the picture inside its box (share of its edge), so the body sits centred over ENTER;
   * applied as a CSS transform on the rabbit's box, which the warp reads from the layout.
   */
  shift: { x: number; y: number };
};

export const GATE_RABBIT_VARIANTS = {
  eye: {
    svg: "/rabbit-gate.svg",
    target: { x: 275.5 / 440, y: 183.5 / 440, core: 2.8 / 440 },
    shift: { x: 0, y: 0 },
  },
  rear: {
    svg: "/rabbit-gate-2.svg",
    target: { x: 570.3 / 1926, y: 1707.8 / 1926, core: 9 / 1926 },
    shift: { x: 0.08, y: -0.06 },
  },
} as const satisfies Record<string, GateRabbitVariant>;

/** THE SWITCH: "eye" (through the eye) or "rear" (through the dot under the tail). */
export const GATE_RABBIT_VARIANT: keyof typeof GATE_RABBIT_VARIANTS = "eye";

export const GATE_RABBIT: GateRabbitVariant = GATE_RABBIT_VARIANTS[GATE_RABBIT_VARIANT];
