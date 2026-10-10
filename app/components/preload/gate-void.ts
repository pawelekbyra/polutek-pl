/**
 * THE VOID: what happens on the black screen between the end of the zoom into the pupil
 * (WARP.blackAt) and the final flash (WARP.flash), about 6.9 s of the entry sound
 * (gate-warp-timeline.ts). It is intentionally empty for now: the screen is plain black. The
 * animation for this part of the entry is to be built here.
 *
 * Called by GateWarp once per frame while the void is on, after the black layer was painted, with a
 * canvas context already scaled to CSS pixels (draw in CSS px, the origin is the top-left corner of
 * the visible viewport).
 *
 * @param ctx   2D context of the warp canvas.
 * @param size  visible viewport in CSS px.
 * @param t     seconds since the click, from the sound's clock (use it, not the wall clock, to stay in sync).
 * @param u     progress through the void: 0 at the first black frame, 1 at the flash.
 */
export function drawVoid(_ctx: CanvasRenderingContext2D, _size: { width: number; height: number }, _t: number, _u: number): void {
  // Nothing yet: black.
}
