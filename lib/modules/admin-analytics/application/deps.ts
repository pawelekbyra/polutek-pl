import type { AppContext } from "@/lib/modules/shared/app-context";
import { PrismaAppRepository } from "../infrastructure/app.repository";
import type { AppRepository, TelemetryRepository } from "../infrastructure/ports";
import { createSwrCache, type SwrCache } from "../infrastructure/swr-cache";
import { SqlTelemetryRepository, telemetrySql } from "../infrastructure/telemetry.repository";

export type HostLoad = { cpuLoadPct: number | null; memUsedPct: number | null; swapUsedPct: number | null };

/** Everything the analytics use cases read; injectable, so tests run without a database or a clock. */
export type AnalyticsDeps = {
  /** null = ADMIN_TELEMETRY_DATABASE_URL is not set here: every telemetry number is "bez pomiaru". */
  telemetry: TelemetryRepository | null;
  app: AppRepository;
  now: () => Date;
  host?: () => Promise<HostLoad | null>;
  cache?: SwrCache;
  config: {
    /** Own page views vs Cloudflare document requests: deviation (in %) still considered consistent. */
    edgeTolerancePct: number;
    /** Daily request limit of the HLS Worker on the Workers Free plan. */
    workerDailyLimit: number;
  };
};

type Env = Record<string, string | undefined>;

/** Shared across requests of the process: 30 s fresh, up to 5 min served stale while refreshing. */
const sharedCache = createSwrCache({ freshMs: 30_000, staleMs: 5 * 60_000, maxEntries: 64 });

export function createAnalyticsDeps(ctx: AppContext, env: Env = process.env, extra: { host?: AnalyticsDeps["host"] } = {}): AnalyticsDeps {
  const url = env.ADMIN_TELEMETRY_DATABASE_URL?.trim();
  const tolerance = Number(env.ADMIN_EDGE_TOLERANCE_PCT);
  return {
    telemetry: url ? new SqlTelemetryRepository(telemetrySql(url)) : null,
    app: new PrismaAppRepository(ctx.db.read),
    now: ctx.now,
    host: extra.host,
    cache: sharedCache,
    config: { edgeTolerancePct: Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 30, workerDailyLimit: 100_000 },
  };
}

export const TELEMETRY_OFF_REASON =
  "Telemetria nie jest podłączona do panelu (brak ADMIN_TELEMETRY_DATABASE_URL). Bez niej panel nie ma skąd wziąć liczb i niczego nie zgaduje.";
