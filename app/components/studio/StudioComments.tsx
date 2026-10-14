"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { StudioApiError, jsonBody, studioApi, type StudioComment, type StudioCommentList } from "./studio-client";
import { Badge, Card, Notice, inputClass, smallButtonClass, smallDangerGhostButtonClass, smallGhostButtonClass } from "./ui";

type Filter = "all" | "held" | "reported";

/** Studio -> Comments: comments under the channel's videos, the review queue and the moderation actions. */
export default function StudioComments() {
  const { tx } = useLanguage();
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<StudioCommentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter === "held") params.set("status", "HELD_FOR_REVIEW");
    if (filter === "reported") params.set("reported", "1");
    try {
      setData(await studioApi<StudioCommentList>(`/api/studio/comments?${params.toString()}`));
      setError(null);
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : tx("Nie udało się wczytać komentarzy.", "Could not load comments."));
    }
  }, [filter, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await studioApi(`/api/studio/comments/${encodeURIComponent(id)}`, { method: "POST", ...jsonBody(body) });
      setReplying(null);
      setReplyText("");
      await load();
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : tx("Nie udało się wykonać akcji.", "Could not complete the action."));
    } finally {
      setBusyId(null);
    }
  };

  const statusLabel: Record<StudioComment["status"], string> = {
    VISIBLE: tx("Widoczny", "Visible"),
    HELD_FOR_REVIEW: tx("Do przeglądu", "Held for review"),
    HIDDEN: tx("Ukryty", "Hidden"),
    DELETED: tx("Usunięty", "Deleted"),
  };

  return (
    <Card
      title={tx("Komentarze", "Comments")}
      actions={
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={tx("Filtr komentarzy", "Comment filter")}>
          {(["all", "held", "reported"] as Filter[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${filter === id ? "bg-[var(--chan-ink)] text-[var(--chan-card)]" : "bg-[var(--chan-surface)] text-[var(--chan-ink)]"}`}
            >
              {id === "all"
                ? tx("Wszystkie", "All")
                : id === "held"
                  ? `${tx("Do przeglądu", "To review")}${data?.counts ? ` (${data.counts.held})` : ""}`
                  : `${tx("Zgłoszone", "Reported")}${data?.counts ? ` (${data.counts.pendingReports})` : ""}`}
            </button>
          ))}
        </div>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      {!data && !error && <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>}
      {data && data.items.length === 0 && <p className="text-[14px] text-[var(--chan-muted)]">{tx("Brak komentarzy w tym widoku.", "No comments in this view.")}</p>}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-[var(--chan-line)]">
          {data.items.map((c) => (
            <li key={c.id} className="grid gap-2 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--chan-muted)]">
                <strong className="text-[var(--chan-ink)]">{c.author?.name ?? tx("Usunięte konto", "Deleted account")}</strong>
                {c.video && <span>· {c.video.title}</span>}
                <Badge tone={c.status === "VISIBLE" ? "good" : "warn"}>{statusLabel[c.status]}</Badge>
                {c.reportsCount > 0 && <Badge tone="warn">{tx("{0} zgłoszeń", "{0} reports", c.reportsCount)}</Badge>}
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-[var(--chan-ink)]">{c.text ?? tx("(treść usunięta przez autora)", "(removed by the author)")}</p>
              <div className="flex flex-wrap gap-2">
                {c.status === "VISIBLE" && (
                  <button type="button" className={smallGhostButtonClass} disabled={busyId === c.id} onClick={() => act(c.id, { action: "hide" })}>
                    {tx("Ukryj", "Hide")}
                  </button>
                )}
                {c.status === "HELD_FOR_REVIEW" && (
                  <button type="button" className={smallGhostButtonClass} disabled={busyId === c.id} onClick={() => act(c.id, { action: "approve" })}>
                    {tx("Zatwierdź", "Approve")}
                  </button>
                )}
                {c.status === "HIDDEN" && (
                  <button type="button" className={smallGhostButtonClass} disabled={busyId === c.id} onClick={() => act(c.id, { action: "restore" })}>
                    {tx("Przywróć", "Restore")}
                  </button>
                )}
                {c.status !== "DELETED" && (
                  <>
                    <button type="button" className={smallGhostButtonClass} disabled={busyId === c.id} onClick={() => act(c.id, { action: c.isHearted ? "unheart" : "heart" })}>
                      {c.isHearted ? tx("Zabierz serce", "Remove heart") : tx("Daj serce", "Heart")}
                    </button>
                    <button type="button" className={smallGhostButtonClass} onClick={() => setReplying(replying === c.id ? null : c.id)}>
                      {tx("Odpowiedz", "Reply")}
                    </button>
                    <button type="button" className={smallDangerGhostButtonClass} disabled={busyId === c.id} onClick={() => act(c.id, { action: "delete" })}>
                      {tx("Usuń", "Delete")}
                    </button>
                  </>
                )}
              </div>
              {replying === c.id && (
                <div className="grid gap-2">
                  <textarea
                    className={inputClass}
                    rows={3}
                    maxLength={2000}
                    value={replyText}
                    aria-label={tx("Treść odpowiedzi", "Reply text")}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <div>
                    <button type="button" className={smallButtonClass} disabled={busyId === c.id || !replyText.trim()} onClick={() => act(c.id, { action: "reply", text: replyText })}>
                      {tx("Wyślij odpowiedź", "Send reply")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
