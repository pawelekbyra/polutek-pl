"use client";
import { saveChannelAction } from "@admin/app/(panel)/ustawienia/actions";
import { Field, describe } from "@admin/components/form/field";
import { FormError, useActionForm } from "@admin/components/form/use-action-form";

export function ChannelForm({ name, slug, bio }: { name: string; slug: string; bio: string }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(saveChannelAction);
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <div className="grid">
        <div className="span-6">
          <Field id="c-name" label="Nazwa kanału" error={errors.name}>
            <input className="input" name="name" defaultValue={name} required maxLength={80} {...describe("c-name", errors.name)} />
          </Field>
        </div>
        <div className="span-6">
          <Field id="c-slug" label="Adres kanału" hint="Klucz w bazie i konfiguracji; zmienia się tylko migracją.">
            <input className="input mono" id="c-slug" value={slug} disabled readOnly aria-describedby="c-slug-hint" />
          </Field>
        </div>
        <div className="span-12">
          <Field id="c-bio" label="Opis kanału" hint="Pokazywany na stronie kanału. Opisu po angielsku w bazie nie ma, więc angielscy widzowie widzą ten sam tekst." error={errors.bio}>
            <textarea className="input" name="bio" rows={4} defaultValue={bio} maxLength={1000} {...describe("c-bio", errors.bio, true)} />
          </Field>
        </div>
      </div>
      <FormError state={state} />
      <div className="card-foot">
        <span className="muted">Zmiana trafia do audytu (CHANNEL_UPDATED, z wartościami przed i po).</span>
        <button type="submit" className="btn btn-primary" aria-busy={pending}>
          {pending ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>
    </form>
  );
}
