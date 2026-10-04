import { SERVER_CAPACITY, type ServerCapacity } from "../domain/server-capacity.config";
import { computeServerHeadroom, type ServerHeadroom } from "../domain/server-headroom";
import type { OverviewDeps } from "./deps";

/** "Zapas serwera" for System and Dzisiaj: telemetry peaks against the measured capacity. Never throws. */
export async function getServerHeadroom(deps: OverviewDeps, capacity: ServerCapacity = SERVER_CAPACITY): Promise<ServerHeadroom> {
  if (!deps.telemetry) return { state: "unconfigured", reason: "Odczyt telemetrii nie jest skonfigurowany (ADMIN_TELEMETRY_DATABASE_URL, rola pp_analytics_ro).", capacity };
  const read = await deps.telemetry().catch(() => ({ ok: false as const, reason: "Odczyt telemetrii nie powiódł się." }));
  if (read === null) return { state: "unconfigured", reason: "Odczyt telemetrii nie jest skonfigurowany (ADMIN_TELEMETRY_DATABASE_URL, rola pp_analytics_ro).", capacity };
  if (!read.ok) return { state: "error", reason: read.reason, capacity };
  return computeServerHeadroom(read.peaks, capacity, deps.now());
}
