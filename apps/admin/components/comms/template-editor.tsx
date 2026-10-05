"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { resetTemplateAction, saveTemplateAction } from "@admin/app/(panel)/komunikacja/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { Field, describe } from "@admin/components/form/field";
import { FormError, useActionForm } from "@admin/components/form/use-action-form";
import { useToast } from "@admin/components/shell/toasts";
import { hasChanges, lineDiff } from "@admin/lib/text-diff";

export type TemplateEditorProps = {
  slug: string;
  isSystem: boolean;
  isNew: boolean;
  isCustomized: boolean;
  name: string;
  description: string;
  subject: string;
  html: string;
  subjectEn: string;
  htmlEn: string;
  /** Text shipped in code (system mails only): the base of the diff and of "Przywróć domyślny". */
  defaults: { subject: string; html: string; subjectEn: string; htmlEn: string } | null;
  variables: { key: string; label: string }[];
};

function Diff({ lines, label }: { lines: ReturnType<typeof lineDiff>; label: string }) {
  if (!hasChanges(lines)) return null;
  return (
    <div>
      <strong>{label}</strong>
      <pre className="diff" aria-label={`Różnica: ${label}`}>
        {lines.map((l, i) => (
          <span key={i} className={l.kind}>{l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}{l.text}{"\n"}</span>
        ))}
      </pre>
    </div>
  );
}

