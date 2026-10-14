/**
 * Resume-watching rules (pure, no I/O). One definition shared by the save route, the viewer's start
 * position, the "Continue watching" shelf and the tests.
 *
 *  - below 5 s nothing is stored (a click-through is not "watching");
 *  - past 95 % of the video the saved row is removed (watched to the end);
 *  - in between the position is upserted.
 */

/** Positions below this are not saved. */
export const PROGRESS_MIN_SECONDS = 5;

/** A position at or past this share of the duration counts as "finished" and clears the row. */
export const PROGRESS_COMPLETE_FRACTION = 0.95;

/** Upper bound of a position/duration we accept (24 h); keeps absurd client values out of the table. */
export const PROGRESS_MAX_SECONDS = 24 * 60 * 60;

export type ProgressDecision =
  | { action: "ignore" }
  | { action: "clear" }
  | { action: "save"; positionSeconds: number; durationSeconds: number | null };

function toWholeSeconds(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.floor(value), PROGRESS_MAX_SECONDS);
}

/** "M:SS" / "H:MM:SS" (the `Video.duration` text) in seconds; null for anything else. */
export function parseDurationText(text: string | null | undefined): number | null {
  if (typeof text !== "string") return null;
  const parts = text.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const numbers = parts.map((part) => (/^\d{1,5}$/.test(part) ? Number(part) : NaN));
  if (numbers.some((n) => Number.isNaN(n))) return null;
  const [h, m, s] = numbers.length === 3 ? numbers : [0, numbers[0], numbers[1]];
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/**
 * What to do with a reported position. `durationSeconds` is the best known length (the server's
 * own value when it has one, otherwise the player's); without any duration only the lower bound
 * applies, because "95 %" cannot be told.
 */
export function decideProgressWrite(input: {
  positionSeconds: number;
  durationSeconds?: number | null;
}): ProgressDecision {
  const position = toWholeSeconds(input.positionSeconds);
  if (position === null) return { action: "ignore" };
  if (position < PROGRESS_MIN_SECONDS) return { action: "ignore" };

  const duration = toWholeSeconds(input.durationSeconds);
  if (duration !== null && duration > 0) {
    if (position >= duration * PROGRESS_COMPLETE_FRACTION) return { action: "clear" };
    return { action: "save", positionSeconds: position, durationSeconds: duration };
  }
  return { action: "save", positionSeconds: position, durationSeconds: null };
}

/** True for a stored row that is worth resuming from (same bounds as the writer). */
export function isResumablePosition(positionSeconds: number, durationSeconds: number | null | undefined): boolean {
  if (!Number.isFinite(positionSeconds) || positionSeconds < PROGRESS_MIN_SECONDS) return false;
  if (typeof durationSeconds === "number" && durationSeconds > 0) {
    return positionSeconds < durationSeconds * PROGRESS_COMPLETE_FRACTION;
  }
  return true;
}
