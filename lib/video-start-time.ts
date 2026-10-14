/**
 * The `?t=` start time of a video link ("start at 1:30"). Pure and dependency-free: the home page
 * (client), the share menu and the tests all use this one definition.
 *
 * Accepted: whole seconds (`90`, `90.5` is cut to 90), unit form (`1m30s`, `1h2m3s`, `45s`, `2m`)
 * and clock form (`1:30`, `1:02:03`). Anything else, a negative number or more than 24 hours is
 * not a start time (null): the player then falls back to the saved position or the beginning.
 */

/** Longest start time accepted (24 hours); anything above is treated as garbage. */
export const MAX_START_SECONDS = 24 * 60 * 60;

const UNIT_FORM = /^(?:(\d{1,5})h)?(?:(\d{1,5})m)?(?:(\d{1,6})s)?$/i;
const CLOCK_FORM = /^(\d{1,5}):([0-5]?\d)(?::([0-5]?\d))?$/;
const PLAIN_FORM = /^(\d{1,6})(?:\.\d{1,3})?$/;

/** Parses the value of `?t=`; null when it is missing or not a valid start time. */
export function parseStartTime(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 16) return null;

  let seconds: number | null = null;

  const plain = PLAIN_FORM.exec(value);
  if (plain) {
    seconds = Number(plain[1]);
  } else {
    const clock = CLOCK_FORM.exec(value);
    if (clock) {
      const hasHours = clock[3] !== undefined;
      const hours = hasHours ? Number(clock[1]) : 0;
      const minutes = hasHours ? Number(clock[2]) : Number(clock[1]);
      const secs = hasHours ? Number(clock[3]) : Number(clock[2]);
      seconds = hours * 3600 + minutes * 60 + secs;
    } else {
      const unit = UNIT_FORM.exec(value);
      // The regex also matches the empty string and a lone "h"-less miss; require at least one unit.
      if (unit && (unit[1] !== undefined || unit[2] !== undefined || unit[3] !== undefined)) {
        seconds = Number(unit[1] ?? 0) * 3600 + Number(unit[2] ?? 0) * 60 + Number(unit[3] ?? 0);
      }
    }
  }

  if (seconds === null || !Number.isFinite(seconds) || seconds < 0 || seconds > MAX_START_SECONDS) return null;
  return Math.floor(seconds);
}

/**
 * Keeps a start time inside the video: past the end it lands one second before it (so the video
 * does not end at once). An unknown duration leaves the value as it is.
 */
export function clampStartTime(seconds: number, durationSeconds?: number | null): number {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return safe;
  const last = Math.max(0, Math.floor(durationSeconds) - 1);
  return Math.min(safe, last);
}

/** `m:ss` or `h:mm:ss` for a number of seconds. */
export function formatClock(totalSeconds: number): string {
  const total = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/** The same link with `t` set to the whole seconds given (or without `t` for a missing value). */
export function withStartTime(url: string, seconds: number | null | undefined): string {
  try {
    const parsed = new URL(url);
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      parsed.searchParams.set("t", String(Math.floor(seconds)));
    } else {
      parsed.searchParams.delete("t");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
