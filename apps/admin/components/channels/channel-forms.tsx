"use client";
import {
  issueStrikeAction,
  resolveReportAction,
  revokeStrikeAction,
  setChannelStatusAction,
  setTrustLevelAction,
} from "@admin/app/(panel)/kanaly/actions";
import { Field, describe } from "@admin/components/form/field";
import { FormError, useActionForm } from "@admin/components/form/use-action-form";

const STATUS_CHOICES: [string, string][] = [
  ["ACTIVE", "Aktywny (publiczny, pełne możliwości)"],
  ["LIMITED", "Ograniczony (publiczny, bez dodawania filmów)"],
  ["SUSPENDED", "Zawieszony (ukryty, wymaga potwierdzenia tożsamości)"],
  ["BANNED", "Zablokowany (ukryty, wymaga potwierdzenia tożsamości)"],
];

export function StatusForm({ channelId, status, isPrimary }: { channelId: string; status: string; isPrimary: boolean }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(setChannelStatusAction, { returnTo: `/kanaly/${channelId}` });
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <input type="hidden" name="channelId" value={channelId} />
      <Field id="s-status" label="Nowy status" error={errors.status}>
        <select className="input" name="status" defaultValue={status === "PENDING_REVIEW" ? "ACTIVE" : status} {...describe("s-status", errors.status)}>
          {STATUS_CHOICES.filter(([v]) => !(isPrimary && (v === "SUSPENDED" || v === "BANNED"))).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field id="s-reason" label="Powód (wewnętrzny, trafia do audytu)" error={errors.reason}>
        <textarea className="input" name="reason" rows={3} maxLength={500} required {...describe("s-reason", errors.reason, true)} />
      </Field>
      <Field id="s-public" label="Komunikat dla twórcy (opcjonalnie)" hint="Jeśli puste, twórca zobaczy powód wewnętrzny." error={errors.reasonPublic}>
        <textarea className="input" name="reasonPublic" rows={2} maxLength={500} {...describe("s-public", errors.reasonPublic, true)} />
      </Field>
      <FormError state={state} />
      <div className="card-foot">
        <span className="muted">Decyzja zapisuje się w historii moderacji i w audycie.</span>
        <button type="submit" className="btn btn-primary" aria-busy={pending}>{pending ? "Zapisuję…" : "Zmień status"}</button>
      </div>
    </form>
  );
}

export function TrustForm({ channelId, level }: { channelId: string; level: number }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(setTrustLevelAction);
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <input type="hidden" name="channelId" value={channelId} />
      <Field id="t-level" label="Poziom zaufania" hint="Wyższy poziom = większe limity wgrywania i miejsca." error={errors.trustLevel}>
        <select className="input" name="trustLevel" defaultValue={String(level)} {...describe("t-level", errors.trustLevel)}>
          <option value="0">0 - nowy kanał</option>
          <option value="1">1 - zaufany</option>
          <option value="2">2 - partner</option>
        </select>
      </Field>
      <FormError state={state} />
      <div className="card-foot">
        <span />
        <button type="submit" className="btn" aria-busy={pending}>{pending ? "Zapisuję…" : "Zapisz poziom"}</button>
      </div>
    </form>
  );
}

export function StrikeForm({ channelId }: { channelId: string }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(issueStrikeAction, { onOk: () => undefined });
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <input type="hidden" name="channelId" value={channelId} />
      <div className="grid">
        <div className="span-6">
          <Field id="k-policy" label="Naruszona zasada" error={errors.policy}>
            <input className="input" name="policy" maxLength={80} required {...describe("k-policy", errors.policy)} />
          </Field>
        </div>
        <div className="span-6">
          <Field id="k-days" label="Ważne (dni)" error={errors.expiresInDays}>
            <input className="input" name="expiresInDays" type="number" min={1} max={365} defaultValue={90} {...describe("k-days", errors.expiresInDays)} />
          </Field>
        </div>
        <div className="span-12">
          <Field id="k-reason" label="Powód" error={errors.reason}>
            <textarea className="input" name="reason" rows={2} maxLength={500} required {...describe("k-reason", errors.reason, true)} />
          </Field>
        </div>
      </div>
      <FormError state={state} />
      <div className="card-foot">
        <span />
        <button type="submit" className="btn" aria-busy={pending}>{pending ? "Zapisuję…" : "Nałóż ostrzeżenie"}</button>
      </div>
    </form>
  );
}

export function RevokeStrikeForm({ channelId, strikeId }: { channelId: string; strikeId: string }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(revokeStrikeAction);
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="tile-link-row">
      <input type="hidden" name="channelId" value={channelId} />
      <input type="hidden" name="strikeId" value={strikeId} />
      <input className="input" name="reason" placeholder="Powód cofnięcia" maxLength={500} aria-label="Powód cofnięcia ostrzeżenia" {...describe(`r-${strikeId}`, errors.reason)} />
      <button type="submit" className="btn btn-sm" aria-busy={pending}>{pending ? "…" : "Cofnij"}</button>
      <FormError state={state} />
    </form>
  );
}

export function ReportForm({ reportId, canRemoveVideo }: { reportId: string; canRemoveVideo: boolean }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(resolveReportAction);
  // FormData built from the form never carries the clicked submit button, so the outcome travels in a hidden field.
  const decide = (outcome: "DISMISSED" | "ACTION_TAKEN") => {
    const form = formRef.current;
    const field = form?.elements.namedItem("outcome");
    if (!form || !(field instanceof HTMLInputElement)) return;
    field.value = outcome;
    form.requestSubmit();
  };
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="outcome" defaultValue="DISMISSED" />
      <Field id={`d-${reportId}`} label="Uzasadnienie decyzji (widoczne dla twórcy)" error={errors.reasonPublic}>
        <textarea className="input" name="reasonPublic" rows={2} maxLength={500} required {...describe(`d-${reportId}`, errors.reasonPublic, true)} />
      </Field>
      <Field id={`n-${reportId}`} label="Notatka wewnętrzna (opcjonalnie)" error={errors.reasonInternal}>
        <input className="input" name="reasonInternal" maxLength={500} {...describe(`n-${reportId}`, errors.reasonInternal)} />
      </Field>
      {canRemoveVideo ? (
        <label className="check">
          <input type="checkbox" name="removeVideo" /> Ukryj film (status „usunięty przez moderację”)
        </label>
      ) : null}
      <FormError state={state} />
      <div className="card-foot">
        <span />
        <span className="tile-link-row">
          <button type="button" className="btn" aria-busy={pending} onClick={() => decide("DISMISSED")}>Oddal</button>
          <button type="button" className="btn btn-primary" aria-busy={pending} onClick={() => decide("ACTION_TAKEN")}>Uznaj zgłoszenie</button>
        </span>
      </div>
    </form>
  );
}
