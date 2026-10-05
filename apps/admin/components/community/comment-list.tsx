"use client";
/**
 * Comments with moderation: one row per comment, checkboxes for a bulk action (up to 50, one atomic request),
 * hide/restore/approve with a "Cofnij" toast, creator reply and heart, and delete behind a "Skutek" dialog (final,
 * so it needs a fresh step-up: the server answers STEP_UP_REQUIRED and we go to /potwierdz and come back here).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moderateCommentsAction, replyAsCreatorAction, setHeartAction, undoModerationAction } from "@admin/app/(panel)/spolecznosc/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { FieldsDialog } from "@admin/components/community/fields-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";
import { Badge } from "@admin/components/badge";
import { COMMENT_STATUS } from "@admin/lib/community-format";
import type { BulkModerationResult, PanelComment } from "@/lib/modules/comments";

type Op = "hide" | "hold" | "approve" | "restore" | "delete";
const BULK_MAX = 50;
const OP_LABEL: Record<Op, string> = { hide: "Ukryj", hold: "Wstrzymaj", approve: "Zatwierdź", restore: "Przywróć", delete: "Usuń…" };

function rowOps(status: string): Op[] {
  return status === "VISIBLE" ? ["hide"] : status === "HELD_FOR_REVIEW" ? ["approve", "hide"] : status === "HIDDEN" ? ["restore"] : [];
}

export function CommentList({ items, returnPath, videoSlug }: { items: PanelComment[]; returnPath: string; videoSlug?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [replyTo, setReplyTo] = useState<PanelComment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < BULK_MAX) n.add(id);
      else toast("warn", `Naraz najwyżej ${BULK_MAX} komentarzy.`);
      return n;
    });

  const afterStepUpRedirect = (code?: string) => {
    if (code !== "STEP_UP_REQUIRED") return false;
    router.push(`/potwierdz?next=${encodeURIComponent(returnPath)}`);
    return true;
  };

  const undo = (r: BulkModerationResult) => () =>
    void undoModerationAction({ changes: r.changed.map((c) => ({ commentId: c.commentId, from: c.from as never, to: c.to as never })), reports: r.resolvedReports }).then((u) => {
      toast(u.ok ? "ok" : "crit", u.ok ? "Cofnięto" : u.message);
      if (u.ok) router.refresh();
    });

  const run = (ids: string[], op: Op) =>
    start(async () => {
      const res = await moderateCommentsAction({ ids, op, videoSlug });
      if (!res.ok) {
        if (afterStepUpRedirect(res.code)) return;
        if (op === "delete") return setError(res.message);
        return toast("crit", res.message);
      }
      setConfirmDelete(null);
      setError(null);
      setSelected(new Set());
      const r = res.data!;
      toast("ok", res.message ?? "Zapisano", "Zapisano w dzienniku audytu.", op !== "delete" && r.changed.length ? { label: "Cofnij", run: undo(r) } : undefined);
      router.refresh();
    });

  const heart = (c: PanelComment) =>
    start(async () => {
      const res = await setHeartAction({ commentId: c.id, hearted: !c.isHearted, videoSlug });
      toast(res.ok ? "ok" : "crit", res.ok ? res.message ?? "Zapisano" : res.message);
      if (res.ok) router.refresh();
    });

  const reply = (fd: FormData) =>
    start(async () => {
      if (!replyTo) return;
      const res = await replyAsCreatorAction({ commentId: replyTo.id, text: String(fd.get("text") ?? ""), heart: fd.get("heart") === "on", videoSlug });
      if (!res.ok) return setError(res.message);
      setReplyTo(null);
      setError(null);
      toast("ok", res.message ?? "Opublikowano");
      router.refresh();
    });

  const ids = [...selected];
  const allOn = items.length > 0 && items.slice(0, BULK_MAX).every((c) => selected.has(c.id));
  return (
    <>
      {ids.length ? (
        <div className="bulk-bar" role="region" aria-label="Akcje zbiorcze">
          <strong aria-live="polite">Zaznaczono: {ids.length}</strong>
          <button type="button" className="btn btn-sm" aria-disabled={pending} onClick={() => run(ids, "hide")}><Icon name="eye-off" />Ukryj</button>
          <button type="button" className="btn btn-sm" aria-disabled={pending} onClick={() => run(ids, "restore")}>Przywróć</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => { setError(null); setConfirmDelete(ids); }}><Icon name="trash" />Usuń…</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Odznacz</button>
        </div>
      ) : null}
      <section className="card card-flush" aria-label="Komentarze">
        <label className="choice select-all">
          <input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(items.slice(0, BULK_MAX).map((c) => c.id)))} />
          Zaznacz widoczne (do {BULK_MAX})
        </label>
        {items.map((c) => {
          const st = COMMENT_STATUS[c.status] ?? { kind: "" as const, label: c.status };
          const who = c.author?.name ?? "usunięte konto";
          return (
            <article className={`mod-item mod-row${selected.has(c.id) ? " is-selected" : ""}`} key={c.id}>
              <label className="choice mod-check">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="sr-only">Zaznacz komentarz: {who}</span>
              </label>
              <div>
                <blockquote>{c.text ?? <span className="muted">(treść usunięta przez autora)</span>}</blockquote>
                <div className="mod-meta">
                  <Badge kind={st.kind} icon={false}>{st.label}</Badge>
                  {c.author && !c.author.isDeleted ? <Link href={`/spolecznosc/u/${c.author.id}`}>{who}</Link> : <span>{who}</span>}
                  {c.video ? <Link href={`/tresci/${c.video.slug}`}>„{c.video.title}”</Link> : null}
                  <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                  {c.parentId ? <span>odpowiedź</span> : null}
                  {c.likesCount ? <span>{c.likesCount} polubień</span> : null}
                  {c.reportsCount ? <Badge kind="warn" icon="flag">{`${c.reportsCount} zgłosz.`}</Badge> : null}
                  {c.isHearted ? <span className="muted"><Icon name="heart" /> serduszko twórcy</span> : null}
                  {c.isQuestion && !c.creatorReplied && c.status === "VISIBLE" ? <Badge kind="info" icon={false}>pytanie bez odpowiedzi</Badge> : null}
                </div>
              </div>
              <div className="mod-actions">
                {rowOps(c.status).map((op) => (
                  <button key={op} type="button" className="btn btn-sm btn-ghost" aria-disabled={pending} onClick={() => run([c.id], op)}>
                    {OP_LABEL[op]}<span className="sr-only"> komentarz: {who}</span>
                  </button>
                ))}
                {c.status === "VISIBLE" ? (
                  <>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setError(null); setReplyTo(c); }} aria-label={`Odpowiedz jako twórca: ${who}`}><Icon name="reply" /></button>
                    <button type="button" className="btn btn-sm btn-ghost" aria-pressed={c.isHearted} aria-disabled={pending} onClick={() => heart(c)} aria-label={c.isHearted ? `Zdejmij serduszko: ${who}` : `Daj serduszko: ${who}`}><Icon name="heart" /></button>
                  </>
                ) : null}
                {c.status !== "DELETED" ? (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setError(null); setConfirmDelete([c.id]); }} aria-label={`Usuń komentarz: ${who}`}><Icon name="trash" /></button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
      <ConfirmDialog
        open={!!confirmDelete}
        options={{ title: confirmDelete && confirmDelete.length > 1 ? `Usunąć ${confirmDelete.length} komentarzy?` : "Usunąć komentarz?", confirm: "Usuń", danger: true, body: "Usunięcie jest ostateczne. Żeby tylko schować komentarz przed widzami, użyj „Ukryj” (można cofnąć).", effect: ["komentarz znika ze strony dla wszystkich", "treść zostaje w panelu jako dowód moderacji", "zgłoszenia do niego zamykają się jako uznane", "wymaga potwierdzenia tożsamości z ostatnich 5 minut", "wpis COMMENT_DELETE w audycie, tego nie da się cofnąć"] }}
        busy={pending}
        error={error}
        onConfirm={() => confirmDelete && run(confirmDelete, "delete")}
        onClose={() => setConfirmDelete(null)}
      />
      <FieldsDialog open={!!replyTo} title="Odpowiedz jako twórca" confirm="Opublikuj odpowiedź" busy={pending} error={error} onSubmit={reply} onClose={() => setReplyTo(null)} effect={["odpowiedź pojawia się pod komentarzem z oznaczeniem „Twórca”", "napisana z konta właściciela kanału", "wpis COMMENT_CREATOR_REPLY w audycie"]}>
        {replyTo ? <blockquote className="effect">{replyTo.text}<br /><span className="muted">{replyTo.author?.name}</span></blockquote> : null}
        <div className="field">
          <label htmlFor="reply-text">Twoja odpowiedź</label>
          <textarea id="reply-text" name="text" className="input" required maxLength={2000} />
          <span className="hint">Do 2000 znaków.</span>
        </div>
        <label className="switch"><input type="checkbox" name="heart" defaultChecked /> Dodaj serduszko do komentarza</label>
      </FieldsDialog>
    </>
  );
}
