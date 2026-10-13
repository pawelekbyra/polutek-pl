"use client";

import type { ReactNode } from "react";

/** Small presentational pieces shared by the Studio sections (tokens `--chan-*`, same look as the site). */

export const inputClass =
  "w-full rounded-xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-3 py-2 text-[14px] text-[var(--chan-ink)] outline-none focus:border-[var(--chan-ink)] disabled:opacity-60";

export const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--chan-ink)] px-4 py-2 text-[14px] font-semibold text-[var(--chan-card)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-4 py-2 text-[14px] font-semibold text-[var(--chan-ink)] transition hover:bg-[var(--chan-surface)] disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-red-300 bg-[var(--chan-card)] px-4 py-2 text-[14px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-4 sm:p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-[16px] font-bold text-[var(--chan-ink)]">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-[var(--chan-ink)]">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-[var(--chan-muted)]">{hint}</p>}
    </div>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: ReactNode }) {
  const tone =
    kind === "error"
      ? "border-red-300 bg-red-50 text-red-800"
      : kind === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-[var(--chan-line)] bg-[var(--chan-surface)] text-[var(--chan-ink)]";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-[13px] ${tone}`}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : "bg-[var(--chan-surface)] text-[var(--chan-muted)]";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--chan-surface)]"
    >
      <div className="h-full rounded-full bg-[var(--chan-ink)] transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
