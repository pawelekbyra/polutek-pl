import { describe, expect, it, vi } from "vitest";
import {
  buildActivity,
  buildJobs,
  buildTriage,
  cachedProbe,
  clearProbeCache,
  encoderCheck,
  getShellStatus,
  getSystemOverview,
  getTodayOverview,
  parseHostStatus,
  parseMeminfo,
  probeHlsWorker,
  probeRedis,
  type EncodeJobRow,
  type OverviewDeps,
  type OverviewRepository,
} from "@/lib/modules/admin-overview";

const NOW = new Date("2026-10-04T12:36:00Z"); // 14:36 Warsaw
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;

function job(p: Partial<EncodeJobRow>): EncodeJobRow {
  return {
    id: "j",
    videoId: "v1",
    status: "QUEUED",
    stage: "QUEUED",
    progressPercent: 0,
    attemptCount: 1,
    maxAttempts: 3,
    heartbeatAt: null,
    failureCode: null,
    failureReason: null,
    createdAt: ago(5 * MIN),
    finishedAt: null,
    video: { title: "Film" },
    ...p,
  };
}

function repo(over: Partial<OverviewRepository> = {}): OverviewRepository {
  return {
    revenue: async (w) =>
      w.from.getTime() >= ago(15 * 3600_000).getTime()
        ? [
            { createdAt: ago(60 * MIN), amountMinor: 2000, refundedAmountMinor: 0, currency: "PLN" },
            { createdAt: ago(30 * MIN), amountMinor: 1000, refundedAmountMinor: 500, currency: "PLN" },
            { createdAt: ago(20 * MIN), amountMinor: 1000, refundedAmountMinor: 0, currency: "JPY" },
          ]
        : [{ createdAt: w.from, amountMinor: 1000, refundedAmountMinor: 0, currency: "PLN" }],
    createdAt: async (model, w) => (model === "user" && w.to.getTime() === NOW.getTime() ? [ago(10 * MIN), ago(70 * MIN)] : []),
    moderation: async () => ({ pendingReports: 2, oldestPendingReportAt: ago(120 * MIN), heldComments: 1 }),
    encodeJobs: async () => [],
    latestSuccessByVideo: async () => new Map(),
    payments: async () => ({ disputed: 0, stalePending: 0 }),
    stripeEvents: async () => ({ failed: 0, stuck: 0, lastAt: ago(5 * MIN) }),
    broadcasts: async () => ({ failed: 0, sending: 0, pendingRecipients: 0, scheduled: [] }),
    premieres: async () => [{ id: "p", title: "Kulisy", slug: "kulisy", premiereAt: new Date(NOW.getTime() + 86_400_000) }],
    activity: async () => ({ payments: [], users: [], comments: [], audit: [], panel: [] }),
    database: async () => ({ sizeBytes: 1000, connections: 5, maxConnections: 60, latencyMs: 2, version: "17" }),
    ...over,
  };
}

function deps(r: OverviewRepository = repo()): OverviewDeps {
  return {
    repo: r,
    now: () => NOW,
    host: async () => ({ available: false, reason: "brak /proc", source: "test" }),
    process: async () => ({ rssBytes: 1, heapUsedBytes: 1, uptimeSeconds: 1, nodeVersion: "v22", memoryLimitBytes: null }),
    hostStatus: async () => ({ ok: false, reason: "brak pliku" }),
    probes: { publicApp: async () => null, redis: async () => null, hlsWorker: async () => null },
    oldPanel: (p) => `https://www.example.com${p}`,
  };
}

