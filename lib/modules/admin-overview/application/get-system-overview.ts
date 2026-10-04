import { fmtInt, fmtRelative } from "../domain/format";
import { COST_FACTS, DOMAIN_FACTS, FACTS_AS_OF, SCHEDULED_JOBS } from "../domain/facts";
import { summarizeHealth } from "../domain/rules";
import type { HealthSummary, JobDto, NavCounts, QueueDto, SystemOverview } from "../domain/types";
import type { HostStatusRead } from "../infrastructure/host-status-file";
import { buildHealthChecks, gatherHealthInputs, type HealthInputs } from "./collect-health";
import type { OverviewDeps } from "./deps";

/** Static job list (repo) merged with the last run reported by the host status file, when present. */
export function buildJobs(read: HostStatusRead): { measuredAt: string | null; source: string; items: JobDto[] } {
  const timers = read.ok ? read.status.timers ?? [] : [];
  const byName = new Map(timers.map((t) => [t.name.replace(/^polutek-cron-/, "").replace(/\.(timer|service)$/, ""), t]));
  return {
    measuredAt: read.ok ? read.status.generatedAt : null,
    source: read.ok ? "plik statusu hosta (systemd)" : "definicje w repo (deploy/serwerek/systemd); ostatnie uruchomienia: brak danych",
    items: SCHEDULED_JOBS.map((job) => {
      const t = byName.get(job.name);
      return {
        ...job,
        lastRun: t?.lastRunAt ? { at: t.lastRunAt, ok: !t.lastResult || t.lastResult === "success", detail: t.lastResult ?? null } : null,
        nextRun: t?.nextRunAt ?? null,
      };
    }),
  };
}

export function buildQueues(i: HealthInputs, moderation: { pendingReports: number; heldComments: number }): QueueDto[] {
  const queued = i.jobs.filter((j) => j.status === "QUEUED").length;
  const running = i.jobs.filter((j) => j.status === "RUNNING").length;
  return [
    {
      id: "encode",
      label: "Kodowanie wideo",
      kind: i.jobs.some((j) => j.status === "FAILED") ? "warn" : "ok",
      pending: queued + running,
      detail: running ? `${running} w toku, ${queued} czeka` : queued ? `${queued} czeka` : "pusta",
      link: { label: "Filmy", href: "/tresci?hls=FAILED", external: false },
    },
    {
      id: "broadcast",
      label: "Rozsyłki e-mail",
      kind: i.broadcasts.failed ? "warn" : "ok",
      pending: i.broadcasts.pendingRecipients,
      detail: i.broadcasts.sending ? `wysyłka w toku · ${fmtInt(i.broadcasts.pendingRecipients)} odbiorców w kolejce` : i.broadcasts.pendingRecipients ? `${fmtInt(i.broadcasts.pendingRecipients)} odbiorców czeka` : "pusta",
      link: { label: "Poczta", href: i.oldPanel("/admin/emails"), external: true },
    },
    {
      id: "moderation",
      label: "Moderacja komentarzy",
      kind: moderation.pendingReports + moderation.heldComments ? "warn" : "ok",
      pending: moderation.pendingReports + moderation.heldComments,
      detail: `${moderation.pendingReports} zgłoszeń, ${moderation.heldComments} wstrzymanych`,
      link: { label: "Zgłoszenia", href: "/spolecznosc?tab=zgloszenia", external: false },
    },
    {
      id: "payments",
      label: "Wpłaty do rekonsylacji",
      kind: i.payments.stalePending ? "warn" : "ok",
      pending: i.payments.stalePending,
      detail: i.payments.stalePending ? "PENDING starsze niż 25 h" : "brak zawieszonych",
    },
    {
      id: "stripe",
      label: "Zdarzenia Stripe",
      kind: i.stripe.failed ? "crit" : i.stripe.stuck ? "warn" : "ok",
      pending: i.stripe.stuck,
      detail: i.stripe.lastAt ? `ostatnie ${fmtRelative(i.stripe.lastAt, i.now)} · ${i.stripe.failed} nieudanych (7 dni)` : "brak zdarzeń",
    },
  ];
}

export async function getSystemOverview(deps: OverviewDeps): Promise<SystemOverview> {
  const [inputs, processMetrics, moderation] = await Promise.all([gatherHealthInputs(deps), deps.process(), deps.repo.moderation()]);
  const now = inputs.now;
  const health = summarizeHealth(buildHealthChecks(inputs), now);
  const read = inputs.hostStatus;
  return {
    generatedAt: now.toISOString(),
    health,
    host: inputs.host,
    process: processMetrics,
    containers: read.ok && read.status.containers
      ? { available: true, measuredAt: read.status.generatedAt, items: read.status.containers }
      : { available: false, reason: read.ok ? "Plik statusu nie zawiera listy kontenerów." : read.reason, source: "plik statusu hosta (host-status.sh)" },
    jobs: buildJobs(read),
    backups: read.ok && read.status.backups
      ? {
          available: true,
          measuredAt: read.status.generatedAt,
          latestAt: read.status.backups.latestAt,
          latestBytes: read.status.backups.latestBytes,
          count: read.status.backups.count,
          offsite: read.status.backups.offsite ?? "nie podano",
        }
      : { available: false, reason: read.ok ? "Plik statusu nie zawiera informacji o kopiach." : read.reason, source: "plik statusu hosta (host-status.sh)" },
    queues: buildQueues(inputs, moderation),
    database: inputs.database,
    domains: DOMAIN_FACTS,
    costs: COST_FACTS,
    factsAsOf: FACTS_AS_OF,
  };
}

/** Videos whose newest failed encode was not replaced by a later successful one. */
export function unresolvedFailedVideos(jobs: HealthInputs["jobs"], latestSuccess: Map<string, Date>): string[] {
  const out = new Set<string>();
  for (const j of jobs) {
    if (j.status !== "FAILED") continue;
    if ((latestSuccess.get(j.videoId)?.getTime() ?? 0) > (j.finishedAt ?? j.createdAt).getTime()) continue;
    out.add(j.videoId);
  }
  return [...out];
}

/**
 * What the shell shows on every page: navigation badges and the health dot. Reuses the health inputs
 * (probes are cached), so this costs a handful of small indexed queries.
 */
export async function getShellStatus(deps: OverviewDeps): Promise<{ nav: NavCounts; health: HealthSummary }> {
  const [inputs, moderation] = await Promise.all([gatherHealthInputs(deps), deps.repo.moderation()]);
  const latest = await deps.repo.latestSuccessByVideo([...new Set(inputs.jobs.filter((j) => j.status === "FAILED").map((j) => j.videoId))]);
  const health = summarizeHealth(buildHealthChecks(inputs), inputs.now);
  return {
    nav: {
      moderation: moderation.pendingReports + moderation.heldComments,
      contentErrors: unresolvedFailedVideos(inputs.jobs, latest).length,
      systemAlerts: health.counts.warn + health.counts.crit,
      systemKind: health.kind,
    },
    health,
  };
}
