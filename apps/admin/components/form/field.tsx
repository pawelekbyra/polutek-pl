import type { ReactNode } from "react";
import { Icon } from "@admin/components/icons";

/** Label + control + hint + error (DESIGN-SYSTEM.md "Pole"): the error is announced and wired with aria-describedby. */
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
