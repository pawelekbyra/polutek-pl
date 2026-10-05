import { fmtBytes, fmtDateTime, fmtInt, fmtMoney, fmtPercent, fmtRelative } from "../domain/format";
import { LIMITS, minorToPln, netMinor } from "../domain/rules";
import { bucketIndex, rangeWindows, type CompareKey, type RangeKey, type RangeWindows } from "../domain/time";
import type { ActivityItemDto, EncodeJobDto, HostMetricsDto, KpiDto, LimitDto, TodayOverview, TriageItemDto, UpcomingDto } from "../domain/types";
import type { ActivityRows, EncodeJobRow, RevenueRow } from "../infrastructure/overview.repository";
import { buildHealthChecks, gatherHealthInputs } from "./collect-health";
import { summarizeHealth } from "../domain/rules";
import type { OverviewDeps } from "./deps";

const DAY_MS = 86_400_000;

function bucketCounts(w: RangeWindows, dates: Date[]): number[] {
  const out = w.buckets.map(() => 0);
  for (const d of dates) {
    const i = bucketIndex(w, d);
    if (i >= 0) out[i] += 1;
  }
  return out;
}

function revenuePln(rows: RevenueRow[]): number {
  return rows.reduce((sum, r) => sum + (minorToPln(netMinor(r), r.currency) ?? 0), 0);
}

function bucketRevenue(w: RangeWindows, rows: RevenueRow[]): number[] {
  const out = w.buckets.map(() => 0);
  for (const r of rows) {
    const i = bucketIndex(w, r.createdAt);
    if (i >= 0) out[i] += minorToPln(netMinor(r), r.currency) ?? 0;
  }
  return out.map((v) => Math.round(v * 100) / 100);
}

/** Tips in currencies without a display rate are not converted; the tile hint lists them instead. */
function unconvertedNote(rows: RevenueRow[]): string | undefined {
  const odd = new Map<string, number>();
  for (const r of rows) if (minorToPln(1, r.currency) === null) odd.set(r.currency, (odd.get(r.currency) ?? 0) + netMinor(r));
  if (!odd.size) return undefined;
  return `Poza sumą (brak kursu): ${[...odd].map(([c, m]) => fmtMoney(m, c)).join(", ")}.`;
}

