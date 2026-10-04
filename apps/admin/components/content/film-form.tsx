"use client";
/**
 * One form for every text field of a film: basics, publication and premiere, fundraising bar, exposure.
 * Submitted by hand (not <form action>) so a refused save keeps what the owner typed. The server checks
 * everything again; the client only shows and hides the dependent fields.
 */
import { useActionState, useEffect, useId, useState, startTransition, type ReactNode } from "react";
import { saveFilmAction } from "@admin/app/(panel)/tresci/actions";
import type { ActionResult } from "@admin/lib/actions/panel";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export type FilmFormValues = {
  id: string;
  updatedAt: string;
  status: string;
  title: string;
  slug: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  tier: "PUBLIC" | "LOGGED_IN";
  premiereLocal: string;
  premiereUpcoming: boolean;
  fundMode: "off" | "manual" | "goal";
  fundPercent: string;
  fundGoal: string;
  fundCurrency: string;
  fundSince: string;
  showInSidebar: boolean;
  isMainFeatured: boolean;
  /** HLS not ready: "publish now" becomes "publish when encoding finishes". */
  hlsReady: boolean;
};

const CURRENCIES = ["PLN", "EUR", "USD", "CHF", "GBP"];

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="error" id={`${id}-err`} role="alert">
          <Icon name="crit" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** aria wiring of an input: invalid flag and the ids of its hint and error. */