describe("getTodayOverview", () => {
  it("builds KPIs with one revenue definition and the week-ago comparison", async () => {
    const o = await getTodayOverview(deps(), { range: "today", compare: "prev" });
    const tips = o.kpis.find((k) => k.key === "tips")!;
    expect(tips.value).toBe(25); // 20 + (10 - 5); JPY has no rate and is left out
    expect(tips.previous).toBe(10);
    expect(tips.hint).toContain("Poza sumą");
    expect(o.kpis.find((k) => k.key === "tipsCount")!.value).toBe(3);
    expect(o.kpis.find((k) => k.key === "signups")).toMatchObject({ value: 2, previous: 0 });
    expect(o.chart.labels).toHaveLength(15);
    expect(o.chart.values.reduce((a, b) => a + b, 0)).toBe(25);
    expect(o.upcoming[0]).toMatchObject({ title: "Premiera „Kulisy”" });
    expect(o.compareLabel).toBe("vs ta sama pora tydzień temu");
  });

  it("asks for no comparison data when the owner turned the comparison off", async () => {
    const revenue = vi.fn(repo().revenue);
    const o = await getTodayOverview(deps(repo({ revenue })), { range: "7d", compare: "none" });
    expect(revenue).toHaveBeenCalledTimes(1);
    expect(o.kpis.every((k) => k.previous === null)).toBe(true);
    expect(o.chart.labels).toHaveLength(7);
  });

  it("shows host limits as unavailable instead of zero when /proc cannot be read", async () => {
    const o = await getTodayOverview(deps(), { range: "today", compare: "prev" });
    expect(o.limits).toEqual([expect.objectContaining({ percent: null, valueText: "brak danych" })]);
  });
});

describe("triage (Wymaga uwagi)", () => {
  const base = { now: NOW, moderation: { pendingReports: 0, oldestPendingReportAt: null, heldComments: 0 }, jobs: [] as EncodeJobRow[], latestSuccess: new Map<string, Date>(), payments: { disputed: 0, stalePending: 0 }, stripe: { failed: 0, stuck: 0 }, broadcasts: { failed: 0 }, oldPanel: (p: string) => p };

  it("is empty when nothing waits", () => {
    expect(buildTriage(base)).toEqual([]);
  });

  it("lists disputes first, then failed encodes, then moderation", () => {
    const items = buildTriage({
      ...base,
      payments: { disputed: 1, stalePending: 0 },
      jobs: [job({ id: "f", status: "FAILED", finishedAt: ago(60 * MIN), failureReason: "OOM" })],
      moderation: { pendingReports: 3, oldestPendingReportAt: ago(10 * MIN), heldComments: 0 },
    });
    expect(items.map((i) => i.id)).toEqual(["disputes", "encode-f", "moderation"]);
    expect(items[1]).toMatchObject({ kind: "crit", detail: expect.stringContaining("OOM") });
  });

  it("drops a failed encode once a later encode of the same video succeeded", () => {
    const items = buildTriage({ ...base, jobs: [job({ id: "f", status: "FAILED", finishedAt: ago(60 * MIN) })], latestSuccess: new Map([["v1", ago(5 * MIN)]]) });
    expect(items).toEqual([]);
  });
});

describe("encoder health", () => {
  it("is critical when a running job lost its heartbeat", () => {
    expect(encoderCheck([job({ status: "RUNNING", heartbeatAt: ago(5 * MIN) })], NOW).kind).toBe("crit");
  });
  it("warns when the queue waits and nothing runs", () => {
    expect(encoderCheck([job({ status: "QUEUED", createdAt: ago(15 * MIN) })], NOW).kind).toBe("warn");
  });
  it("is fine while encoding or idle", () => {
    expect(encoderCheck([job({ status: "RUNNING", heartbeatAt: ago(10_000), progressPercent: 40 })], NOW)).toMatchObject({ kind: "ok", detail: expect.stringContaining("40%") });
    expect(encoderCheck([], NOW)).toMatchObject({ kind: "ok", detail: "bezczynny, kolejka pusta" });
  });
});

describe("system overview and shell status", () => {
  it("counts warnings for the nav badge and keeps unmeasured checks as info", async () => {
    const d = deps(repo({ stripeEvents: async () => ({ failed: 2, stuck: 0, lastAt: ago(MIN) }) }));
    const { nav, health } = await getShellStatus(d);
    expect(health.kind).toBe("crit");
    expect(nav).toMatchObject({ moderation: 3, systemAlerts: 1, systemKind: "crit" });
    expect(health.checks.find((c) => c.id === "www")).toMatchObject({ kind: "info" });
  });

  it("reports missing host data explicitly", async () => {
    const s = await getSystemOverview(deps());
    expect(s.containers).toMatchObject({ available: false, reason: "brak pliku" });
    expect(s.backups).toMatchObject({ available: false });
    expect(s.jobs.items.length).toBeGreaterThanOrEqual(9);
    expect(s.jobs.items.every((j) => j.lastRun === null)).toBe(true);
  });
});

