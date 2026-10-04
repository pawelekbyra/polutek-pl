/** Constants of the analytics beacon. Dependency-free: the browser bundle imports this file. */
export const BEACON_VERSION = 1;
/** Hard cap of one beacon body (bytes). Bigger bodies are rejected without parsing. */
export const BEACON_MAX_BYTES = 16 * 1024;
export const BEACON_PATH = '/api/t';
export const WEB_VITAL_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;
/** 100 one-percent buckets, encoded MSB-first as 25 hex digits (bit 0 = first 1% of the video). */
export const WATCHED_BUCKETS = 100;
export const WATCHED_HEX_LENGTH = WATCHED_BUCKETS / 4;
