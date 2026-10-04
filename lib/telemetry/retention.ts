/**
 * How long the own, cookie-free statistics are kept (docs/architecture/admin-telemetry.md). Stated in
 * the Privacy Policy (LegalDocs.tsx renders these constants) and enforced by pp-collector, which passes
 * them to telemetry.apply_retention(). Dependency-free on purpose: the legal documents import it.
 */
export const TELEMETRY_RAW_RETENTION_DAYS = 90;
export const TELEMETRY_AGGREGATE_RETENTION_MONTHS = 25;