export function buildTriage(i: {
  now: Date;
  moderation: { pendingReports: number; oldestPendingReportAt: Date | null; heldComments: number };
  jobs: EncodeJobRow[];
  latestSuccess: Map<string, Date>;
  payments: { disputed: number; stalePending: number };
  stripe: { failed: number; stuck: number };
  broadcasts: { failed: number };
  oldPanel: OverviewDeps["oldPanel"];
}): TriageItemDto[] {
  const items: TriageItemDto[] = [];
  const { now } = i;
  if (i.payments.disputed) {
    items.push({
      id: "disputes",
      kind: "crit",
      icon: "coins",
      title: `${i.payments.disputed} ${i.payments.disputed === 1 ? "spór" : "spory"} o płatność`,
      detail: "bank kwestionuje wpłatę; termin na dowody jest w Stripe",
      link: { label: "Otwórz wpłaty", href: i.oldPanel("/admin/users/payments"), external: true },
    });
  }
  // A failed job counts until a later successful encode of the same video replaced it.
  const failed = i.jobs.filter((j) => j.status === "FAILED" && !((i.latestSuccess.get(j.videoId)?.getTime() ?? 0) > (j.finishedAt ?? j.createdAt).getTime()));
  const seen = new Set<string>();
  for (const j of failed) {
    if (seen.has(j.videoId)) continue;
    seen.add(j.videoId);
    items.push({
      id: `encode-${j.id}`,
      kind: "crit",
      icon: "film",
      title: `Kodowanie „${j.video.title}” nieudane`,
      detail: `${j.failureReason || j.failureCode || "bez opisu błędu"} · ${j.attemptCount} z ${j.maxAttempts} prób · ${fmtRelative(j.finishedAt ?? j.createdAt, now)}`,
      link: { label: "Szczegóły filmu", href: `/tresci/${encodeURIComponent(j.videoId)}`, external: false },
    });
  }
  if (i.stripe.failed || i.stripe.stuck) {
    items.push({
      id: "stripe",
      kind: i.stripe.failed ? "crit" : "warn",
      icon: "zap",
      title: i.stripe.failed ? `${i.stripe.failed} nieudanych webhooków Stripe (7 dni)` : `${i.stripe.stuck} webhooków Stripe utknęło`,
      detail: "wpłata mogła nie zostać zaksięgowana; rekonsylacja co 15 min to dopina",
    });
  }
  const toModerate = i.moderation.pendingReports + i.moderation.heldComments;
  if (toModerate) {
    const parts = [];
    if (i.moderation.pendingReports) parts.push(`${i.moderation.pendingReports} ${i.moderation.pendingReports === 1 ? "zgłoszenie" : "zgłoszenia"}`);
    if (i.moderation.heldComments) parts.push(`${i.moderation.heldComments} wstrzymanych`);
    items.push({
      id: "moderation",
      kind: "warn",
      icon: "flag",
      title: `Komentarze do moderacji: ${parts.join(", ")}`,
      detail: i.moderation.oldestPendingReportAt ? `najstarsze zgłoszenie ${fmtRelative(i.moderation.oldestPendingReportAt, now)}` : "wstrzymane czekają na decyzję",
      link: { label: "Moderuj", href: "/spolecznosc", external: false },
    });
  }
  if (i.payments.stalePending) {
    items.push({
      id: "pending",
      kind: "warn",
      icon: "clock",
      title: `${i.payments.stalePending} wpłat PENDING starszych niż 25 h`,
      detail: "rekonsylacja powinna je zamknąć po 24 h; sprawdź zadanie stripe-reconciliation",
    });
  }
  if (i.broadcasts.failed) {
    items.push({
      id: "broadcasts",
      kind: "warn",
      icon: "mail",
      title: `${i.broadcasts.failed} rozsyłek z błędami (7 dni)`,
      detail: "część odbiorców nie dostała wiadomości",
      link: { label: "Poczta", href: i.oldPanel("/admin/emails"), external: true },
    });
  }
  return items;
}

const PANEL_ACTION: Record<string, string> = {
  ADMIN_SIGN_IN: "Logowanie do panelu",
  ADMIN_STEP_UP: "Potwierdzenie tożsamości",
  ADMIN_SIGN_OUT: "Wylogowanie z panelu",
  ADMIN_ENROLLED: "Rejestracja administratora ukończona",
  ADMIN_ENROLL_ISSUED: "Wydano link rejestracji (serwer)",
  ADMIN_ENROLL_RESET: "Reset dostępu do panelu (serwer)",
  ADMIN_ENROLL_REDEEMED: "Otwarto link rejestracji",
  ADMIN_SESSION_EXPIRED: "Sesja panelu wygasła (12 h)",
  ADMIN_PASSKEY_ADDED: "Dodano klucz dostępu",
  ADMIN_TOTP_ENABLED: "Włączono TOTP",
};

export function buildActivity(rows: ActivityRows, now: Date, take = 10): ActivityItemDto[] {
  const items: ActivityItemDto[] = [];
  for (const p of rows.payments) items.push({ id: `p-${p.id}`, at: p.createdAt.toISOString(), icon: "coins", kind: "ok", title: `Napiwek ${fmtMoney(p.amountMinor, p.currency)}`, detail: p.user?.name ? `od ${p.user.name}` : "od usuniętego konta" });
  for (const u of rows.users) items.push({ id: `u-${u.id}`, at: u.createdAt.toISOString(), icon: "user-plus", kind: "", title: `Nowe konto: ${u.onboardingPending || !u.name ? "bez pseudonimu (onboarding)" : u.name}`, detail: "rejestracja" });
  for (const c of rows.comments) {
    const text = c.text.replace(/\s+/g, " ").trim();
    items.push({ id: `c-${c.id}`, at: c.createdAt.toISOString(), icon: "message", kind: "", title: `Komentarz${c.video ? ` pod „${c.video.title}”` : ""}`, detail: `${c.author?.name ?? "usunięte konto"}: „${text.length > 80 ? `${text.slice(0, 79)}…` : text}”` });
  }
  for (const a of rows.audit) items.push({ id: `a-${a.id}`, at: a.createdAt.toISOString(), icon: "note", kind: "", title: "Akcja administratora", detail: `${a.action}${a.targetType ? ` · obiekt: ${a.targetType}` : ""}` });
  for (const e of rows.panel) {
    items.push({
      id: `e-${e.id}`,
      at: e.createdAt.toISOString(),
      icon: "key",
      kind: e.outcome === "failure" ? "warn" : "",
      title: `${PANEL_ACTION[e.action] ?? e.action}${e.outcome === "failure" ? ": nieudane" : ""}`,
      detail: [e.reason, e.country].filter(Boolean).join(" · ") || "panel",
    });
  }
  return items
    .filter((x) => new Date(x.at).getTime() <= now.getTime())
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, take);
}

