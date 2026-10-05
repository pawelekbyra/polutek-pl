import { fmtBytes, fmtInt, fmtPercent, fmtRelative } from "../domain/format";
import {
  ENCODE_QUEUE_STALL_MS,
  ENCODER_HEARTBEAT_STALE_MS,
  LIMITS,
  PAYMENT_PENDING_STALE_MS,
  STRIPE_EVENT_STUCK_MS,
  levelFor,
  summarizeHealth,
  worstKind,
} from "../domain/rules";
import type { HealthCheckDto, HealthSummary, HostMetricsDto, StateKind } from "../domain/types";
import type { HostStatusRead } from "../infrastructure/host-status-file";
import type { EncodeJobRow } from "../infrastructure/overview.repository";
import type { ProbeResult } from "../infrastructure/probes";
import type { LimitThresholds } from "../domain/alert-thresholds";
import type { OverviewDeps } from "./deps";

const DAY_MS = 86_400_000;

export type HealthInputs = {
  now: Date;
  database: Awaited<ReturnType<OverviewDeps["repo"]["database"]>>;
  host: HostMetricsDto;
  hostStatus: HostStatusRead;
  jobs: EncodeJobRow[];
  payments: { disputed: number; stalePending: number };
  stripe: { failed: number; stuck: number; lastAt: Date | null };
  broadcasts: { failed: number; sending: number; pendingRecipients: number };
  probes: { publicApp: ProbeResult | null; redis: ProbeResult | null; hlsWorker: ProbeResult | null };
  oldPanel: OverviewDeps["oldPanel"];
  /** Owner-set alert thresholds (Ustawienia); absent = the built-in LIMITS. */
  limits?: LimitThresholds;
};

function probeCheck(id: string, label: string, probe: ProbeResult | null, source: string, notConfigured: string): HealthCheckDto {
  if (!probe) return { id, label, kind: "info", detail: notConfigured, measuredAt: null, source, everyMin: 1 };
  return {
    id,
    label,
    kind: probe.ok ? "ok" : "crit",
    detail: probe.ok ? `${probe.detail}${probe.latencyMs !== null ? ` · ${fmtInt(probe.latencyMs)} ms` : ""}` : probe.detail,
    measuredAt: probe.measuredAt,
    source,
    everyMin: 1,
  };
}

export function encoderCheck(jobs: EncodeJobRow[], now: Date): HealthCheckDto {
  const base = { id: "encoder", label: "Encoder (kodowanie HLS)", measuredAt: now.toISOString(), source: "kolejka VideoEncodeJob (baza)", everyMin: 1 };
  const running = jobs.filter((j) => j.status === "RUNNING");
  const stuck = running.filter((j) => !j.heartbeatAt || now.getTime() - j.heartbeatAt.getTime() > ENCODER_HEARTBEAT_STALE_MS);
  if (stuck.length) {
    const hb = stuck[0].heartbeatAt;
    return { ...base, kind: "crit", detail: `zadanie „${stuck[0].video.title}” bez sygnału życia ${hb ? fmtRelative(hb, now).replace(" temu", "") : "od startu"}` };
  }
  if (running.length) {
    const j = running[0];
    return { ...base, kind: "ok", detail: `koduje „${j.video.title}”: ${j.progressPercent}% · sygnał ${j.heartbeatAt ? fmtRelative(j.heartbeatAt, now) : "—"}` };
  }
  const queued = jobs.filter((j) => j.status === "QUEUED");
  const stalled = queued.filter((j) => now.getTime() - j.createdAt.getTime() > ENCODE_QUEUE_STALL_MS);
  if (stalled.length) {
    return { ...base, kind: "warn", detail: `${stalled.length} w kolejce dłużej niż 10 min, nic nie koduje (czy kontener encoder działa?)` };
  }
  return { ...base, kind: "ok", detail: queued.length ? `${queued.length} w kolejce` : "bezczynny, kolejka pusta" };
}

