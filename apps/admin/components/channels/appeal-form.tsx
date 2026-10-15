"use client";
import { resolveAppealAction } from "@admin/app/(panel)/kanaly/actions";
import { Field, describe } from "@admin/components/form/field";
import { FormError, useActionForm } from "@admin/components/form/use-action-form";

/**
 * Decision on one appeal. "Uwzględnij" reverses the effect of the original decision (channel status, video moderation,
 * warning) and writes a NEW decision; "Oddal" only records the reasons. The creator always gets the public reasons.
 */
export function AppealForm({ appealId }: { appealId: string }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(resolveAppealAction);
  // FormData built from the form never carries the clicked submit button, so the outcome travels in a hidden field.
  const decide = (outcome: "UPHELD" | "REJECTED") => {
    const form = formRef.current;
    const field = form?.elements.namedItem("outcome");
    if (!form || !(field instanceof HTMLInputElement)) return;
    field.value = outcome;
    form.requestSubmit();
  };
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <input type="hidden" name="appealId" value={appealId} />
      <input type="hidden" name="outcome" defaultValue="REJECTED" />
      <Field id={`ap-${appealId}`} label="Uzasadnienie dla twórcy (zobaczy je w Studiu i w mailu)" error={errors.reasonPublic}>
        <textarea className="input" name="reasonPublic" rows={3} maxLength={500} required {...describe(`ap-${appealId}`, errors.reasonPublic, true)} />
      </Field>
      <Field id={`api-${appealId}`} label="Notatka wewnętrzna (opcjonalnie, trafia do historii)" error={errors.reasonInternal}>
        <input className="input" name="reasonInternal" maxLength={500} {...describe(`api-${appealId}`, errors.reasonInternal)} />
      </Field>
      <FormError state={state} />
      <div className="card-foot">
        <span className="muted">Uwzględnienie cofa skutek decyzji i zapisuje nową decyzję. Starej decyzji nie da się zmienić.</span>
        <span className="tile-link-row">
          <button type="button" className="btn" aria-busy={pending} onClick={() => decide("REJECTED")}>Oddal</button>
          <button type="button" className="btn btn-primary" aria-busy={pending} onClick={() => decide("UPHELD")}>Uwzględnij</button>
        </span>
      </div>
    </form>
  );
}
