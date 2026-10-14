"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { formatDataTime } from "./analytics-format";

/** Small shared pieces of the analytics screens. */

export function MetricCard({ label, value, definition, note }: { label: string; value: ReactNode; definition: string; note?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--chan-line)] bg-[var(--chan-surface)] p-3">
      <p className="text-[12px] font-semibold text-[var(--chan-muted)]" title={definition}>
        {label}
      </p>
      <p className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-[var(--chan-ink)]">{value}</p>
      {note && <p className="mt-1 text-[12px] text-[var(--chan-muted)]">{note}</p>}
      <p className="mt-2 text-[11px] leading-snug text-[var(--chan-muted)]">{definition}</p>
    </div>
  );
}

/** Shown instead of a number or a curve whose sample is too small to mean anything. */
export function NotEnoughData({ minSample }: { minSample: number }) {
  const { tx } = useLanguage();
  return (
    <span title={tx("Za mało wyświetleń, by pokazać wiarygodną wartość (minimum: {0}).", "Too few views to show a reliable value (minimum: {0}).", minSample)}>
      {tx("za mało danych", "not enough data")}
    </span>
  );
}

/** "Data as of 14.10.2026, 15:30 UTC" plus the day of the newest subscriber snapshot. */
export function FreshnessLabel({ generatedAt, subscribersSnapshotDay }: { generatedAt: string; subscribersSnapshotDay?: string | null }) {
  const { tx, language } = useLanguage();
  const { date, time } = formatDataTime(generatedAt, language);
  return (
    <p className="text-[12px] text-[var(--chan-muted)]">
      {tx("Dane z dnia {0}, godz. {1} UTC.", "Data as of {0}, {1} UTC.", date, time)}{" "}
      {subscribersSnapshotDay !== undefined &&
        (subscribersSnapshotDay
          ? tx("Subskrybenci: ostatni zapis dzienny z {0}.", "Subscribers: latest daily record from {0}.", subscribersSnapshotDay)
          : tx("Subskrybenci: brak jeszcze zapisów dziennych.", "Subscribers: no daily records yet."))}
    </p>
  );
}