describe("host status file", () => {
  const valid = {
    version: 1,
    generatedAt: "2026-10-04T12:35:00Z",
    containers: [{ name: "polutek-app-1", state: "running", health: "healthy", memBytes: 100, memLimitBytes: 1000 }],
    timers: [{ name: "polutek-cron-stripe-reconciliation.timer", lastRunAt: "2026-10-04T12:30:00Z", lastResult: "exit-code", nextRunAt: "2026-10-04T12:45:00Z" }],
    backups: { latestAt: "2026-10-04T00:30:00Z", latestBytes: 48_000_000, count: 7, offsite: "R2" },
  };
  it("accepts the documented format and merges timer results into the job list", () => {
    const read = parseHostStatus(JSON.stringify(valid));
    expect(read.ok).toBe(true);
    const jobs = buildJobs(read);
    expect(jobs.items.find((j) => j.name === "stripe-reconciliation")?.lastRun).toEqual({ at: "2026-10-04T12:30:00Z", ok: false, detail: "exit-code" });
  });
  it("rejects malformed or unknown versions", () => {
    expect(parseHostStatus("{")).toMatchObject({ ok: false });
    expect(parseHostStatus(JSON.stringify({ ...valid, version: 2 }))).toMatchObject({ ok: false });
  });
  it("parses /proc/meminfo", () => {
    expect(parseMeminfo("MemTotal:  4000 kB\nMemAvailable: 1000 kB\nSwapTotal: 2000 kB\nSwapFree: 500 kB\n")).toEqual({ memTotal: 4096000, memAvailable: 1024000, swapTotal: 2048000, swapFree: 512000 });
    expect(parseMeminfo("garbage")).toBeNull();
  });
});

describe("activity feed", () => {
  it("merges sources newest first and translates panel events", () => {
    const items = buildActivity(
      {
        payments: [{ id: "p", createdAt: ago(30 * MIN), amountMinor: 2000, currency: "PLN", user: { name: "ola" } }],
        users: [{ id: "u", createdAt: ago(10 * MIN), name: null, onboardingPending: true }],
        comments: [],
        audit: [],
        panel: [{ id: "e", createdAt: ago(5 * MIN), action: "ADMIN_SIGN_IN", outcome: "failure", reason: "passkey_rejected", country: "PL" }],
      },
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(["e-e", "u-u", "p-p"]);
    expect(items[0]).toMatchObject({ title: "Logowanie do panelu: nieudane", kind: "warn" });
    expect(items[1].title).toBe("Nowe konto: bez pseudonimu (onboarding)");
  });
});

describe("probes", () => {
  it("serves the cached value while a refresh runs in the background", async () => {
    clearProbeCache();
    const run = vi.fn(async () => ({ ok: true, latencyMs: 1, detail: "x", measuredAt: "t" }));
    await cachedProbe("k", run, 0);
    await cachedProbe("k", run, 30_000);
    expect(run).toHaveBeenCalledTimes(1);
    const stale = await cachedProbe("k", run, Date.now() + 120_000);
    expect(stale.detail).toBe("x");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reads Redis PONG and treats a Worker 404 as alive", async () => {
    const pong = vi.fn(async () => new Response(JSON.stringify({ result: "PONG" }), { status: 200 }));
    expect(await probeRedis("http://srh", "t", pong as unknown as typeof fetch)).toMatchObject({ ok: true, detail: "PONG" });
    expect(pong).toHaveBeenCalledWith("http://srh/ping", expect.objectContaining({ headers: { authorization: "Bearer t" } }));
    const worker = async () => new Response(null, { status: 404 });
    expect(await probeHlsWorker("https://video.example.com", worker as unknown as typeof fetch)).toMatchObject({ ok: true });
    const down = async () => new Response(null, { status: 522 });
    expect(await probeHlsWorker("https://video.example.com", down as unknown as typeof fetch)).toMatchObject({ ok: false, detail: "HTTP 522" });
  });
});
