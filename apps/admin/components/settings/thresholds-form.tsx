"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetThresholdsAction, saveThresholdsAction } from "@admin/app/(panel)/ustawienia/actions";
import { FormError, useActionForm } from "@admin/components/form/use-action-form";
import { useToast } from "@admin/components/shell/toasts";

export type ThresholdRow = { key: string; label: string; hint: string; warnAt: number; critAt: number };

export function ThresholdsForm({ rows, custom }: { rows: ThresholdRow[]; custom: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { state, pending, errors, onSubmit, formRef } = useActionForm(saveThresholdsAction);
  const [resetting, startReset] = useTransition();
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <div className="stack">
        {rows.map((r) => (
          <fieldset key={r.key} className="field fieldset-plain">
            <legend className="field-label">{r.label} <span className="muted">({r.hint})</span></legend>
            <div className="field-row">
              {(["warnAt", "critAt"] as const).map((k) => {
                const name = `${r.key}.${k}`;
                return (
                  <div key={k} className="field">
                    <label htmlFor={`t-${name}`}>{k === "warnAt" ? "Ostrzeżenie od (%)" : "Błąd od (%)"}</label>
                    <input id={`t-${name}`} name={name} className="input input-pct" inputMode="numeric" defaultValue={String(r[k])} aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? `t-${name}-err` : undefined} />
                    {errors[name] ? <span className="error" id={`t-${name}-err`} role="alert">{errors[name]}</span> : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <FormError state={state} />
      <div className="card-foot">
        <span className="muted">Progi sterują kolorem kropki zdrowia, Centrum zdrowia i limitów w „Dzisiaj”. Zapis trafia do audytu (przed i po).</span>
        <div className="row">
          {custom ? (
            <button
              type="button"
              className="btn btn-ghost"
              aria-busy={resetting}
              onClick={() =>
                startReset(async () => {
                  const res = await resetThresholdsAction();
                  toast(res.ok ? "ok" : "crit", res.ok ? (res.message ?? "Zapisano") : res.message);
                  if (res.ok) router.refresh();
                })
              }
            >
              Przywróć domyślne
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary" aria-busy={pending}>{pending ? "Zapisuję…" : "Zapisz"}</button>
        </div>
      </div>
    </form>
  );
}
