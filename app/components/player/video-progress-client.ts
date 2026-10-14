import { decideProgressWrite, isResumablePosition } from "@/lib/video-progress-rules";

/**
 * Browser side of "resume watching": the guest's position in localStorage and the signed-in
 * viewer's report to POST /api/videos/[id]/progress. Storage is a convenience: every access is in
 * try/catch and the player works without it.
 */

const GUEST_STORAGE_KEY = "polutek:watch-progress";
/** Guests keep at most this many videos (newest first); the oldest are dropped. */
const GUEST_MAX_ENTRIES = 30;

type GuestEntry = { p: number; d: number | null; at: number };

export interface GuestProgress {
  positionSeconds: number;
  durationSeconds: number | null;
}

function readGuestMap(): Record<string, GuestEntry> {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, GuestEntry>;
  } catch {
    return {};
  }
}

function writeGuestMap(map: Record<string, GuestEntry>): void {
  try {
    const keys = Object.keys(map);
    if (keys.length > GUEST_MAX_ENTRIES) {
      keys
        .sort((a, b) => (map[b]?.at ?? 0) - (map[a]?.at ?? 0))
        .slice(GUEST_MAX_ENTRIES)
        .forEach((key) => delete map[key]);
    }
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Blocked or full storage: the guest simply does not get resume.
  }
}

/** The guest's saved position for a video, or null when none is worth resuming from. */
export function readGuestProgress(videoId: string): GuestProgress | null {
  const entry = readGuestMap()[videoId];
  if (!entry || typeof entry.p !== "number") return null;
  const duration = typeof entry.d === "number" ? entry.d : null;
  return isResumablePosition(entry.p, duration) ? { positionSeconds: entry.p, durationSeconds: duration } : null;
}

/** Same rules as the server: under 5 s nothing, past 95 % the entry is removed. */
export function writeGuestProgress(videoId: string, positionSeconds: number, durationSeconds: number | null): void {
  const decision = decideProgressWrite({ positionSeconds, durationSeconds });
  if (decision.action === "ignore") return;
  const map = readGuestMap();
  if (decision.action === "clear") {
    if (!(videoId in map)) return;
    delete map[videoId];
  } else {
    map[videoId] = { p: decision.positionSeconds, d: decision.durationSeconds, at: Date.now() };
  }
  writeGuestMap(map);
}

/**
 * Reports a position to the server. `beacon` is for the moment the tab goes away: sendBeacon (or a
 * keepalive fetch) outlives the page. Failures are silent, the next report replaces this one.
 */
export function sendProgressToServer(
  videoId: string,
  positionSeconds: number,
  durationSeconds: number | null,
  options: { beacon?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  const url = `/api/videos/${encodeURIComponent(videoId)}/progress`;
  const payload = JSON.stringify({
    positionSeconds: Math.floor(positionSeconds),
    durationSeconds: durationSeconds === null ? null : Math.floor(durationSeconds),
  });
  try {
    if (options.beacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }))) return;
    }
    if (typeof fetch === "function") {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        cache: "no-store",
        credentials: "same-origin",
      }).catch(() => undefined);
    }
  } catch {
    // Progress is best effort.
  }
}
