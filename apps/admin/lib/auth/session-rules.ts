import { ADMIN_SESSION_ABSOLUTE_SECONDS, ADMIN_STEP_UP_SECONDS } from "@admin/lib/config";

/** Pure session rules of the panel (no I/O), shared by the auth plugin, the page guards and tests. */
type SessionTimes = { createdAt: Date | string; stepUpAt?: Date | string | null };

const ms = (d: Date | string) => new Date(d).getTime();

/**
 * "Fresh" = the owner proved who he is in the last 5 minutes: either he signed in (a passkey step-up
 * creates a new session) or he confirmed a TOTP code on this session.
 */
export function isStepUpFresh(session: SessionTimes, now: number = Date.now()): boolean {
  const last = Math.max(ms(session.createdAt), session.stepUpAt ? ms(session.stepUpAt) : 0);
  return now - last <= ADMIN_STEP_UP_SECONDS * 1000;
}

/** Seconds of step-up validity left (0 when not fresh); the UI shows it next to sensitive actions. */
export function stepUpSecondsLeft(session: SessionTimes, now: number = Date.now()): number {
  const last = Math.max(ms(session.createdAt), session.stepUpAt ? ms(session.stepUpAt) : 0);
  return Math.max(0, Math.ceil((last + ADMIN_STEP_UP_SECONDS * 1000 - now) / 1000));
}

/** The 12-hour ceiling counted from sign-in; the idle timeout is enforced by the session expiry itself. */
export function isAbsoluteExpired(session: SessionTimes, now: number = Date.now()): boolean {
  return now - ms(session.createdAt) > ADMIN_SESSION_ABSOLUTE_SECONDS * 1000;
}

/** Only same-site relative paths survive as a return target (no `//host`, no scheme, no backslash). */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return fallback;
  if (raw.startsWith("/api/") || raw.startsWith("/logowanie") || raw.startsWith("/rejestracja")) return fallback;
  return raw.slice(0, 300);
}
