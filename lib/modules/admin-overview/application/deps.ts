import type { AppContext } from "@/lib/modules/shared/app-context";
import type { HostMetricsDto, ProcessMetricsDto } from "../domain/types";
import { readHostMetrics, readProcessMetrics } from "../infrastructure/host-metrics";
import { readHostStatus, type HostStatusRead } from "../infrastructure/host-status-file";
import { cachedProbe, probeHlsWorker, probePublicApp, probeRedis, type ProbeResult } from "../infrastructure/probes";
import { PrismaOverviewRepository, type OverviewRepository } from "../infrastructure/overview.repository";

/** Everything the overview use cases read, injectable so tests run without a database or network. */
export type OverviewDeps = {
  repo: OverviewRepository;
  now: () => Date;
  host: () => Promise<HostMetricsDto>;
  process: () => Promise<ProcessMetricsDto>;
  hostStatus: () => Promise<HostStatusRead>;
  /** null = the probe is not configured in this environment (shown as "not measured", not as an error). */
  probes: {
    publicApp: () => Promise<ProbeResult | null>;
    redis: () => Promise<ProbeResult | null>;
    hlsWorker: () => Promise<ProbeResult | null>;
  };
  /** Absolute link into the old /admin on www (phase 1 shows; actions move in phase 4). */
  oldPanel: (path: string) => string;
};

type Env = Record<string, string | undefined>;

export function createOverviewDeps(ctx: AppContext, env: Env = process.env): OverviewDeps {
  const publicBase = (env.NEXT_PUBLIC_APP_URL || "https://www.pawelperfect.com").replace(/\/+$/, "");
  const internalApp = env.ADMIN_INTERNAL_APP_URL?.trim();
  const kvUrl = env.KV_REST_API_URL?.trim() || env.UPSTASH_REDIS_REST_URL?.trim();
  const kvToken = env.KV_REST_API_TOKEN?.trim() || env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const hlsBase = env.HLS_DELIVERY_BASE_URL?.trim();
  return {
    repo: new PrismaOverviewRepository(ctx.prisma),
    now: ctx.now,
    host: () => readHostMetrics(ctx.now()),
    process: () => readProcessMetrics(),
    hostStatus: () => readHostStatus(),
    probes: {
      publicApp: async () => (internalApp ? cachedProbe("app", () => probePublicApp(internalApp)) : null),
      redis: async () => (kvUrl && kvToken ? cachedProbe("redis", () => probeRedis(kvUrl, kvToken)) : null),
      hlsWorker: async () => (hlsBase ? cachedProbe("hls", () => probeHlsWorker(hlsBase)) : null),
    },
    oldPanel: (path: string) => `${publicBase}${path.startsWith("/") ? path : `/${path}`}`,
  };
}
