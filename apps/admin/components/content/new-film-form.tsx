"use client";
/** Step 1 of a new film: title, address, descriptions, access. The draft is created at once; the server
 * then opens its edit page at the upload of the original (step 2). */
import { startTransition, useActionState, useId, useRef } from "react";
import { createFilmAction } from "@admin/app/(panel)/tresci/actions";
import type { ActionResult } from "@admin/lib/actions/panel";
import { Icon } from "@admin/components/icons";
import { Field, describe } from "./film-form";

/** Same rules as slugify() on the server (lib/modules/admin-content), so the suggestion matches. */
function suggestSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function NewFilmForm() {
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(createFilmAction, null);
  const uid = useId();
  const slugRef = useRef<HTMLInputElement>(null);
  const touched = useRef(false);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  const ids = (k: string) => `${uid}-${k}`;
  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => dispatch(fd));
      }}
    >
      <section className="card" aria-labelledby={ids("h")}>
        <div className="card-head">
          <h2 id={ids("h")}>Podstawowe</h2>
        </div>
        <div className="grid">
          <div className="span-8">
            <Field id={ids("title")} label="Tytuł (PL)" error={err.title}>
              <input
                className="input"
                name="title"
                required
                maxLength={200}
                autoFocus
                onChange={(e) => {
                  if (!touched.current && slugRef.current) slugRef.current.value = suggestSlug(e.target.value);
                }}
                {...describe(ids("title"), err.title)}
              />
            </Field>
          </div>
          <div className="span-4">
            <Field id={ids("slug")} label="Adres (slug)" hint="podpowiadany z tytułu; małe litery, cyfry i myślniki" error={err.slug}>
              <input ref={slugRef} className="input mono" name="slug" maxLength={80} spellCheck={false} onChange={() => (touched.current = true)} {...describe(ids("slug"), err.slug, true)} />
            </Field>
          </div>
          <div className="span-12">
            <Field id={ids("titleEn")} label="Tytuł (EN)" hint="opcjonalnie" error={err.titleEn}>
              <input className="input" name="titleEn" maxLength={200} {...describe(ids("titleEn"), err.titleEn, true)} />
            </Field>
          </div>
          <div className="span-6">
            <Field id={ids("description")} label="Opis (PL)" error={err.description}>
              <textarea className="input" name="description" rows={4} maxLength={5000} {...describe(ids("description"), err.description)} />
            </Field>
          </div>
          <div className="span-6">
            <Field id={ids("descriptionEn")} label="Opis (EN)" error={err.descriptionEn}>
              <textarea className="input" name="descriptionEn" rows={4} maxLength={5000} {...describe(ids("descriptionEn"), err.descriptionEn)} />
            </Field>
          </div>
          <fieldset className="span-12 field fieldset-plain">
            <legend className="field-label">Dostęp</legend>
            <div className="radio-stack">
              <label className="choice">
                <input type="radio" name="tier" value="PUBLIC" /> Publiczny (bez logowania)
              </label>
              <label className="choice">
                <input type="radio" name="tier" value="LOGGED_IN" defaultChecked /> Po zalogowaniu
              </label>
            </div>
          </fieldset>
        </div>
      </section>
      <div className="form-actions">
        <span className="form-status" role="status" aria-live="polite">
          {state && !state.ok ? (
            <span className="form-error">
              <Icon name="crit" />
              {state.message}
            </span>
          ) : pending ? (
            "Tworzę szkic…"
          ) : (
            "Dalej: wgrywanie oryginału, miniatura, napisy, publikacja."
          )}
        </span>
        <button type="submit" className="btn btn-primary" aria-disabled={pending}>
          Utwórz szkic i wgraj oryginał
        </button>
      </div>
    </form>
  );
}
