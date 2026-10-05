"use client";
import { savePaymentLimitsAction } from "@admin/app/(panel)/ustawienia/actions";
import { FormError, useActionForm } from "@admin/components/form/use-action-form";

export type CurrencyRow = { currency: string; minAmount: string; maxAmount: number; methods: string };

export function PaymentLimitsForm({ rows }: { rows: CurrencyRow[] }) {
  const { state, pending, errors, onSubmit, formRef } = useActionForm(savePaymentLimitsAction);
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <div className="table-scroll">
        <table className="table responsive">
          <caption className="sr-only">Minimalne kwoty napiwku</caption>
          <thead>
            <tr>
              <th scope="col">Waluta</th>
              <th scope="col" className="num">Minimum</th>
              <th scope="col" className="num hide-sm">Maksimum (stałe)</th>
              <th scope="col" className="hide-sm">Metody</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.currency}>
                <th scope="row" data-label="Waluta"><strong>{r.currency}</strong></th>
                <td data-label="Minimum" className="num">
                  <label className="sr-only" htmlFor={`min-${r.currency}`}>Minimum {r.currency}</label>
                  <input id={`min-${r.currency}`} name={r.currency} className="input input-money" inputMode="decimal" defaultValue={r.minAmount} aria-invalid={errors[r.currency] ? true : undefined} aria-describedby={errors[r.currency] ? `min-${r.currency}-err` : undefined} />
                  {errors[r.currency] ? <div className="error" id={`min-${r.currency}-err`} role="alert">{errors[r.currency]}</div> : null}
                </td>
                <td data-label="Maksimum" className="num hide-sm">{r.maxAmount}</td>
                <td data-label="Metody" className="hide-sm"><span className="muted">{r.methods}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormError state={state} />
      <div className="card-foot">
        <span className="muted">Ta sama kwota jest pokazywana w bramce i sprawdzana na serwerze. Zmiana trafia do audytu (PAYMENT_SETTINGS_UPDATED, przed i po).</span>
        <button type="submit" className="btn btn-primary" aria-busy={pending}>{pending ? "Zapisuję…" : "Zapisz"}</button>
      </div>
    </form>
  );
}