export const describe = (id: string, err?: string, hint = false) => ({
  id,
  "aria-invalid": err ? true : undefined,
  "aria-describedby": [hint ? `${id}-hint` : "", err ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined,
});

export function FilmForm({ v }: { v: FilmFormValues }) {
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(saveFilmAction, null);
  const { toast } = useToast();
  const uid = useId();
  const published = v.status === "PUBLISHED";
  const [when, setWhen] = useState(v.premiereUpcoming || (v.premiereLocal && !published) ? "premiere" : published ? "now" : "draft");
  const [fund, setFund] = useState(v.fundMode);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state?.ok) toast("ok", state.message ?? "Zapisano");
  }, [state, toast]);

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
      <input type="hidden" name="id" value={v.id} />
      <input type="hidden" name="expectedUpdatedAt" value={v.updatedAt} />

      <section className="card" aria-labelledby={ids("h-meta")}>
        <div className="card-head">
          <h2 id={ids("h-meta")}>Podstawowe</h2>
        </div>
        <div className="grid">
          <div className="span-8">
            <Field id={ids("title")} label="Tytuł (PL)" error={err.title}>
              <input className="input" name="title" defaultValue={v.title} required maxLength={200} {...describe(ids("title"), err.title)} />
            </Field>
          </div>
          <div className="span-4">
            <Field id={ids("slug")} label="Adres (slug)" hint="małe litery, cyfry i myślniki; zmiana psuje stare linki" error={err.slug}>
              <input className="input mono" name="slug" defaultValue={v.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} spellCheck={false} {...describe(ids("slug"), err.slug, true)} />
            </Field>
          </div>
          <div className="span-12">
            <Field id={ids("titleEn")} label="Tytuł (EN)" hint="Bez tytułu EN angielscy widzowie zobaczą polski." error={err.titleEn}>
              <input className="input" name="titleEn" defaultValue={v.titleEn} maxLength={200} {...describe(ids("titleEn"), err.titleEn, true)} />
            </Field>
          </div>
          <div className="span-6">
            <Field id={ids("description")} label="Opis (PL)" error={err.description}>
              <textarea className="input" name="description" rows={5} defaultValue={v.description} maxLength={5000} {...describe(ids("description"), err.description)} />
            </Field>
          </div>
          <div className="span-6">
            <Field id={ids("descriptionEn")} label="Opis (EN)" error={err.descriptionEn}>
              <textarea className="input" name="descriptionEn" rows={5} defaultValue={v.descriptionEn} maxLength={5000} {...describe(ids("descriptionEn"), err.descriptionEn)} />
            </Field>
          </div>
          <fieldset className="span-12 field fieldset-plain">
            <legend className="field-label">Dostęp</legend>
            <div className="radio-stack">
              <label className="choice">
                <input type="radio" name="tier" value="PUBLIC" defaultChecked={v.tier === "PUBLIC"} /> Publiczny (bez logowania)
              </label>
              <label className="choice">
                <input type="radio" name="tier" value="LOGGED_IN" defaultChecked={v.tier !== "PUBLIC"} /> Po zalogowaniu
              </label>
            </div>
            {err.tier ? <span className="error" role="alert"><Icon name="crit" />{err.tier}</span> : null}
          </fieldset>
        </div>
      </section>

      <section className="card" id="publikacja" aria-labelledby={ids("h-pub")}>
        <div className="card-head">
          <h2 id={ids("h-pub")}>Publikacja i premiera</h2>
        </div>
        <fieldset className="field fieldset-plain">
          <legend className="field-label">Kiedy</legend>
          <div className="radio-stack">
            {published ? null : (
              <label className="choice">
                <input type="radio" name="when" value="draft" checked={when === "draft"} onChange={() => setWhen("draft")} /> Zostaw jako szkic
              </label>
            )}
            <label className="choice">
              <input type="radio" name="when" value="now" checked={when === "now"} onChange={() => setWhen("now")} />
              {published ? " Opublikowany (bez premiery)" : v.hlsReady ? " Opublikuj przy zapisie" : " Opublikuj, gdy kodowanie się skończy"}
            </label>
            <label className="choice">
              <input type="radio" name="when" value="premiere" checked={when === "premiere"} onChange={() => setWhen("premiere")} /> Premiera o wybranej godzinie
            </label>
          </div>
        </fieldset>
        <div className="field-row mt-3">
          <Field id={ids("premiereAt")} label="Data i godzina premiery (czas warszawski)" hint="Przed premierą zalogowani widzą kokpit z odliczaniem, goście ekran logowania. Nowy termin musi być w przyszłości." error={err.premiereAt}>
            <input className="input" type="datetime-local" name="premiereAt" defaultValue={v.premiereLocal} disabled={when !== "premiere"} {...describe(ids("premiereAt"), err.premiereAt, true)} />
          </Field>
        </div>
      </section>

      <section className="card" id="zbiorka" aria-labelledby={ids("h-fund")}>
        <div className="card-head">
          <h2 id={ids("h-fund")}>Pasek zbiórki</h2>
          <p className="sub">Pasek pod tytułem filmu, bez kwot. Ręczny procent ma pierwszeństwo przed celem.</p>
        </div>
        <fieldset className="field fieldset-plain">
          <legend className="field-label">Tryb</legend>
          <div className="radio-stack">
            {(
              [
                ["off", "Bez paska"],
                ["manual", "Procent ustawiony ręcznie"],
                ["goal", "Liczony z napiwków względem celu"],
              ] as const
            ).map(([m, l]) => (
              <label key={m} className="choice">
                <input type="radio" name="fundMode" value={m} checked={fund === m} onChange={() => setFund(m)} /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        {fund === "manual" ? (
          <div className="subgrid">
            <Field id={ids("fundPercent")} label="Wypełnienie (%)" error={err.fundPercent}>
              <input className="input input-narrow" type="number" min={0} max={100} step={1} inputMode="numeric" name="fundPercent" defaultValue={v.fundPercent} {...describe(ids("fundPercent"), err.fundPercent)} />
            </Field>
          </div>
        ) : null}
        {fund === "goal" ? (
          <div className="subgrid">
            <Field id={ids("fundGoal")} label="Cel" error={err.fundGoal}>
              <input className="input" type="text" inputMode="decimal" name="fundGoal" defaultValue={v.fundGoal} placeholder="np. 2000" {...describe(ids("fundGoal"), err.fundGoal)} />
            </Field>
            <Field id={ids("fundCurrency")} label="Waluta">
              <select className="select" name="fundCurrency" id={ids("fundCurrency")} defaultValue={v.fundCurrency || "PLN"}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field id={ids("fundSince")} label="Licz napiwki od" hint="Puste = wszystkie napiwki kanału." error={err.fundSince}>
              <input className="input" type="date" name="fundSince" defaultValue={v.fundSince} {...describe(ids("fundSince"), err.fundSince, true)} />
            </Field>
          </div>
        ) : null}
      </section>

      <section className="card" aria-labelledby={ids("h-exp")}>
        <div className="card-head">
          <h2 id={ids("h-exp")}>Ekspozycja</h2>
          <p className="sub">Tylko dla opublikowanego filmu. Hero musi być publiczny i mieć gotowe wideo. Kolejność: Układ kanału.</p>
        </div>
        <div className="stack-sm">
          <label className="switch">
            <input type="checkbox" name="showInSidebar" defaultChecked={v.showInSidebar} disabled={!published && when === "draft"} /> Na liście filmów
          </label>
          <label className="switch">
            <input type="checkbox" name="isMainFeatured" defaultChecked={v.isMainFeatured} disabled={!published && when === "draft"} /> Hero strony głównej
          </label>
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
            "Zapisuję…"
          ) : (
            "Zmiany trafiają do historii filmu."
          )}
        </span>
        <button type="submit" className="btn btn-primary" aria-disabled={pending}>
          Zapisz zmiany
        </button>
      </div>
    </form>
  );
}