function hostCheck(host: HostMetricsDto, limits: LimitThresholds = LIMITS): HealthCheckDto {
  const base = { id: "host", label: "Serwer: dysk, RAM, swap", everyMin: 1 };
  if (!host.available) return { ...base, kind: "info", detail: host.reason, measuredAt: null, source: host.source };
  const disk = (host.diskUsedBytes / host.diskTotalBytes) * 100;
  const mem = ((host.memTotalBytes - host.memAvailableBytes) / host.memTotalBytes) * 100;
  const swap = host.swapTotalBytes ? (host.swapUsedBytes / host.swapTotalBytes) * 100 : 0;
  const kind = worstKind([levelFor(disk, limits.disk), levelFor(mem, limits.memoryUsed), levelFor(swap, limits.swap)]);
  return {
    ...base,
    kind,
    detail: `dysk ${fmtPercent(disk)} · RAM ${fmtPercent(mem)} · swap ${fmtBytes(host.swapUsedBytes)} (${fmtPercent(swap)})`,
    measuredAt: host.measuredAt,
    source: host.source,
  };
}

function hostStatusChecks(read: HostStatusRead, now: Date): HealthCheckDto[] {
  const source = "plik statusu hosta (host-status.sh)";
  if (!read.ok) {
    return [
      { id: "containers", label: "Kontenery", kind: "info", detail: read.reason, measuredAt: null, source, everyMin: 1 },
      { id: "jobs", label: "Zadania okresowe i kopie", kind: "info", detail: read.reason, measuredAt: null, source, everyMin: 1 },
    ];
  }
  const s = read.status;
  const out: HealthCheckDto[] = [];
  const containers = s.containers ?? [];
  const bad = containers.filter((c) => c.state !== "running" || (c.health !== null && c.health !== "healthy"));
  out.push({
    id: "containers",
    label: "Kontenery",
    kind: containers.length === 0 ? "info" : bad.length ? "crit" : "ok",
    detail: containers.length === 0 ? "plik nie zawiera kontenerów" : bad.length ? `nie działa: ${bad.map((c) => c.name).join(", ")}` : `${containers.length} działa, wszystkie zdrowe`,
    measuredAt: s.generatedAt,
    source,
    everyMin: 1,
  });
  const timers = s.timers ?? [];
  const failedTimers = timers.filter((t) => t.lastResult && t.lastResult !== "success");
  const backupAt = s.backups?.latestAt ? new Date(s.backups.latestAt) : null;
  const backupOld = !backupAt || now.getTime() - backupAt.getTime() > 26 * 60 * 60_000;
  const kinds: StateKind[] = [failedTimers.length ? "warn" : "ok", s.backups ? (backupOld ? "crit" : "ok") : "info"];
  const parts = [
    timers.length ? (failedTimers.length ? `błąd: ${failedTimers.map((t) => t.name).join(", ")}` : `${timers.length} zadań bez błędu`) : "brak listy zadań",
    backupAt ? `kopia ${fmtRelative(backupAt, now)}` : "brak informacji o kopii",
  ];
  out.push({ id: "jobs", label: "Zadania okresowe i kopie", kind: worstKind(kinds), detail: parts.join(" · "), measuredAt: s.generatedAt, source, everyMin: 1 });
  return out;
}

