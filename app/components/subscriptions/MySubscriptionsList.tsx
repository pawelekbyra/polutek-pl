"use client";

import React, { useEffect, useState } from "react";
import { SHOW_SUBSCRIPTION_BELL } from "@/lib/ui-flags";
import Link from "next/link";
import { BellOff, BellRing } from "lucide-react";
import { SafeAvatar } from "@/app/components/SafeAvatar";
import { useLanguage } from "@/app/components/LanguageContext";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { countedNoun } from "@/lib/i18n/plurals";
import { intlLocale } from "@/lib/i18n/ui";
import { formatCount } from "@/lib/utils";
import { logger } from "@/lib/logger";

/** One subscription as the server page serializes it (dates are ISO strings). */
export interface MySubscriptionRow {
  creatorId: string;
  slug: string;
  handle: string | null;
  name: string;
  imageUrl: string | null;
  notify: boolean;
  videosCount: number;
  lastVideoAt: string | null;
  available: boolean;
}

type RowState = { notify: boolean; busy: boolean };

/**
 * "My subscriptions": the channels the viewer follows, with the bell and "unsubscribe" of each.
 * Both actions are the per-channel API of /api/subscriptions (PATCH, DELETE with `creatorId`).
 */
export default function MySubscriptionsList({ initialRows }: { initialRows: MySubscriptionRow[] }) {
  const { language, tx } = useLanguage();
  const [rows, setRows] = useState(initialRows);
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.creatorId, { notify: r.notify, busy: false }])),
  );
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const patchState = (creatorId: string, patch: Partial<RowState>) =>
    setState((prev) => ({ ...prev, [creatorId]: { ...prev[creatorId]!, ...patch } }));

  const toggleBell = async (row: MySubscriptionRow) => {
    const current = state[row.creatorId];
    if (!current || current.busy) return;
    const next = !current.notify;
    setError(null);
    patchState(row.creatorId, { notify: next, busy: true });
    try {
      const response = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: row.creatorId, notify: next }),
      });
      if (!response.ok) throw new Error(`Notify toggle failed: ${response.status}`);
      patchState(row.creatorId, { busy: false });
    } catch (err) {
      logger.warn("[MY_SUBSCRIPTIONS_NOTIFY_ERROR]", err);
      patchState(row.creatorId, { notify: !next, busy: false });
      setError(tx("Nie udało się zmienić powiadomień. Spróbuj ponownie.", "Could not change notifications. Please try again."));
    }
  };

  const unsubscribe = async (row: MySubscriptionRow) => {
    const current = state[row.creatorId];
    if (!current || current.busy) return;
    setError(null);
    patchState(row.creatorId, { busy: true });
    try {
      const response = await fetch("/api/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: row.creatorId }),
      });
      if (!response.ok) throw new Error(`Unsubscribe failed: ${response.status}`);
      setRows((prev) => prev.filter((r) => r.creatorId !== row.creatorId));
    } catch (err) {
      logger.warn("[MY_SUBSCRIPTIONS_UNSUBSCRIBE_ERROR]", err);
      patchState(row.creatorId, { busy: false });
      setError(tx("Nie udało się anulować subskrypcji. Spróbuj ponownie.", "Could not unsubscribe. Please try again."));
    }
  };

  if (rows.length === 0) {
    return (
      <p className="py-8 text-[15px] text-[var(--chan-muted)]">
        {tx("Nie subskrybujesz jeszcze żadnego kanału.", "You are not subscribed to any channel yet.")}
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      <ul className="divide-y divide-[var(--chan-line)] rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)]">
        {rows.map((row) => {
          const rowState = state[row.creatorId] ?? { notify: row.notify, busy: false };
          const bellLabel = rowState.notify
            ? tx("Powiadomienia: włączone", "Notifications: on")
            : tx("Powiadomienia: wyłączone", "Notifications: off");
          const href = getLocalizedHref(language, "channel", { slug: row.slug });
          const lastVideo =
            mounted && row.lastVideoAt
              ? new Date(row.lastVideoAt).toLocaleDateString(intlLocale(language), { dateStyle: "medium" })
              : null;
          return (
            <li key={row.creatorId} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
              <SafeAvatar src={row.imageUrl} alt={row.name} size={48} />
              <div className="min-w-0 flex-1">
                {row.available ? (
                  <Link href={href} prefetch={false} className="block truncate font-brand text-[16px] font-bold text-[var(--chan-ink)] hover:text-[var(--chan-blue)]">
                    {row.name}
                  </Link>
                ) : (
                  <span className="block truncate font-brand text-[16px] font-bold text-[var(--chan-muted)]">{row.name}</span>
                )}
                <p className="truncate text-[12.5px] text-[var(--chan-muted)] tabular-nums">
                  @{row.handle ?? row.slug} · {formatCount(row.videosCount)} {countedNoun(language, "videos", row.videosCount)}
                  {lastVideo ? ` · ${tx("ostatni film", "latest video")}: ${lastVideo}` : ""}
                  {!row.available ? ` · ${tx("kanał niedostępny", "channel unavailable")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {SHOW_SUBSCRIPTION_BELL && (
                <button
                  type="button"
                  onClick={() => void toggleBell(row)}
                  disabled={rowState.busy}
                  aria-pressed={rowState.notify}
                  aria-label={`${bellLabel}: ${row.name}`}
                  title={bellLabel}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--chan-line)] text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] disabled:cursor-wait disabled:opacity-50"
                >
                  {rowState.notify ? <BellRing size={16} strokeWidth={1.8} /> : <BellOff size={16} strokeWidth={1.8} />}
                </button>
                )}
                <button
                  type="button"
                  onClick={() => void unsubscribe(row)}
                  disabled={rowState.busy}
                  className="h-9 rounded-full border border-[var(--chan-line)] px-4 text-sm font-bold text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] disabled:cursor-wait disabled:opacity-50"
                >
                  {tx("Anuluj subskrypcję", "Unsubscribe")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
