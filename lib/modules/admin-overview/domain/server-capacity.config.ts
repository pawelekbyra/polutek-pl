/**
 * Measured capacity of the server, for the "Zapas serwera" meter (System and Dzisiaj).
 * CHANGE THIS FILE WHEN THE SERVER CHANGES (bigger plan, guest-page cache, new image): run the load test
 * again (scripts/loadtest/, docs/operations/LOAD-TEST.md) and copy the new numbers here.
 *
 * "Visit" = what the server does for the first entry of a new guest: home page + video list + comments +
 * playback plan + one thumbnail. Video itself is served by Cloudflare (R2 + Worker), not by the server.
 */
export type ServerCapacity = {
  /** Plan name shown to the owner. */
  server: string;
  /** When and on which image it was measured. */
  measuredAt: string;
  image: string;
  /** Visits per second the server handles as if idle (p95 of the whole visit under this many ms). */
  comfortablePerSec: number;
  comfortableP95Ms: number;
  /** Visits per second where response times break down (queue grows, 10-18 s answers). */
  limitPerSec: number;
  /** Share of a day's page views that falls into its busiest hour (for the per-day conversion). */
  peakHourShare: number;
  /** Where the numbers come from. */
  source: string;
};

export const SERVER_CAPACITY: ServerCapacity = {
  server: "Hetzner CPX22 (2 vCPU, 4 GB RAM)",
  measuredAt: "2026-10-04",
  image: "polutek-app:m10040944",
  comfortablePerSec: 8,
  comfortableP95Ms: 250,
  // The test saw "on the edge" at 16 and breakdown above ~17: the middle is the limit.
  limitPerSec: 16.5,
  peakHourShare: 0.1,
  source: "docs/operations/LOAD-TEST.md",
};
