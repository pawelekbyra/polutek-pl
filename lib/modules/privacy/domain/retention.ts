/**
 * How long IP addresses and browser data (user agent, and their hashes) stay in the database:
 * audit log, sign-in sessions, playback sessions and views. After that the fields are cleared by
 * /api/cron/retention; the rows themselves stay (view counts and statistics do not change).
 * Stated in the Privacy Policy § 4 (LegalDocs.tsx renders this constant). Dependency-free on purpose:
 * the legal documents import it on the client.
 */
export const TECHNICAL_DATA_RETENTION_DAYS = 90;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function technicalDataCutoff(now: Date): Date {
  return new Date(now.getTime() - TECHNICAL_DATA_RETENTION_DAYS * DAY_MS);
}