export function toEncodeJobDto(j: EncodeJobRow): EncodeJobDto {
  return {
    id: j.id,
    videoTitle: j.video.title,
    status: j.status,
    stage: j.stage,
    progress: j.progressPercent,
    attempt: j.attemptCount,
    maxAttempts: j.maxAttempts,
    heartbeatAt: j.heartbeatAt?.toISOString() ?? null,
    failure: j.failureReason || j.failureCode,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null,
  };
}

export function hostLimits(host: HostMetricsDto): LimitDto[] {
  if (!host.available) {
    return [{ id: "host", label: "Serwer", percent: null, valueText: "brak danych", warnAt: 80, critAt: 90, note: host.reason, measuredAt: null, source: host.source }];
  }
  const disk = (host.diskUsedBytes / host.diskTotalBytes) * 100;
  const mem = ((host.memTotalBytes - host.memAvailableBytes) / host.memTotalBytes) * 100;
  const swap = host.swapTotalBytes ? (host.swapUsedBytes / host.swapTotalBytes) * 100 : 0;
  const common = { measuredAt: host.measuredAt, source: host.source };
  return [
    { id: "disk", label: "Dysk", percent: disk, valueText: `${fmtBytes(host.diskUsedBytes)} / ${fmtBytes(host.diskTotalBytes)} · ${fmtPercent(disk)}`, ...LIMITS.disk, note: `wolne ${fmtBytes(host.diskTotalBytes - host.diskUsedBytes)}`, ...common },
    { id: "memory", label: "RAM", percent: mem, valueText: `${fmtBytes(host.memTotalBytes - host.memAvailableBytes)} / ${fmtBytes(host.memTotalBytes)}`, ...LIMITS.memoryUsed, note: `dostępne ${fmtBytes(host.memAvailableBytes)}`, ...common },
    { id: "swap", label: "Swap", percent: swap, valueText: `${fmtBytes(host.swapUsedBytes)} / ${fmtBytes(host.swapTotalBytes)} · ${fmtPercent(swap)}`, ...LIMITS.swap, note: swap >= LIMITS.swap.warnAt ? `powyżej progu ${LIMITS.swap.warnAt}%` : `próg ostrzeżenia ${LIMITS.swap.warnAt}%`, ...common },
  ];
}

