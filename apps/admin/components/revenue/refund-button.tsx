"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { refundAction } from "@admin/app/(panel)/przychody/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { Field } from "@admin/components/form/field";
import { useToast } from "@admin/components/shell/toasts";

export type RefundTarget = { id: string; email: string; currency: string; amountLabel: string; leftMinor: number; leftLabel: string };

/** "Zwrot…": amount (full or partial), reason, effect box; the idempotency key is born when the dialog opens. */
export function RefundButton({ target, returnTo }: { target: RefundTarget; returnTo: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<"requested_by_customer" | "duplicate" | "fraudulent">("requested_by_customer");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openDialog = () => {
    setKey(crypto.randomUUID());
    setErrors({});
    setError(null);
    setOpen(true);
  };
  const confirm = () =>
    start(async () => {
      setError(null);
      const res = await refundAction({ paymentId: target.id, mode, amount: mode === "partial" ? amount : undefined, stripeReason: reason, note, idempotencyKey: key });
      if (!res.ok) {
        if (res.code === "STEP_UP_REQUIRED") return router.push(`/potwierdz?next=${encodeURIComponent(returnTo)}`);
        setErrors(res.fieldErrors ?? {});
        return setError(res.fieldErrors ? "Popraw zaznaczone pola." : res.message);
      }
      setOpen(false);
      toast("ok", res.message ?? "Zwrot zlecony");
      router.refresh();
    });

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={openDialog} aria-label={`Zwrot wpłaty ${target.amountLabel} od ${target.email}`}>
        Zwrot…
      </button>
      <ConfirmDialog
        open={open}
        busy={pending}
        error={error}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
        options={{
          title: `Zwrot wpłaty ${target.amountLabel}`,
          confirm: "Zwróć pieniądze",
          danger: true,
          body: (
            <div className="stack-sm">
              <p>Wpłata od <strong>{target.email}</strong>. Do zwrotu zostało {target.leftLabel}. Wymaga potwierdzenia tożsamości z ostatnich 5 minut.</p>
              <fieldset className="field fieldset-plain">
                <legend className="field-label">Zakres</legend>
                <label className="choice"><input type="radio" name={`${uid}-mode`} checked={mode === "full"} onChange={() => setMode("full")} /> Cała pozostała kwota ({target.leftLabel})</label>
                <label className="choice"><input type="radio" name={`${uid}-mode`} checked={mode === "partial"} onChange={() => setMode("partial")} /> Część kwoty</label>
              </fieldset>
              {mode === "partial" ? (
                <Field id={`${uid}-amount`} label={`Kwota zwrotu (${target.currency})`} error={errors.amount}>
                  <input id={`${uid}-amount`} className="input input-money" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={errors.amount ? true : undefined} />
                </Field>
              ) : null}
              <Field id={`${uid}-reason`} label="Powód w Stripe">
                <select id={`${uid}-reason`} className="select" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                  <option value="requested_by_customer">Prośba wspierającego</option>
                  <option value="duplicate">Duplikat</option>
                  <option value="fraudulent">Oszustwo</option>
                </select>
              </Field>
              <Field id={`${uid}-note`} label="Opis powodu (do audytu)" error={errors.note}>
                <textarea id={`${uid}-note`} className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-invalid={errors.note ? true : undefined} />
              </Field>
            </div>
          ),
          effect: ["pieniądze wracają na kartę lub konto płatnika; Stripe nie zwraca swojej opłaty", "licznik wpłat osoby maleje; przy pełnym zwrocie znika znacznik wspierającego, jeśli nie ma innych wpłat", "wpis PAYMENT_REFUNDED w audycie (kwota, powód, stan przed i po)", "ponowne kliknięcie nie zwróci drugi raz (klucz idempotencji)"],
        }}
      />
    </>
  );
}
