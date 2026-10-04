/**
 * What the panel process can read about the machine WITHOUT the Docker socket or any host mount:
 * inside a container `/proc/meminfo`, `os.loadavg()` and `statfs("/")` describe the host (memory and
 * load are not namespaced; the container root is an overlay on the host's root disk). Per-container
 * numbers need the host status file (see host-status-file.ts) or the phase-0 collector.
 */
import { readFile, statfs } from "node:fs/promises";
import os from "node:os";
import type { HostMetricsDto, ProcessMetricsDto } from "../domain/types";

export function parseMeminfo(text: string): { memTotal: number; memAvailable: number; swapTotal: number; swapFree: number } | null {
  const kb = (name: string) => {
    const m = text.match(new RegExp(`^${name}:\\s+(\\d+)\\s*kB`, "m"));
    return m ? Number(m[1]) * 1024 : null;
  };
  const memTotal = kb("MemTotal");
  const memAvailable = kb("MemAvailable");
  const swapTotal = kb("SwapTotal");
  const swapFree = kb("SwapFree");
  if (memTotal === null || memAvailable === null || swapTotal === null || swapFree === null) return null;
  return { memTotal, memAvailable, swapTotal, swapFree };
}

export async function readHostMetrics(now: Date = new Date()): Promise<HostMetricsDto> {
  const source = "/proc/meminfo, statfs(/), loadavg (widok z kontenera panelu)";
  try {
    const [meminfo, fsInfo] = await Promise.all([readFile("/proc/meminfo", "utf8"), statfs("/")]);
    const mem = parseMeminfo(meminfo);
    if (!mem) return { available: false, reason: "Nie da się odczytać /proc/meminfo.", source };
    const diskTotal = Number(fsInfo.blocks) * Number(fsInfo.bsize);
    const diskFree = Number(fsInfo.bavail) * Number(fsInfo.bsize);
    const [l1, l5, l15] = os.loadavg();
    return {
      available: true,
      measuredAt: now.toISOString(),
      source,
      cpuCount: os.cpus().length || 1,
      load: [l1, l5, l15],
      memTotalBytes: mem.memTotal,
      memAvailableBytes: mem.memAvailable,
      swapTotalBytes: mem.swapTotal,
      swapUsedBytes: Math.max(0, mem.swapTotal - mem.swapFree),
      diskTotalBytes: diskTotal,
      diskUsedBytes: Math.max(0, diskTotal - diskFree),
      uptimeSeconds: Math.round(os.uptime()),
    };
  } catch {
    // Windows/macOS dev machines have no /proc: say so instead of inventing numbers.
    return { available: false, reason: "Ten system nie udostępnia /proc (lokalny podgląd poza Linuksem).", source };
  }
}

async function cgroupMemoryLimit(): Promise<number | null> {
  try {
    const raw = (await readFile("/sys/fs/cgroup/memory.max", "utf8")).trim();
    return raw === "max" ? null : Number(raw);
  } catch {
    return null;
  }
}

export async function readProcessMetrics(): Promise<ProcessMetricsDto> {
  const mem = process.memoryUsage();
  return {
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    memoryLimitBytes: await cgroupMemoryLimit(),
  };
}
