"use client";
/**
 * Dialog with a small form (reason, duration, reply text) and the "Skutek" box, for actions that need input
 * before they run. Native <dialog> like ConfirmDialog: focus trap, Esc, backdrop. The first field gets focus,
 * errors come back as one message (role="alert") and the typed values stay.
 */
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { Icon } from "@admin/components/icons";

export function FieldsDialog({
  open,
  title,
  effect,
  confirm,
  danger,
  busy,
  error,
  children,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  effect?: string[];
  confirm: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!busy) onSubmit(new FormData(e.currentTarget));
  };
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose} onClick={(e) => e.target === ref.current && !busy && onClose()}>
      {open ? (
        <form className="modal-form" onSubmit={submit}>
          <div className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose} disabled={busy}>
              <Icon name="close" />
            </button>
          </div>
          <div className="modal-body">
            {children}
            {effect?.length ? (
              <div className="effect">
                <strong>Skutek</strong>
                <ul>
                  {effect.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
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
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Anuluj
            </button>
            <button type="submit" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} aria-disabled={!!busy}>
              {busy ? "Chwila…" : confirm}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
