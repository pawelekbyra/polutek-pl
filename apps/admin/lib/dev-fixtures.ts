/**
 * Sample data for `next dev` WITHOUT a database (ADMIN_DEV_FIXTURES=1, never in production): layout work,
 * screenshots at 390/1280/1920 px. Deterministic (fixed seed) and relative to "now". The top bar marks
 * every screen built from it as "Dane przykładowe". Not used by tests (they build their own fakes).
 */
import type { HostMetricsDto, OverviewDeps, OverviewRepository, EncodeJobRow, ActivityRows } from "@/lib/modules/admin-overview";

const DAY = 86_400_000;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function spread(count: number, from: Date, to: Date, rand: () => number): Date[] {
  const span = to.getTime() - from.getTime();
  return Array.from({ length: count }, () => new Date(from.getTime() + rand() * span)).sort((a, b) => a.getTime() - b.getTime());
}

function fixtureRepo(now: Date): OverviewRepository {
  // Earlier periods get somewhat fewer events, so the deltas on the tiles show both directions.
  const past = (w: { to: Date }) => (now.getTime() - w.to.getTime() > 3600_000 ? 0.78 : 1);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const jobs: EncodeJobRow[] = [
    { id: "j1", videoId: "v-qa", status: "RUNNING", stage: "ENCODING", progressPercent: 62, attemptCount: 1, maxAttempts: 3, heartbeatAt: ago(20_000), failureCode: null, failureReason: null, createdAt: ago(9 * 60_000), finishedAt: null, video: { title: "Pytania od widzów #1" } },
    { id: "j2", videoId: "v-4k", status: "FAILED", stage: "ENCODING", progressPercent: 31, attemptCount: 2, maxAttempts: 3, heartbeatAt: ago(3 * 3600_000), failureCode: "FFMPEG_EXIT_137", failureReason: "ffmpeg zakończony kodem 137 (brak pamięci)", createdAt: ago(4 * 3600_000), finishedAt: ago(3 * 3600_000), video: { title: "Test kodowania 4K" } },
    { id: "j3", videoId: "v-jj", status: "SUCCEEDED", stage: "DONE", progressPercent: 100, attemptCount: 1, maxAttempts: 3, heartbeatAt: ago(7 * 3600_000), failureCode: null, failureReason: null, createdAt: ago(8 * 3600_000), finishedAt: ago(7 * 3600_000), video: { title: "JJ" } },
  ];
  const activity: ActivityRows = {
    payments: [
      { id: "p1", createdAt: ago(42 * 60_000), amountMinor: 2000, currency: "PLN", user: { name: "ola_k" } },
      { id: "p2", createdAt: ago(5 * 3600_000), amountMinor: 1000, currency: "EUR", user: { name: "Lena" } },
    ],
    users: [{ id: "u1", createdAt: ago(65 * 60_000), name: "Hubert", onboardingPending: false }],
    comments: [{ id: "c1", createdAt: ago(25 * 60_000), text: "Świetny montaż, szczególnie końcówka!", author: { name: "zuzia" }, video: { title: "Cześć" } }],
    audit: [{ id: "a1", createdAt: ago(26 * 3600_000), action: "VIDEO_PUBLISH_AFTER_ASSET_READY_COMPLETED", targetType: "Video", actorType: "admin" }],
    panel: [{ id: "e1", createdAt: ago(34 * 60_000), action: "ADMIN_SIGN_IN", outcome: "success", reason: "passkey", country: "PL" }],
  };
  return {
    async revenue(w) {
      const rand = rng(7 + Math.round(w.from.getTime() / DAY));
      const days = Math.max(1, (w.to.getTime() - w.from.getTime()) / DAY);
      return spread(Math.round(days * 2.4 * past(w)), w.from, w.to, rand).map((createdAt, i) => ({ createdAt, amountMinor: [500, 1000, 2000, 5000][i % 4], refundedAmountMinor: 0, currency: i % 9 === 0 ? "EUR" : "PLN" }));
    },
    async createdAt(model, w) {
      const perDay = { user: 3.1, comment: 7.4, report: 0.4, view: 38 }[model];
      const days = Math.max(1, (w.to.getTime() - w.from.getTime()) / DAY);
      return spread(Math.round(days * perDay * past(w)), w.from, w.to, rng(model.length * 31 + Math.round(w.from.getTime() / DAY)));
    },
    async moderation() {
      return { pendingReports: 3, oldestPendingReportAt: ago(2 * 3600_000), heldComments: 1 };
    },
    async encodeJobs() {
      return jobs;
    },
    async latestSuccessByVideo() {
      return new Map([["v-jj", ago(7 * 3600_000)]]);
    },
    async payments() {
      return { disputed: 1, stalePending: 0 };
    },
    async stripeEvents() {
      return { failed: 0, stuck: 0, lastAt: ago(44 * 60_000) };
    },
    async broadcasts() {
      return { failed: 0, sending: 0, pendingRecipients: 0, scheduled: [{ id: "b1", subjectPl: "Premiera „Kulisy” we wtorek", scheduledAt: new Date(now.getTime() + 27 * 3600_000), recipientCount: 31 }] };
    },
    async premieres() {
      return [{ id: "v-kul", title: "Kulisy premiery", slug: "kulisy", premiereAt: new Date(now.getTime() + 2 * DAY + 5 * 3600_000) }];
    },
    async activity() {
      return activity;
    },
    async database() {
      return { sizeBytes: 27_400_000, connections: 11, maxConnections: 60, latencyMs: 3, version: "17.6" };
    },
  };
}

export function devFixtureDeps(): OverviewDeps {
  const now = () => new Date();
  const host = async (): Promise<HostMetricsDto> => ({
    available: true,
    measuredAt: new Date().toISOString(),
    source: "dane przykładowe",
    cpuCount: 2,
    load: [0.42, 0.51, 0.47],
    memTotalBytes: 3809 * 1024 * 1024,
    memAvailableBytes: 1643 * 1024 * 1024,
    swapTotalBytes: 4096 * 1024 * 1024,
    swapUsedBytes: 1476 * 1024 * 1024,
    diskTotalBytes: 75 * 1024 ** 3,
    diskUsedBytes: 46 * 1024 ** 3,
    uptimeSeconds: 3 * 86_400 + 5 * 3600,
  });
  const t = new Date();
  return {
    repo: fixtureRepo(t),
    now,
    host,
    process: async () => ({ rssBytes: 148 * 1024 * 1024, heapUsedBytes: 61 * 1024 * 1024, uptimeSeconds: 5 * 3600, nodeVersion: "v22.20.0", memoryLimitBytes: 384 * 1024 * 1024 }),
    hostStatus: async () => ({ ok: false, reason: "Brak pliku statusu hosta (zadanie host-status nie jest włączone na serwerze)." }),
    probes: {
      publicApp: async () => ({ ok: true, latencyMs: 41, detail: "HTTP 200", measuredAt: new Date().toISOString() }),
      redis: async () => ({ ok: true, latencyMs: 2, detail: "PONG", measuredAt: new Date().toISOString() }),
      hlsWorker: async () => null,
    },
    oldPanel: (path) => `https://www.pawelperfect.com${path}`,
  };
}
