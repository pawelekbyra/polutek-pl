/**
 * Poranny raport e-mailem: BUILT, DISABLED by default. It is sent only when ADMIN_MORNING_REPORT=on AND
 * ADMIN_MORNING_REPORT_TO is a valid address; every other state (including tests) returns "disabled" without
 * touching the mail transport. The mail transport is injected (a mock in tests); nothing here calls Resend itself.
 * Content: yesterday (Europe/Warsaw) against the day before and the same weekday a week earlier; every missing
 * measurement is written as "bez pomiaru", small samples carry a warning.
 */
import { fmtDateY, fmtInt, fmtOne, startOfWarsawDay, warsawDayKey } from "@/lib/modules/admin-overview";
import { histPercentile } from "../domain/histogram";
import { lowSampleText, summarizeQoe } from "../domain/qoe";
import type { AnalyticsDeps } from "./deps";
import { histOfRows, totalsOf } from "./playback-common";

export type MorningReport = { day: string; subject: string; html: string; text: string };
export type MorningMailer = (message: { to: string; subject: string; html: string; idempotencyKey: string }) => Promise<{ ok: boolean; error?: string }>;
export type MorningReportResult = { status: "disabled"; reason: string } | { status: "preview"; report: MorningReport } | { status: "sent"; report: MorningReport } | { status: "failed"; error: string };

type Env = Record<string, string | undefined>;

export function morningReportConfig(env: Env): { enabled: boolean; to: string | null; reason: string | null } {
  const on = env.ADMIN_MORNING_REPORT?.trim().toLowerCase() === "on";
  const to = env.ADMIN_MORNING_REPORT_TO?.trim() ?? "";
  const validTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) ? to : null;
  if (!on) return { enabled: false, to: validTo, reason: "Poranny raport jest wyłączony (ADMIN_MORNING_REPORT nie jest ustawione na on)." };
  if (!validTo) return { enabled: false, to: null, reason: "Brak poprawnego adresu odbiorcy (ADMIN_MORNING_REPORT_TO)." };
  return { enabled: true, to: validTo, reason: null };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const num = (v: number | null, f: (n: number) => string = fmtInt) => (v === null ? "bez pomiaru" : f(v));

function change(cur: number | null, base: number | null): string {
  if (cur === null || base === null) return "bez porównania";
  if (base === 0) return cur === 0 ? "bez zmian" : "było 0";
  const pct = Math.round((cur / base - 1) * 100);
  return pct === 0 ? "bez zmian" : `${pct > 0 ? "+" : ""}${pct}%`;
}

