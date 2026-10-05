"use client";
/**
 * The moderation queue (prototype #/spolecznosc?tab=moderacja): comments held for review or reported. Keyboard:
 * j/k next/previous, h hide, z keep (approve a held one), p hold, w mute the author. Every decision is one atomic
 * request (comment + its reports) and shows a "Cofnij" toast that restores both. Single-letter keys never fire in
 * inputs or while a dialog is open (WCAG 2.1.4), and the active item keeps focus so a screen reader follows.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { decideQueueItemAction, undoModerationAction } from "@admin/app/(panel)/spolecznosc/actions";
import { muteUserAction } from "@admin/app/(panel)/spolecznosc/user-actions";
import { FieldsDialog } from "@admin/components/community/fields-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";
import { Badge } from "@admin/components/badge";
import { REPORT_REASON } from "@admin/lib/community-format";
import type { PanelComment } from "@/lib/modules/comments";

type Decision = "hide" | "hold" | "keep";

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function ModerationQueue({ items }: { items: PanelComment[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const [muteFor, setMuteFor] = useState<PanelComment | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const visible = items.filter((c) => !done.has(c.id));
  const current = visible[Math.min(active, Math.max(0, visible.length - 1))];

  const focusItem = useCallback((id: string | undefined) => {
    if (id) refs.current.get(id)?.focus();
    else document.getElementById("page-title")?.focus();
  }, []);

  const decide = useCallback(
    (c: PanelComment | undefined, decision: Decision) => {
      if (!c || pending) return;
      start(async () => {
        const res = await decideQueueItemAction({ commentId: c.id, decision });
        if (!res.ok) return toast("crit", res.message);
        const result = res.data!;
        const idx = visible.findIndex((x) => x.id === c.id);
        setDone((s) => new Set(s).add(c.id));
        setTimeout(() => focusItem(visible[idx + 1]?.id ?? visible[idx - 1]?.id), 0);
        const reversible = result.changed.length > 0 || result.resolvedReports.length > 0;
        toast("ok", res.message ?? "Zapisano", "Zapisano w dzienniku audytu.", reversible
          ? {
              label: "Cofnij",
              run: () =>
                void undoModerationAction({ changes: result.changed.map((x) => ({ commentId: x.commentId, from: x.from as never, to: x.to as never })), reports: result.resolvedReports }).then((u) => {
                  toast(u.ok ? "ok" : "crit", u.ok ? "Cofnięto" : u.message);
                  if (u.ok) {
                    setDone((s) => {
                      const n = new Set(s);
                      n.delete(c.id);
                      return n;
                    });
                    router.refresh();
                  }
                }),
            }
          : undefined);
        router.refresh();
      });
    },
    [focusItem, pending, router, toast, visible],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || document.querySelector("dialog[open]") || !visible.length) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "k") {
        e.preventDefault();
        const i = Math.max(0, Math.min(visible.length - 1, active + (k === "j" ? 1 : -1)));
        setActive(i);
        focusItem(visible[i].id);
      } else if (k === "h") {
        e.preventDefault();
        decide(current, "hide");
      } else if (k === "z") {
        e.preventDefault();
        decide(current, "keep");
      } else if (k === "p" && current?.status === "VISIBLE") {
        e.preventDefault();
        decide(current, "hold");
      } else if (k === "w" && current?.author && !current.author.isDeleted && !current.author.isAdmin) {
        e.preventDefault();
        setMuteError(null);
        setMuteFor(current);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, current, decide, focusItem, visible]);

  const mute = (fd: FormData) =>
    start(async () => {
      if (!muteFor?.author) return;
      const res = await muteUserAction({ userId: muteFor.author.id, days: Number(fd.get("days")), reason: String(fd.get("reason") ?? "") });
      if (!res.ok) return setMuteError(res.message);
      setMuteFor(null);
      toast("ok", res.message ?? "Wyciszono", "Autor nie doda nowych komentarzy; możesz to cofnąć w jego profilu.");
      router.refresh();
    });

  if (!visible.length)
    return (
      <section className="card">
        <div className="empty">
          <Icon name="ok" />
          <strong>Kolejka pusta</strong>
          <span>Wszystkie zgłoszenia przejrzane. Nowe pojawią się tutaj i w licznikach.</span>
        </div>
      </section>
    );

  return (
    <>
      <p className="text-2 kbd-tip mb-3">
        Klawisze: <kbd>j</kbd>/<kbd>k</kbd> następny/poprzedni, <kbd>h</kbd> ukryj, <kbd>z</kbd> zostaw (zatwierdź wstrzymany), <kbd>p</kbd> wstrzymaj, <kbd>w</kbd> wycisz autora.
      </p>
      <section className="card card-flush" aria-label="Kolejka moderacji">
        {visible.map((c, i) => {
          const held = c.status === "HELD_FOR_REVIEW";
          const canMute = !!c.author && !c.author.isDeleted && !c.author.isAdmin && !c.author.mutedUntil;
          return (
            <article
              key={c.id}
              ref={(el) => {
                if (el) refs.current.set(c.id, el);
                else refs.current.delete(c.id);
              }}
              className={`mod-item${c === current ? " is-active" : ""}`}
              tabIndex={-1}
              aria-label={`Komentarz ${i + 1} z ${visible.length}`}
              onFocus={() => setActive(i)}
            >
              <div>
                <blockquote>{c.text ?? <span className="muted">(treść usunięta przez autora)</span>}</blockquote>
                <div className="mod-meta">
                  {held ? <Badge kind="info" icon="clock">Wstrzymany do akceptacji</Badge> : null}
                  {c.pendingReports.length ? (
                    <Badge kind="warn" icon="flag">{`${c.pendingReports.length} ${c.pendingReports.length === 1 ? "zgłoszenie" : "zgłoszenia"}: ${[...new Set(c.pendingReports.map((r) => REPORT_REASON[r.reason] ?? r.reason))].join(", ")}`}</Badge>
                  ) : null}
                  {c.status === "HIDDEN" ? <Badge kind="warn" icon={false}>Już ukryty</Badge> : null}
                  {c.status === "DELETED" ? <Badge icon={false}>Usunięty</Badge> : null}
                  {c.author ? <Link href={`/spolecznosc/u/${c.author.id}`}>{c.author.name}</Link> : null}
                  {c.video ? <span>pod <Link href={`/tresci/${c.video.slug}`}>„{c.video.title}”</Link></span> : null}
                  <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                  {c.author && c.author.commentsCount <= 10 ? <span>{c.author.commentsCount} komentarzy autora</span> : null}
                  {c.author?.mutedUntil ? <Badge kind="warn" icon="mute">autor wyciszony</Badge> : null}
                </div>
                {c.pendingReports.some((r) => r.note) ? <div className="mod-meta">{c.pendingReports.filter((r) => r.note).map((r) => <span key={r.id}>„{r.note}” ({r.reporter})</span>)}</div> : null}
              </div>
              <div className="mod-actions">
                {c.status !== "HIDDEN" && c.status !== "DELETED" ? (
                  <button type="button" className="btn btn-sm" aria-disabled={pending} onClick={() => decide(c, "hide")}>
                    <Icon name="eye-off" />Ukryj <kbd>h</kbd>
                  </button>
                ) : null}
                <button type="button" className="btn btn-sm" aria-disabled={pending} onClick={() => decide(c, "keep")}>
                  {held ? "Zatwierdź" : "Zostaw"} <kbd>z</kbd>
                </button>
                {c.status === "VISIBLE" ? (
                  <button type="button" className="btn btn-sm btn-ghost" aria-disabled={pending} onClick={() => decide(c, "hold")}>
                    Wstrzymaj <kbd>p</kbd>
                  </button>
                ) : null}
                {canMute ? (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setMuteError(null); setMuteFor(c); }}>
                    Wycisz autora <kbd>w</kbd>
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
      <FieldsDialog open={!!muteFor} title={`Wyciszyć ${muteFor?.author?.name ?? "autora"}?`} confirm="Wycisz komentowanie" busy={pending} error={muteError} onSubmit={mute} onClose={() => setMuteFor(null)} effect={["osoba nadal czyta i reaguje, ale nie doda nowych komentarzy", "powód i czas zapisane w audycie", "zdejmiesz wyciszenie w jej profilu"]}>
        <div className="field">
          <label htmlFor="mute-days">Na jak długo</label>
          <select id="mute-days" name="days" className="select" defaultValue="7">
            <option value="1">1 dzień</option>
            <option value="7">7 dni</option>
            <option value="30">30 dni</option>
            <option value="365">rok</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="mute-reason">Powód</label>
          <input id="mute-reason" name="reason" className="input" required minLength={3} maxLength={300} placeholder="np. spam pod trzema filmami" />
        </div>
      </FieldsDialog>
    </>
  );
}
