/**
 * TEMPORARY (2026-09-22) — see the "TEMPORARY CHANGES REGISTRY" section of
 * CLAUDE.md. This is a pure display-layer "coming soon" placeholder for the
 * whole PATRON tier (owner request: replace the "Strefa Fenkjuu" label with a
 * premiere countdown while the next video isn't ready yet). It does NOT touch
 * checkVideoAccess()/PatronGrant — real access for signed-in users is
 * unchanged; this only decides what the UI shows for PATRON-tier videos.
 *
 * To revert: flip TEMP_PATRON_COMING_SOON to false (or delete the flag and
 * every branch that reads it in AccessLockOverlay.tsx, PremiumWrapper.tsx and
 * SidebarPlaylist.tsx).
 */
export const TEMP_PATRON_COMING_SOON = true;

/**
 * Placeholder target for the countdown shown while the flag above is on.
 * This is not a real per-video premiere date (no such field exists yet) —
 * update this constant whenever the actual premiere date changes.
 */
export const PATRON_COMING_SOON_TARGET = new Date("2026-09-26T07:00:00.000Z");

export function formatPremiereCountdown(
  isPl: boolean,
  target: Date = PATRON_COMING_SOON_TARGET,
  now: Date = new Date(),
): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return isPl
    ? `PREMIERA ZA ${days}D ${hours}H ${minutes}M ${seconds}S`
    : `PREMIERES IN ${days}D ${hours}H ${minutes}M ${seconds}S`;
}
