"use client";
/**
 * "Tłumaczenia" of a film: one row per language with flag, status, title, address and subtitles; edit in a
 * dialog, approve one or all machine drafts. "Generuj szkice AI" is visible but off until the next step.
 */
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { approveTranslationsAction, generateDraftsAction, saveTranslationAction } from "@admin/app/(panel)/tresci/translation-actions";
import { removeSubtitleAction } from "@admin/app/(panel)/tresci/actions";
import type { ActionResult } from "@admin/lib/actions/panel";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";
import { Field, describe } from "./film-form";

export type TranslationRow = {
  code: string;
  label: string;
  namePl: string;
  flag: string;
  translation: { title: string; slug: string; description: string | null; subtitleUrl: string | null; status: "AI_DRAFT" | "APPROVED" | "EDITED" } | null;
};

const STATUS: Record<string, { cls: string; label: string }> = {
  AI_DRAFT: { cls: "warn", label: "Szkic automatyczny" },
  APPROVED: { cls: "ok", label: "Zatwierdzone" },
  EDITED: { cls: "ok", label: "Napisane przez człowieka" },
};

function Flag({ flag }: { flag: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny same-origin SVG, no optimizer
  return <img className="flag" src={`/flags/${flag}.svg`} alt="" width={20} height={20} />;
}

export type TranslationsAi = { enabled: boolean; reason: string | null };

/** `translator`: a translator account sees and writes only its languages; no approving, subtitles or AI. */
export function TranslationsTable({ videoId, filmSlug, original, rows, mode = "owner", ai = { enabled: false, reason: "wkrótce" } }: { videoId: string; filmSlug: string; original: { title: string; slug: string; hasSubtitles: boolean }; rows: TranslationRow[]; mode?: "owner" | "translator"; ai?: TranslationsAi }) {
  const owner = mode === "owner";
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<TranslationRow | null>(null);
  const [pending, start] = useTransition();
  const [busySub, setBusySub] = useState<string | null>(null);
  const drafts = rows.filter((r) => r.translation?.status === "AI_DRAFT").length;

  const approve = (language?: string) =>
    start(async () => {
      const res = await approveTranslationsAction({ videoId, filmSlug, language });
      toast(res.ok ? "ok" : "crit", res.ok ? res.message ?? "Zatwierdzono" : res.message);
      if (res.ok) router.refresh();
    });

  const generate = () =>
    start(async () => {
      const res = await generateDraftsAction({ videoId, filmSlug });
      toast(res.ok ? "ok" : "crit", res.ok ? (res.message ?? "Gotowe") : res.message);
      if (res.ok) router.refresh();
    });

  const uploadSub = async (code: string, file: File) => {
    if (file.size > 1024 * 1024) return toast("crit", "Plik napisów może mieć najwyżej 1 MB.");
    setBusySub(code);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/subtitles/${code}`, { method: "POST", body: fd }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string; cues?: number } | null;
    setBusySub(null);
    if (!res?.ok) return toast("crit", "Napisy nie zostały zapisane", body?.error ?? "Brak połączenia z panelem.");
    toast("ok", `Napisy ${code.toUpperCase()} zapisane`, `${body?.cues ?? "?"} napisów, WebVTT poprawny.`);
    router.refresh();
  };

  return (
    <>
      {owner ? (
        <div className="row mb-3">
          <button type="button" className="btn btn-primary" aria-disabled={!drafts || pending} onClick={() => drafts && !pending && approve()}>
            <Icon name="ok" />
            Zatwierdź wszystkie szkice{drafts ? ` (${drafts})` : ""}
          </button>
          <button type="button" className="btn" aria-disabled={!ai.enabled || pending} aria-describedby="ai-note" onClick={() => ai.enabled && !pending && generate()}>
            <Icon name="zap" />
            Generuj szkice AI
          </button>
          <span id="ai-note" className="muted">{ai.enabled ? "Cloudflare Workers AI (darmowy limit dobowy): tytuł i opis; nie nadpisuje tekstów napisanych przez człowieka." : (ai.reason ?? "wkrótce")}</span>
        </div>
      ) : null}
      <section className="card card-flush" aria-label="Języki filmu">
        <div className="table-scroll">
          <table className="table responsive">
            <caption className="sr-only">Wersje językowe filmu</caption>
            <thead>
              <tr>
                <th scope="col">Język</th>
                <th scope="col">Stan</th>
                <th scope="col">Tytuł</th>
                <th scope="col" className="hide-md">Adres</th>
                <th scope="col">Napisy</th>
                <th scope="col">
                  <span className="sr-only">Akcje</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="is-active">
                <td className="cell-first">
                  <span className="lang-cell">
                    <Flag flag="pl" /> Polski <span className="badge outline">oryginał</span>
                  </span>
                </td>
                <td data-label="Stan"><span className="muted">źródło tłumaczeń</span></td>
                <td data-label="Tytuł" className="wrap">{original.title}</td>
                <td data-label="Adres" className="hide-md mono">{original.slug}</td>
                <td data-label="Napisy">{original.hasSubtitles ? <span className="state ok"><Icon name="ok" /><span>Są</span></span> : <span className="muted">brak</span>}</td>
                <td className="actions">
                  {owner ? <a className="btn btn-sm btn-ghost" href={`/tresci/${filmSlug}/edycja`}>Edytuj oryginał</a> : null}
                </td>
              </tr>
              {rows.map((r) => {
                const t = r.translation;
                const st = t ? STATUS[t.status] : null;
                return (
                  <tr key={r.code}>
                    <td className="cell-first">
                      <span className="lang-cell" lang={r.code}>
                        <Flag flag={r.flag} /> {r.label}
                      </span>
                    </td>
                    <td data-label="Stan">{st ? <span className={`badge ${st.cls}`}>{st.label}</span> : <span className="muted">brak</span>}</td>
                    <td data-label="Tytuł" className="wrap" lang={r.code}>{t?.title ?? <span className="muted">—</span>}</td>
                    <td data-label="Adres" className="hide-md mono">{t?.slug ?? "—"}</td>
                    <td data-label="Napisy">
                      <span className="li-actions">
                        {t?.subtitleUrl ? <span className="state ok"><Icon name="ok" /><span>Są</span></span> : <span className="muted">brak</span>}
                        {owner && t ? <SubtitlePick code={r.code} busy={busySub === r.code} onFile={(f) => uploadSub(r.code, f)} has={!!t.subtitleUrl} /> : null}
                        {owner && t?.subtitleUrl && r.code !== "en" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() =>
                              start(async () => {
                                const res = await removeSubtitleAction({ videoId, lang: r.code, slug: filmSlug });
                                toast(res.ok ? "ok" : "crit", res.ok ? res.message ?? "Usunięto" : res.message);
                                if (res.ok) router.refresh();
                              })
                            }
                          >
                            Usuń<span className="sr-only"> napisy {r.namePl}</span>
                          </button>
                        ) : null}
                      </span>
                    </td>
                    <td className="actions">
                      <span className="li-actions">
                        {owner && t?.status === "AI_DRAFT" ? (
                          <button type="button" className="btn btn-sm" onClick={() => approve(r.code)} aria-disabled={pending}>
                            Zatwierdź<span className="sr-only"> {r.namePl}</span>
                          </button>
                        ) : null}
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(r)}>
                          {t ? "Edytuj" : "Dodaj"}
                          <span className="sr-only"> {r.namePl}</span>
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="foot-note">
        <Icon name="info" />
        Na stronie działa dziś tylko polski i angielski (angielski zapisuje się też w polach EN filmu). Pozostałe języki czekają na swoje wersje strony; szkic automatyczny będzie tam oznaczony „tłumaczenie automatyczne”, bez indeksowania i poza mapą strony, dopóki ktoś go nie zatwierdzi.
      </p>
      {editing ? <EditDialog key={editing.code} row={editing} videoId={videoId} filmSlug={filmSlug} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} /> : null}
    </>
  );
}

function SubtitlePick({ code, busy, has, onFile }: { code: string; busy: boolean; has: boolean; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" accept=".vtt,text/vtt" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <button type="button" className="btn btn-sm btn-ghost" aria-disabled={busy} onClick={() => input.current?.click()}>
        <Icon name="upload" />
        {busy ? "Wgrywam…" : has ? "Podmień" : "Wgraj VTT"}
        <span className="sr-only"> ({code})</span>
      </button>
    </>
  );
}

function EditDialog({ row, videoId, filmSlug, onClose, onSaved }: { row: TranslationRow; videoId: string; filmSlug: string; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const { toast } = useToast();
  const [state, dispatch, pending] = useActionState<ActionResult<{ slug: string }> | null, FormData>(saveTranslationAction, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (state?.ok) {
      toast("ok", state.message ?? "Zapisano");
      onSaved();
    }
  }, [state, toast, onSaved]);
  const t = row.translation;
  const id = (k: string) => `${uid}-${k}`;
  return (
    <dialog ref={ref} className="modal" aria-labelledby={id("h")} onClose={onClose}>
      <form
        className="modal-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const fd = new FormData(e.currentTarget);
          startTransition(() => dispatch(fd));
        }}
      >
        <div className="modal-head">
          <h2 id={id("h")}>
            <span className="lang-cell">
              <Flag flag={row.flag} /> {row.label}
            </span>
          </h2>
          <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <input type="hidden" name="videoId" value={videoId} />
          <input type="hidden" name="filmSlug" value={filmSlug} />
          <input type="hidden" name="language" value={row.code} />
          <Field id={id("title")} label="Tytuł" error={err.title}>
            <input className="input" name="title" lang={row.code} defaultValue={t?.title ?? ""} maxLength={200} required autoFocus {...describe(id("title"), err.title)} />
          </Field>
          <Field id={id("slug")} label="Adres" hint={t ? "Zmiana zapisuje stary adres do przekierowań." : "Puste = utworzy się z tytułu (transliteracja, przy kolizji -2)."} error={err.slug}>
            <input className="input mono" name="slug" defaultValue={t?.slug ?? ""} maxLength={80} spellCheck={false} {...describe(id("slug"), err.slug, true)} />
          </Field>
          <Field id={id("description")} label="Opis" error={err.description}>
            <textarea className="input" name="description" lang={row.code} rows={5} defaultValue={t?.description ?? ""} maxLength={5000} {...describe(id("description"), err.description)} />
          </Field>
          {state && !state.ok ? (
            <p className="form-error" role="alert">
              <Icon name="crit" />
              {state.message}
            </p>
          ) : null}
          <p className="muted">Zapis oznacza tę wersję jako napisaną przez człowieka.</p>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="btn btn-primary" aria-disabled={pending}>
            {pending ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
