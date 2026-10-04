/**
 * Runtime switches of the analytics beacon (read on the server, no rebuild needed):
 * - TELEMETRY_COLLECTOR_URL: pp-collector inside the compose network, e.g. http://collector:3200.
 *   Unset = no beacon on the page and /api/t drops everything.
 * - TELEMETRY_BEACON=off: stops the beacon on the page while keeping the collector running
 *   (e.g. if the legal assessment changes; docs/architecture/admin-telemetry.md).
 */
type Env = Record<string, string | undefined>;

export function telemetryCollectorUrl(env: Env = process.env): string | null {
  const url = env.TELEMETRY_COLLECTOR_URL?.trim();
  return url ? url.replace(/\/+$/, '') : null;
}

export function isTelemetryBeaconEnabled(env: Env = process.env): boolean {
  if (env.TELEMETRY_BEACON?.trim().toLowerCase() === 'off') return false;
  return telemetryCollectorUrl(env) !== null;
}
