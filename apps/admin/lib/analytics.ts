import { createAnalyticsDeps, type AnalyticsDeps, type HostLoad } from "@/lib/modules/admin-analytics";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { overviewDeps } from "./overview";

/** Host load for the live mode, from the same measurements as the System screen (null = not measured). */
async function hostLoad(): Promise<HostLoad | null> {
  const host = await overviewDeps().host();
  if (!host.available) return null;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);
  return {
    cpuLoadPct: host.cpuCount > 0 ? Math.round((100 * host.load[0]) / host.cpuCount) : null,
    memUsedPct: pct(host.memTotalBytes - host.memAvailableBytes, host.memTotalBytes),
    swapUsedPct: pct(host.swapUsedBytes, host.swapTotalBytes),
  };
}

/** Data source of the analytics screens: telemetry over the read-only role, the site's database read only. */
export function analyticsDeps(): AnalyticsDeps {
  return createAnalyticsDeps(createAppContext({ type: "system", reason: "admin_panel_read" }), process.env, { host: hostLoad });
}
