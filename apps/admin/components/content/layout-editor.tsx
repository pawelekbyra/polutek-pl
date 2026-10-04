"use client";
/**
 * Channel layout: order of the published films on the list, which are hidden, and the Hero. Edited
 * locally, saved in one request (VIDEO_LAYOUT_SAVED). Keyboard: Alt+↑/↓ on a row moves it.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition, type KeyboardEvent } from "react";
import { saveLayoutAction } from "@admin/app/(panel)/tresci/actions";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export type LayoutRow = { id: string; title: string; tier: string; showInSidebar: boolean; isMainFeatured: boolean; upcoming: boolean };

export function LayoutEditor({ initial }: { initial: LayoutRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [hero, setHero] = useState(initial.find((r) => r.isMainFeatured)?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(rows.map((r) => [r.id, r.showInSidebar])) !== JSON.stringify(initial.map((r) => [r.id, r.showInSidebar])) || hero !== (initial.find((r) => r.isMainFeatured)?.id ?? null);

  const move = (i: number, d: -1 | 1) =>
    setRows((all) => {
      const j = i + d;
      if (j < 0 || j >= all.length) return all;
      const next = all.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const onKey = (e: KeyboardEvent, i: number) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    move(i, e.key === "ArrowUp" ? -1 : 1);
    requestAnimationFrame(() => document.getElementById(`lr-${rows[i].id}`)?.focus());
  };
  const save = () =>
    start(async () => {
      const res = await saveLayoutAction({ order: rows.map((r) => r.id), hidden: rows.filter((r) => !r.showInSidebar).map((r) => r.id), heroId: hero });
      if (!res.ok) return setError(res.message);
      setError(null);
      toast("ok", res.message ?? "Zapisano układ");
      router.refresh();
    });

  return (
    <>
      <p className="text-2 kbd-tip mb-3">
        Klawisze: fokus na wierszu, potem <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> przesuwa film.
      </p>
      <section className="card card-flush" aria-label="Kolejność filmów">
        <div className="table-scroll">
          <table className="table responsive">
            <caption className="sr-only">Kolejność opublikowanych filmów na liście, od góry</caption>
            <thead>
              <tr>
                <th scope="col">Film</th>
                <th scope="col">Dostęp</th>
                <th scope="col">Na liście</th>
                <th scope="col">Strona główna</th>
                <th scope="col">
                  <span className="sr-only">Przesuń</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} id={`lr-${r.id}`} tabIndex={0} className={`layout-row${r.showInSidebar ? "" : " is-hidden"}`} onKeyDown={(e) => onKey(e, i)} aria-label={`${i + 1}. ${r.title}`}>
                  <td className="cell-first">
                    <div className="cell-title">
                      <span className="layout-num">{i + 1}</span>
                      <strong>{r.title}</strong>
                      {r.upcoming ? <span className="badge info">Premiera</span> : null}
                    </div>
                  </td>
                  <td data-label="Dostęp">{r.tier === "PUBLIC" ? "Publiczny" : "Po zalogowaniu"}</td>
                  <td data-label="Na liście">
                    <label className="switch">
                      <input type="checkbox" checked={r.showInSidebar} onChange={(e) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, showInSidebar: e.target.checked } : x)))} />
                      <span className="sr-only">Pokazuj „{r.title}” na liście filmów</span>
                    </label>
                  </td>
                  <td data-label="Strona główna">
                    <label className="choice">
                      <input type="radio" name="hero" checked={hero === r.id} onChange={() => setHero(r.id)} disabled={r.tier !== "PUBLIC"} />
                      <span>
                        Hero<span className="sr-only">: {r.title}</span>
                      </span>
                    </label>
                  </td>
                  <td className="actions">
                    <div className="row">
                      <button type="button" className="btn btn-sm btn-ghost" aria-label={`W górę: ${r.title}`} disabled={i === 0} onClick={() => move(i, -1)}>
                        <Icon name="up" />
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" aria-label={`W dół: ${r.title}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                        <Icon name="down" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="form-actions">
        <span className="form-status" role="status" aria-live="polite">
          {error ? (
            <span className="form-error">
              <Icon name="crit" />
              {error}
            </span>
          ) : dirty ? (
            "Niezapisane zmiany."
          ) : (
            "Hero tylko dla publicznego filmu z gotowym wideo."
          )}
        </span>
        <button type="button" className="btn" disabled={!dirty || pending} onClick={() => { setRows(initial); setHero(initial.find((r) => r.isMainFeatured)?.id ?? null); setError(null); }}>
          Cofnij zmiany
        </button>
        <button type="button" className="btn btn-primary" aria-disabled={!dirty || pending} onClick={() => dirty && !pending && save()}>
          {pending ? "Zapisuję…" : "Zapisz układ"}
        </button>
      </div>
    </>
  );
}