export function buildHealthChecks(i: HealthInputs): HealthCheckDto[] {
  const now = i.now;
  const nowIso = now.toISOString();
  const db = i.database;
  const dbKind: StateKind =
    db.latencyMs === null ? "crit" : db.connections !== null && db.maxConnections ? (db.connections / db.maxConnections > 0.8 ? "warn" : "ok") : "ok";
  const checks: HealthCheckDto[] = [
    {
      id: "database",
      label: "Baza danych (Postgres)",
      kind: dbKind,
      detail:
        db.latencyMs === null
          ? "brak odpowiedzi"
          : `${fmtInt(db.latencyMs)} ms · połączenia ${db.connections ?? "?"}/${db.maxConnections ?? "?"} · ${fmtBytes(db.sizeBytes)}`,
      measuredAt: nowIso,
      source: "zapytanie z panelu",
      everyMin: 1,
    },
    probeCheck("www", "Strona publiczna (/api/health)", i.probes.publicApp, "sieć wewnętrzna Dockera", "nie skonfigurowano ADMIN_INTERNAL_APP_URL"),
    probeCheck("redis", "Redis (limity, kolejki)", i.probes.redis, "bramka REST Redisa", "nie skonfigurowano KV_REST_API_URL"),
    probeCheck("hls", "Worker HLS (video.pawelperfect.com)", i.probes.hlsWorker, "zapytanie HEAD do Workera", "nie skonfigurowano HLS_DELIVERY_BASE_URL"),
    encoderCheck(i.jobs, now),
    {
      id: "stripe",
      label: "Webhook Stripe",
      kind: i.stripe.failed ? "crit" : i.stripe.stuck ? "warn" : "ok",
      detail: i.stripe.failed
        ? `${i.stripe.failed} nieudanych zdarzeń w 7 dni`
        : i.stripe.stuck
          ? `${i.stripe.stuck} zdarzeń utknęło w przetwarzaniu`
          : i.stripe.lastAt
            ? `ostatnie zdarzenie ${fmtRelative(i.stripe.lastAt, now)} · 0 nieudanych`
            : "jeszcze żadnego zdarzenia",
      measuredAt: nowIso,
      source: "tabela StripeEvent",
      everyMin: 1,
      link: i.stripe.failed || i.stripe.stuck ? { label: "Wpłaty", href: i.oldPanel("/admin/users/payments"), external: true } : undefined,
    },
    {
      id: "reconciliation",
      label: "Rekonsylacja wpłat",
      kind: i.payments.stalePending ? "warn" : "ok",
      detail: i.payments.stalePending ? `${i.payments.stalePending} wpłat PENDING starszych niż 25 h (cron nie zamyka)` : "brak zawieszonych wpłat",
      measuredAt: nowIso,
      source: "tabela Payment",
      everyMin: 15,
    },
    {
      id: "broadcasts",
      label: "Kolejka rozsyłek",
      kind: i.broadcasts.failed ? "warn" : "ok",
      detail: i.broadcasts.failed
        ? `${i.broadcasts.failed} rozsyłek z błędami w 7 dni`
        : i.broadcasts.sending
          ? `wysyłka w toku · ${fmtInt(i.broadcasts.pendingRecipients)} w kolejce`
          : "pusta",
      measuredAt: nowIso,
      source: "tabele BroadcastEmail",
      everyMin: 1,
    },
    hostCheck(i.host, i.limits),
    ...hostStatusChecks(i.hostStatus, now),
  ];
  return checks;
}

/** Gathers everything the health centre needs in parallel. */
export async function gatherHealthInputs(deps: OverviewDeps): Promise<HealthInputs> {
  const now = deps.now();
  const [database, host, hostStatus, jobs, payments, stripe, broadcasts, publicApp, redis, hlsWorker, limits] = await Promise.all([
    deps.repo.database(),
    deps.host(),
    deps.hostStatus(),
    deps.repo.encodeJobs(new Date(now.getTime() - 14 * DAY_MS)),
    deps.repo.payments(now, new Date(now.getTime() - PAYMENT_PENDING_STALE_MS)),
    deps.repo.stripeEvents(new Date(now.getTime() - 7 * DAY_MS), new Date(now.getTime() - STRIPE_EVENT_STUCK_MS)),
    deps.repo.broadcasts(new Date(now.getTime() - 7 * DAY_MS), now),
    deps.probes.publicApp(),
    deps.probes.redis(),
    deps.probes.hlsWorker(),
    deps.limits ? deps.limits().catch(() => undefined) : undefined,
  ]);
  return { now, database, host, hostStatus, jobs, payments, stripe, broadcasts, probes: { publicApp, redis, hlsWorker }, oldPanel: deps.oldPanel, limits };
}

export function healthFrom(inputs: HealthInputs): HealthSummary {
  return summarizeHealth(buildHealthChecks(inputs), inputs.now);
}
