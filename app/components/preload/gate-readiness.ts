/**
 * When the entry gate may show "ENTER", and how it is entered: pure decisions (no DOM, no timers),
 * unit tested, used by PageRevealGate.
 *
 * Two different patience limits, both counted from the start of the navigation:
 * - the PAGE (auth, player, comments): {@link PAGE_REVEAL_MAX_WAIT_MS}; a piece that never settles
 *   must not hold the viewer back, the entry is then allowed anyway;
 * - the entry WARP's own assets, the decoded sound above all: {@link GATE_SOUND_MAX_WAIT_MS}. The
 *   owner wants no entry before the sound is ready (an animation cut to a sound that begins seconds
 *   late is worse than a longer bar), so on a slow machine the loading bar simply stays up. Only when
 *   the sound truly cannot be had (fetch or decode error, or this long limit) the entry is the plain
 *   fade, without animation and without sound: never a half-silent warp.
 *
 * The long limit stays under the 30 s CSS failsafe of the loading screen.
 */

/** The page's pieces: after this long the entry is allowed even if one of them never settled. */
export const PAGE_REVEAL_MAX_WAIT_MS = 6000;
/** The entry's sound (and rabbit vector): the bar waits for them this long before giving the warp up. */
export const GATE_SOUND_MAX_WAIT_MS = 25000;
/** Whatever the limits say, the bar is up for at least this long after the gate mounted (no flash). */
export const PAGE_REVEAL_MIN_WAIT_AFTER_MOUNT_MS = 700;

/** One of the warp's assets: pending, loaded, failed for good, or not needed (no warp on this device). */
export type AssetState = "pending" | "ready" | "failed" | "not-needed";

/** True once the asset's fate is known (loaded or failed). */
export function isAssetSettled(state: AssetState): boolean {
  return state !== "pending";
}

export type GateReadinessInput = {
  authLoaded: boolean;
  /** Every awaited piece of the page has reported ready. */
  pagePiecesReady: boolean;
  /** {@link PAGE_REVEAL_MAX_WAIT_MS} has passed. */
  pageLimitReached: boolean;
  sound: AssetState;
  vector: AssetState;
  /** {@link GATE_SOUND_MAX_WAIT_MS} has passed. */
  soundLimitReached: boolean;
};

/** Whether the loading bar may give way to ENTER. */
export function isGateOpen(input: GateReadinessInput): boolean {
  const pageOk = (input.authLoaded && input.pagePiecesReady) || input.pageLimitReached;
  const assetsOk = (isAssetSettled(input.sound) && isAssetSettled(input.vector)) || input.soundLimitReached;
  return pageOk && assetsOk;
}

/**
 * How a click on ENTER enters: "warp" (the animation with its sound) only with a decoded sound and a
 * device that can play the animation; otherwise "fade" (the plain fade, silent, no animation).
 */
export function entryKind(input: { canWarp: boolean; soundReady: boolean }): "warp" | "fade" {
  return input.canWarp && input.soundReady ? "warp" : "fade";
}

/**
 * Milliseconds to wait from now before a limit counts as reached: the limit is measured from the
 * navigation start (`sinceNavigationStartMs`, performance.now()), but never shorter than the minimum
 * after the gate mounted.
 */
export function waitUntilLimitMs(limitMs: number, sinceNavigationStartMs: number): number {
  return Math.max(PAGE_REVEAL_MIN_WAIT_AFTER_MOUNT_MS, limitMs - sinceNavigationStartMs);
}
