"use client";
/**
 * Confirmation before a write (DESIGN-SYSTEM.md 3): title, what happens ("Skutek"), and for irreversible
 * operations a typed confirmation (the exact slug or e-mail). Native <dialog>: focus trap, Esc, backdrop.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  effect?: string[];
  confirm: string;
  danger?: boolean;
  /** When set, the confirm button stays disabled until this exact text is typed. */
  typed?: { label: string; expect: string };
};

export function ConfirmDialog({ open, options, busy, error, onConfirm, onClose }: { open: boolean; options: ConfirmOptions | null; busy?: boolean; error?: string | null; onConfirm: (typed: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const inputId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  const close = () => {
    setTyped("");
    onClose();
  };
  if (!options) return <dialog ref={ref} className="modal" />;
  const matches = !options.typed || typed.trim() === options.typed.expect;
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={close} onClick={(e) => e.target === ref.current && !busy && close()}>
      <form
        method="dialog"
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches && !busy) onConfirm(typed.trim());
        }}
      >
        <div className="modal-head">
          <h2 id={titleId}>{options.title}</h2>
          <button type="button" className="icon-btn" aria-label="Zamknij" onClick={close} disabled={busy}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          {options.body ? <div>{options.body}</div> : null}
          {options.effect?.length ? (
            <div className="effect">
              <strong>Skutek</strong>
              <ul>
                {options.effect.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {options.typed ? (
            <div className="field">
              <label htmlFor={inputId}>{options.typed.label}</label>
              <input id={inputId} className="input" type="text" autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} aria-describedby={`${inputId}-hint`} autoFocus />
              <span className="hint" id={`${inputId}-hint`}>
                Wpisz dokładnie: <span className="mono">{options.typed.expect}</span>
              </span>
            </div>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              <Icon name="crit" />
              {error}
            </p>
          ) : null}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={close} disabled={busy}>
            Anuluj
          </button>
          <button type="submit" className={`btn ${options.danger ? "btn-danger" : "btn-primary"}`} aria-disabled={!matches || !!busy} autoFocus={!options.typed}>
            {busy ? "Chwila…" : options.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