export async function getTodayOverview(deps: OverviewDeps, opts: { range: RangeKey; compare: CompareKey }): Promise<TodayOverview> {
  const now = deps.now();
  const w = rangeWindows(opts.range, now);
  const withPrev = opts.compare === "prev";
  const repo = deps.repo;
  const empty = Promise.resolve(null);

  const [healthInputs, moderation, activityRows, premieres, revCur, revPrev, users, usersPrev, comments, commentsPrev, views, viewsPrev, reports, reportsPrev, broadcasts] =
    await Promise.all([
      gatherHealthInputs(deps),
      repo.moderation(),
      repo.activity(8),
      repo.premieres(now),
      repo.revenue(w.current),
      withPrev ? repo.revenue(w.previous) : empty,
      repo.createdAt("user", w.current),
      withPrev ? repo.createdAt("user", w.previous) : empty,
      repo.createdAt("comment", w.current),
      withPrev ? repo.createdAt("comment", w.previous) : empty,
      repo.createdAt("view", w.current),
      withPrev ? repo.createdAt("view", w.previous) : empty,
      repo.createdAt("report", w.current),
      withPrev ? repo.createdAt("report", w.previous) : empty,
      repo.broadcasts(new Date(now.getTime() - 7 * DAY_MS), now),
    ]);

  const latestSuccess = await repo.latestSuccessByVideo([...new Set(healthInputs.jobs.filter((j) => j.status === "FAILED").map((j) => j.videoId))]);
  const revenueSeries = bucketRevenue(w, revCur);
  const kpis: KpiDto[] = [
    { key: "tips", label: "Napiwki", value: Math.round(revenuePln(revCur)), previous: revPrev ? Math.round(revenuePln(revPrev)) : null, unit: "zł", upIsGood: true, spark: revenueSeries, format: "pln", hint: ["Netto po zwrotach, w PLN po kursie orientacyjnym (statusy SUCCEEDED i PARTIALLY_REFUNDED).", unconvertedNote(revCur)].filter(Boolean).join(" ") },
    { key: "tipsCount", label: "Wpłaty", value: revCur.length, previous: revPrev ? revPrev.length : null, upIsGood: true, spark: bucketCounts(w, revCur.map((r) => r.createdAt)), format: "int" },
    { key: "signups", label: "Nowe konta", value: users.length, previous: usersPrev ? usersPrev.length : null, upIsGood: true, spark: bucketCounts(w, users), format: "int" },
    { key: "comments", label: "Komentarze", value: comments.length, previous: commentsPrev ? commentsPrev.length : null, upIsGood: true, spark: bucketCounts(w, comments), format: "int" },
    { key: "views", label: "Obejrzenia", value: views.length, previous: viewsPrev ? viewsPrev.length : null, upIsGood: true, spark: bucketCounts(w, views), format: "int", hint: "Sesje odtwarzania zaliczone jako obejrzenie (ta sama reguła co licznik na stronie), bez podglądu admina." },
    { key: "reports", label: "Zgłoszenia", value: reports.length, previous: reportsPrev ? reportsPrev.length : null, upIsGood: false, spark: bucketCounts(w, reports), format: "int" },
  ];

  const upcoming: UpcomingDto[] = [
    ...premieres.map((p) => ({ id: `prem-${p.id}`, at: p.premiereAt.toISOString(), icon: "calendar" as const, kind: "info" as const, title: `Premiera „${p.title}”`, detail: `${fmtDateTime(p.premiereAt, now)} · ${fmtRelative(p.premiereAt, now)}` })),
    ...broadcasts.scheduled.map((b) => ({ id: `bc-${b.id}`, at: b.scheduledAt.toISOString(), icon: "mail" as const, kind: "" as const, title: `Rozsyłka „${b.subjectPl}”`, detail: `${fmtDateTime(b.scheduledAt, now)} · ${fmtInt(b.recipientCount)} odbiorców` })),
  ].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  const health = summarizeHealth(buildHealthChecks(healthInputs), now);
  const encodeQueue = healthInputs.jobs
    .filter((j) => j.status === "QUEUED" || j.status === "RUNNING" || (j.finishedAt && now.getTime() - j.finishedAt.getTime() < DAY_MS))
    .slice(0, 6)
    .map(toEncodeJobDto);

  return {
    generatedAt: now.toISOString(),
    range: opts.range,
    compare: opts.compare,
    rangeLabel: w.label,
    compareLabel: withPrev ? w.compareLabel : "bez porównania",
    kpis,
    chart: { title: "Napiwki", unit: "zł", labels: w.buckets.map((b) => b.label), values: revenueSeries, total: Math.round(revenuePln(revCur)) },
    triage: buildTriage({ now, moderation, jobs: healthInputs.jobs, latestSuccess, payments: healthInputs.payments, stripe: healthInputs.stripe, broadcasts: healthInputs.broadcasts, oldPanel: deps.oldPanel }),
    activity: buildActivity(activityRows, now),
    encodeQueue,
    upcoming,
    limits: hostLimits(healthInputs.host),
    health,
  };
}