export async function buildMorningReport(deps: AnalyticsDeps): Promise<MorningReport> {
  const now = deps.now();
  const todayStart = startOfWarsawDay(now);
  const yStart = startOfWarsawDay(new Date(todayStart.getTime() - 12 * 3_600_000));
  const day = warsawDayKey(yStart);
  const dayBefore = warsawDayKey(new Date(yStart.getTime() - 12 * 3_600_000));
  const weekAgo = warsawDayKey(new Date(yStart.getTime() - 7 * 86_400_000 + 12 * 3_600_000));
  const t = deps.telemetry;

  const [traffic, playback, totals, deploys, accounts, tips] = await Promise.all([
    t ? t.trafficDaily(weekAgo, day).catch(() => null) : Promise.resolve(null),
    t ? t.playbackDaily(weekAgo, day).catch(() => null) : Promise.resolve(null),
    t ? t.videoTotals(day, day, 3).catch(() => null) : Promise.resolve(null),
    t ? t.deploys(yStart, todayStart, 10).catch(() => null) : Promise.resolve(null),
    deps.app.accountsCreatedAt(yStart, todayStart).catch(() => null),
    deps.app.paymentsCreatedAt(yStart, todayStart).catch(() => null),
  ]);
  const pick = <T extends { day: string }>(rows: T[] | null, d: string) => rows?.find((r) => r.day === d) ?? null;
  const y = pick(traffic, day);
  const yp = pick(playback, day);
  const visitors = y ? y.visitors : null;
  const pageviews = y ? y.pageviews : null;
  const views = yp ? yp.views : null;
  const qoe = yp ? summarizeQoe(totalsOf([yp])) : null;
  const p95 = yp && yp.startupN > 0 ? histPercentile(histOfRows([yp]), 0.95) : null;
  const infos = totals && totals.length ? await deps.app.videosByIds(totals.map((r) => r.videoId)).catch(() => []) : [];
  const titles = new Map(infos.map((i) => [i.id, i.title]));

  const lines: { label: string; value: string; detail?: string }[] = [
    { label: "Odwiedzający", value: num(visitors), detail: `vs poprzednia doba: ${change(visitors, pick(traffic, dayBefore)?.visitors ?? null)}, vs tydzień temu: ${change(visitors, pick(traffic, weekAgo)?.visitors ?? null)}` },
    { label: "Odsłony", value: num(pageviews), detail: `vs poprzednia doba: ${change(pageviews, pick(traffic, dayBefore)?.pageviews ?? null)}, vs tydzień temu: ${change(pageviews, pick(traffic, weekAgo)?.pageviews ?? null)}` },
    { label: "Obejrzenia", value: num(views), detail: `vs poprzednia doba: ${change(views, pick(playback, dayBefore)?.views ?? null)}, vs tydzień temu: ${change(views, pick(playback, weekAgo)?.views ?? null)}` },
    { label: "Czas startu p95", value: p95 === null ? "bez pomiaru" : `${fmtOne(p95 / 1000)} s`, detail: yp && yp.startupN < 30 ? lowSampleText(yp.startupN) : undefined },
    { label: "Błędy odtwarzania", value: qoe?.errorPct == null ? "bez pomiaru" : `${fmtOne(qoe.errorPct)}%`, detail: qoe && qoe.sample === "low" ? lowSampleText(qoe.attempts) : undefined },
    { label: "Nowe konta", value: accounts === null ? "bez pomiaru" : fmtInt(accounts.length) },
    { label: "Napiwki (liczba)", value: tips === null ? "bez pomiaru" : fmtInt(tips.length) },
    { label: "Wdrożenia", value: deploys === null ? "bez pomiaru" : fmtInt(deploys.length) },
  ];
  const top = (totals ?? []).map((r) => `${titles.get(r.videoId) ?? "film"}: ${fmtInt(r.started)} startów`);
  const subject = `Poranny raport: ${fmtDateY(yStart)}`;
  const text = [subject, "", ...lines.map((l) => `${l.label}: ${l.value}${l.detail ? ` (${l.detail})` : ""}`), ...(top.length ? ["", "Najczęściej oglądane:", ...top] : [])].join("\n");
  const html = `<h1>${esc(subject)}</h1><table role="presentation" cellpadding="6">${lines
    .map((l) => `<tr><th align="left">${esc(l.label)}</th><td><strong>${esc(l.value)}</strong>${l.detail ? `<br><small>${esc(l.detail)}</small>` : ""}</td></tr>`)
    .join("")}</table>${top.length ? `<h2>Najczęściej oglądane</h2><ul>${top.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<p><small>Telemetria anonimowa, bez ciasteczek. „bez pomiaru” znaczy, że danych nie ma, nie że było zero.</small></p>`;
  return { day, subject, html, text };
}

export async function runMorningReport(deps: AnalyticsDeps, opts: { env?: Env; mailer: MorningMailer; preview?: boolean }): Promise<MorningReportResult> {
  const cfg = morningReportConfig(opts.env ?? process.env);
  if (opts.preview) return { status: "preview", report: await buildMorningReport(deps) };
  if (!cfg.enabled || !cfg.to) return { status: "disabled", reason: cfg.reason ?? "Wyłączony." };
  const report = await buildMorningReport(deps);
  const res = await opts.mailer({ to: cfg.to, subject: report.subject, html: report.html, idempotencyKey: `morning-report-${report.day}` });
  return res.ok ? { status: "sent", report } : { status: "failed", error: res.error ?? "Nie udało się wysłać." };
}