/** Editor with a live preview (sandboxed frame fed by the preview route) and a diff against the default text. */
export function TemplateEditor(p: TemplateEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { state, pending, errors, onSubmit, formRef } = useActionForm(saveTemplateAction);
  const [vals, setVals] = useState({ subject: p.subject, html: p.html, subjectEn: p.subjectEn, htmlEn: p.htmlEn });
  const [lang, setLang] = useState<"pl" | "en">("pl");
  const [slug, setSlug] = useState(p.slug);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, startReset] = useTransition();
  const previewForm = useRef<HTMLFormElement>(null);
  const set = (k: keyof typeof vals) => (e: { target: { value: string } }) => setVals((v) => ({ ...v, [k]: e.target.value }));

  // Live preview: copy the draft into the hidden form and submit it into the frame, at most twice a second.
  useEffect(() => {
    const t = setTimeout(() => previewForm.current?.requestSubmit(), 450);
    return () => clearTimeout(t);
  }, [vals, lang, slug]);

  const diff = useMemo(() => {
    if (!p.defaults) return null;
    const d = p.defaults;
    return {
      subject: lineDiff(`${d.subject}\n${d.subjectEn}`, `${vals.subject}\n${vals.subjectEn}`),
      body: lineDiff(d.html, vals.html),
      bodyEn: lineDiff(d.htmlEn, vals.htmlEn),
    };
  }, [p.defaults, vals]);
  const changed = diff ? hasChanges(diff.subject) || hasChanges(diff.body) || hasChanges(diff.bodyEn) : false;

  const reset = () =>
    startReset(async () => {
      const res = await resetTemplateAction({ slug: p.slug });
      if (!res.ok) return setError(res.message);
      setConfirm(false);
      toast("ok", res.message ?? "Gotowe");
      router.push(p.isSystem ? `/komunikacja?tab=szablony&t=${p.slug}` : "/komunikacja?tab=szablony");
      router.refresh();
    });

  return (
    <div className="stack">
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <div className="grid">
          {p.isNew ? (
            <>
              <div className="span-6"><Field id="t-slug" label="Klucz szablonu" hint="małe litery, cyfry, myślniki; używany jako adres" error={errors.slug}><input className="input mono" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={60} {...describe("t-slug", errors.slug, true)} /></Field></div>
              <div className="span-6"><Field id="t-name" label="Nazwa" error={errors.name}><input className="input" name="name" defaultValue={p.name} maxLength={80} {...describe("t-name", errors.name)} /></Field></div>
              <div className="span-12"><Field id="t-desc" label="Opis" error={errors.description}><input className="input" name="description" defaultValue={p.description} maxLength={300} {...describe("t-desc", errors.description)} /></Field></div>
            </>
          ) : (
            <input type="hidden" name="slug" value={p.slug} />
          )}
          <div className="span-6"><Field id="t-sub-pl" label="Temat (PL)" error={errors.subject}><input className="input" name="subject" value={vals.subject} onChange={set("subject")} maxLength={200} {...describe("t-sub-pl", errors.subject)} /></Field></div>
          <div className="span-6"><Field id="t-sub-en" label="Temat (EN)" error={errors.subjectEn}><input className="input" name="subjectEn" value={vals.subjectEn} onChange={set("subjectEn")} maxLength={200} {...describe("t-sub-en", errors.subjectEn)} /></Field></div>
          <div className="span-6"><Field id="t-body-pl" label="Treść (PL, HTML)" hint={<>Zmienne: {p.variables.map((v) => `{{${v.key}}}`).join(" ")}. Nieznana zmienna blokuje zapis.</>} error={errors.html}><textarea className="input mono" name="html" rows={12} value={vals.html} onChange={set("html")} {...describe("t-body-pl", errors.html, true)} /></Field></div>
          <div className="span-6"><Field id="t-body-en" label="Treść (EN, HTML)" hint="Bez wersji angielskiej odbiorca z językiem EN dostaje polską." error={errors.htmlEn}><textarea className="input mono" name="htmlEn" rows={12} value={vals.htmlEn} onChange={set("htmlEn")} {...describe("t-body-en", errors.htmlEn)} /></Field></div>
        </div>
        <FormError state={state} />
        <div className="card-foot">
          {!p.isNew && (p.isCustomized || !p.isSystem) ? (
            <button type="button" className="btn btn-ghost" onClick={() => { setError(null); setConfirm(true); }}>
              {p.isSystem ? "Przywróć domyślny…" : "Usuń szablon…"}
            </button>
          ) : <span className="muted">{p.isSystem ? "Tekst domyślny z kodu." : ""}</span>}
          <button type="submit" className="btn btn-primary" aria-busy={pending}>{pending ? "Zapisuję…" : "Zapisz"}</button>
        </div>
      </form>

      <section className="card" aria-labelledby="h-prev">
        <div className="card-head">
          <h2 id="h-prev">Podgląd na żywo</h2>
          <div className="chip-row" role="group" aria-label="Język podglądu">
            {(["pl", "en"] as const).map((l) => (
              <button key={l} type="button" className={`btn btn-sm${lang === l ? " btn-primary" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <p className="sub">Wartości przykładowe (Jan, 20.00 PLN, przykładowe linki). Tak samo składa się prawdziwy mail, bez wysyłania go.</p>
        </div>
        <iframe name="mail-preview" title="Podgląd e-maila" className="mail-frame" sandbox="" />
        <form ref={previewForm} method="post" action="/api/email/preview" target="mail-preview" className="sr-only" aria-hidden="true">
          <input type="hidden" name="slug" value={slug || p.slug} />
          <input type="hidden" name="language" value={lang} />
          <input type="hidden" name="subject" value={vals.subject} />
          <input type="hidden" name="html" value={vals.html} />
          <input type="hidden" name="subjectEn" value={vals.subjectEn} />
          <input type="hidden" name="htmlEn" value={vals.htmlEn} />
        </form>
      </section>

      {diff ? (
        <section className="card" aria-labelledby="h-diff">
          <div className="card-head"><h2 id="h-diff">Różnica względem domyślnego</h2></div>
          {changed ? (
            <div className="stack">
              <Diff lines={diff.subject} label="Tematy" />
              <Diff lines={diff.body} label="Treść PL" />
              <Diff lines={diff.bodyEn} label="Treść EN" />
            </div>
          ) : (
            <p className="muted">Tekst jest taki sam jak domyślny.</p>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirm}
        busy={resetting}
        error={error}
        onConfirm={reset}
        onClose={() => setConfirm(false)}
        options={{
          title: p.isSystem ? "Przywrócić tekst domyślny?" : "Usunąć szablon?",
          confirm: p.isSystem ? "Przywróć domyślny" : "Usuń szablon",
          danger: !p.isSystem,
          effect: p.isSystem ? ["Twoja wersja zostanie usunięta", "kolejne maile pójdą z tekstem z kodu", "wpis TEMPLATE_RESET_TO_DEFAULT w audycie"] : ["szablon znika z listy", "wysłane wcześniej rozsyłki nie zmieniają się", "wpis TEMPLATE_DELETED w audycie"],
        }}
      />
    </div>
  );
}
