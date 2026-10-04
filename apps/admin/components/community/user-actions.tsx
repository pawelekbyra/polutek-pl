"use client";
/**
 * Role on the site and account deletion for one person. Both need a fresh step-up (the server says
 * STEP_UP_REQUIRED and we go to /potwierdz); deletion also needs the account's e-mail typed back.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeRoleAction, deleteUserAction } from "@admin/app/(panel)/spolecznosc/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function UserActions({ userId, email, name, role, deleted }: { userId: string; email: string; name: string; role: string; deleted: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState<"role" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const back = `/spolecznosc/osoby/${userId}`;
  const nextRole = role === "ADMIN" ? "USER" : "ADMIN";

  const confirm = (typed: string) =>
    start(async () => {
      const res = open === "role" ? await changeRoleAction({ userId, role: nextRole }) : await deleteUserAction({ userId, confirmEmail: typed });
      if (res && !res.ok) {
        if (res.code === "STEP_UP_REQUIRED") return router.push(`/potwierdz?next=${encodeURIComponent(back)}`);
        return setError(res.message);
      }
      setOpen(null);
      toast("ok", res?.message ?? "Zapisano");
      router.refresh();
    });

  if (deleted) return <p className="muted">Konto usunięte i zanonimizowane: brak akcji.</p>;
  return (
    <>
      <ul className="list danger-list">
        <li>
          <div className="li-main">
            <span className="li-title">Rola na stronie: {role === "ADMIN" ? "administrator" : "użytkownik"}</span>
            <span className="li-sub">dotyczy starego /admin i odznaki na stronie, nie logowania do tego panelu</span>
          </div>
          <button type="button" className="btn" onClick={() => { setError(null); setOpen("role"); }}>
            {role === "ADMIN" ? "Odbierz rolę…" : "Nadaj rolę administratora…"}
          </button>
        </li>
        <li>
          <div className="li-main">
            <span className="li-title">Usuń i zanonimizuj konto</span>
            <span className="li-sub">pseudonim, e-mail i awatar znikają; wpłaty zostają bez danych osobowych</span>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => { setError(null); setOpen("delete"); }} disabled={role === "ADMIN"} title={role === "ADMIN" ? "Najpierw odbierz rolę administratora" : undefined}>
            <Icon name="trash" />
            Usuń…
          </button>
        </li>
      </ul>
      <ConfirmDialog
        open={!!open}
        options={
          open === "role"
            ? { title: nextRole === "ADMIN" ? `Nadać ${name} rolę administratora strony?` : `Odebrać ${name} rolę administratora strony?`, confirm: nextRole === "ADMIN" ? "Nadaj rolę" : "Odbierz rolę", body: "Wymaga potwierdzenia tożsamości z ostatnich 5 minut.", effect: ["zmiana od razu, przy następnym żądaniu tej osoby", "wpis ADMIN_USER_ROLE_CHANGED w audycie", "ostatniemu administratorowi nie da się odebrać roli"] }
            : open === "delete"
              ? { title: `Usunąć konto ${name}?`, confirm: "Usuń konto", danger: true, body: "Nieodwracalne. Wymaga potwierdzenia tożsamości z ostatnich 5 minut.", effect: ["wylogowanie ze wszystkich urządzeń, usunięcie logowań i 2FA", "komentarze zostają z podpisem „usunięte konto”", "wpłaty zostają w księgowości bez danych osobowych", "wpis ADMIN_USER_DELETED w audycie"], typed: { label: "Wpisz adres e-mail konta", expect: email } }
              : null
        }
        busy={pending}
        error={error}
        onConfirm={confirm}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
