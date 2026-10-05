"use client";
/**
 * Actions on one person (profile 360): view as person (read only), supporter marker, role, mute, sign out
 * everywhere, and the account deletion zone. Role and deletion need a fresh step-up (the server answers
 * STEP_UP_REQUIRED and we go to /potwierdz and come back); deletion also needs the e-mail typed back and lists
 * what disappears. Reasons are required where the server requires them and are stored in the audit.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeRoleAction, deleteUserAction, muteUserAction, revokeSessionsAction, setSupporterAction, unmuteUserAction, viewAsPersonAction } from "@admin/app/(panel)/spolecznosc/user-actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { FieldsDialog } from "@admin/components/community/fields-dialog";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";
import { Badge } from "@admin/components/badge";
import type { AccessExplanation } from "@/lib/modules/admin-community";

export type PersonProps = {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  isDeleted: boolean;
  isSupporter: boolean;
  muted: boolean;
  sessions: number;
  impact: { comments: number; payments: number; activeGrants: number; sessions: number };
};

type Dialog = "supporter" | "role" | "mute" | "signout" | "view" | "delete" | null;

export function ProfileActions(p: PersonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AccessExplanation | null>(null);
  const [pending, start] = useTransition();
  const back = `/spolecznosc/u/${p.userId}`;
  const nextRole = p.role === "ADMIN" ? "USER" : "ADMIN";
  const show = (d: Dialog) => {
    setError(null);
    setOpen(d);
  };

  /** Runs one action; STEP_UP_REQUIRED goes to the confirmation screen, an error stays in the dialog. */
  const exec = (fn: () => Promise<{ ok: boolean; message?: string; code?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        if (res.code === "STEP_UP_REQUIRED") return router.push(`/potwierdz?next=${encodeURIComponent(back)}`);
        return setError(res.message ?? "Nie udało się.");
      }
      setOpen(null);
      toast("ok", res.message ?? "Zapisano", "Zapisano w dzienniku audytu.");
      router.refresh();
    });

  const openView = () => {
    show("view");
    setView(null);
    start(async () => {
      const res = await viewAsPersonAction({ userId: p.userId });
      if (res.ok && res.data) setView(res.data);
      else setError(res.ok ? "Brak danych." : res.message);
    });
  };

  if (p.isDeleted) return <p className="muted">Konto usunięte i zanonimizowane: brak akcji.</p>;
  return (
    <>
      <div className="row action-row">
        <button type="button" className="btn" onClick={openView}><Icon name="eye" />Podgląd jako ta osoba</button>
        <button type="button" className="btn" onClick={() => show("supporter")}><Icon name="heart" />Znacznik wspierającego…</button>
        <button type="button" className="btn" onClick={() => show("role")}><Icon name="shield" />Rola…</button>
        {p.muted ? (
          <button type="button" className="btn" aria-disabled={pending} onClick={() => exec(() => unmuteUserAction({ userId: p.userId }))}>Zdejmij wyciszenie</button>
        ) : (
          <button type="button" className="btn" disabled={p.role === "ADMIN"} onClick={() => show("mute")}><Icon name="mute" />Wycisz komentowanie…</button>
        )}
        <button type="button" className="btn" onClick={() => show("signout")}><Icon name="logout" />Wyloguj wszędzie</button>
      </div>

      <FieldsDialog open={open === "supporter"} title="Znacznik wspierającego" confirm={p.isSupporter ? "Cofnij znacznik" : "Nadaj znacznik"} danger={false} busy={pending} error={error} onClose={() => setOpen(null)}
        onSubmit={(fd) => exec(() => setSupporterAction({ userId: p.userId, action: String(fd.get("action")) as "grant" | "revoke", reason: String(fd.get("reason") ?? "") }))}
        effect={["to tylko notatka widoczna dla administratora: nie daje dostępu ani odznaki na stronie", "cofnięcie kończy WSZYSTKIE aktywne znaczniki tej osoby, także ten z napiwku", "powód zapisany przy znaczniku i w audycie"]}>
        <fieldset className="field radio-stack">
          <legend className="field-label">Co zrobić</legend>
          <label className="choice"><input type="radio" name="action" value="grant" defaultChecked={!p.isSupporter} /> Nadaj znacznik</label>
          <label className="choice"><input type="radio" name="action" value="revoke" defaultChecked={p.isSupporter} /> Cofnij znacznik</label>
        </fieldset>
        <div className="field">
          <label htmlFor="sup-reason">Powód</label>
          <input id="sup-reason" name="reason" className="input" required minLength={3} maxLength={300} placeholder="np. wsparcie przelewem poza stroną" />
        </div>
      </FieldsDialog>

      <ConfirmDialog open={open === "role"} busy={pending} error={error} onClose={() => setOpen(null)} onConfirm={() => exec(() => changeRoleAction({ userId: p.userId, role: nextRole }))}
        options={{ title: nextRole === "ADMIN" ? `Nadać ${p.name} rolę administratora strony?` : `Odebrać ${p.name} rolę administratora strony?`, confirm: nextRole === "ADMIN" ? "Nadaj rolę" : "Odbierz rolę", body: "Wymaga potwierdzenia tożsamości z ostatnich 5 minut. Rola dotyczy konta na stronie, nie logowania do tego panelu.", effect: ["zmiana od razu, przy następnym żądaniu tej osoby", "wpis ADMIN_USER_ROLE_CHANGED w audycie", "ostatniemu administratorowi nie da się odebrać roli"] }} />

      <FieldsDialog open={open === "mute"} title={`Wyciszyć komentowanie: ${p.name}?`} confirm="Wycisz" busy={pending} error={error} onClose={() => setOpen(null)}
        onSubmit={(fd) => exec(() => muteUserAction({ userId: p.userId, days: Number(fd.get("days")), reason: String(fd.get("reason") ?? "") }))}
        effect={["osoba nadal czyta i reaguje, ale nie doda nowych komentarzy", "po upływie czasu komentowanie wraca samo", "zdejmiesz wyciszenie tutaj w każdej chwili"]}>
        <div className="field">
          <label htmlFor="pm-days">Na jak długo</label>
          <select id="pm-days" name="days" className="select" defaultValue="7"><option value="1">1 dzień</option><option value="7">7 dni</option><option value="30">30 dni</option><option value="365">rok</option></select>
        </div>
        <div className="field">
          <label htmlFor="pm-reason">Powód</label>
          <input id="pm-reason" name="reason" className="input" required minLength={3} maxLength={300} />
        </div>
      </FieldsDialog>

      <ConfirmDialog open={open === "signout"} busy={pending} error={error} onClose={() => setOpen(null)} onConfirm={() => exec(() => revokeSessionsAction({ userId: p.userId }))}
        options={{ title: `Wylogować ${p.name} ze wszystkich urządzeń?`, confirm: "Wyloguj wszędzie", effect: [`kończy ${p.sessions} aktywnych sesji`, "osoba zaloguje się ponownie, jeśli zechce", "otwarta karta może działać jeszcze do minuty (pamięć podręczna sesji)", "wpis ADMIN_USER_SESSIONS_REVOKED w audycie"] }} />

      <ViewAs open={open === "view"} data={view} error={error} busy={pending} name={p.name} onClose={() => setOpen(null)} />

      <ul className="list danger-list mt-3" aria-label="Strefa zagrożenia">
        <li>
          <div className="li-main">
            <span className="li-title">Usuń i zanonimizuj konto</span>
            <span className="li-sub">pseudonim, e-mail i awatar znikają; wpłaty zostają w księgowości bez danych osobowych</span>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => show("delete")} disabled={p.role === "ADMIN"} title={p.role === "ADMIN" ? "Najpierw odbierz rolę administratora" : undefined}>
            <Icon name="trash" />Usuń…
          </button>
        </li>
      </ul>
      <ConfirmDialog open={open === "delete"} busy={pending} error={error} onClose={() => setOpen(null)} onConfirm={(typed) => exec(() => deleteUserAction({ userId: p.userId, confirmEmail: typed }))}
        options={{ title: `Usunąć konto ${p.name}?`, confirm: "Usuń konto", danger: true, body: "Nieodwracalne. Wymaga potwierdzenia tożsamości z ostatnich 5 minut.", typed: { label: "Wpisz adres e-mail konta", expect: p.email },
          effect: [`wylogowanie z ${p.impact.sessions} sesji, usunięcie logowań, kluczy i 2FA`, `${p.impact.comments} komentarzy zostaje z podpisem „usunięte konto”, ich treść jest kasowana`, `${p.impact.payments} wpłat zostaje w księgowości bez danych osobowych`, p.impact.activeGrants ? "znacznik wspierającego jest kończony" : "brak aktywnego znacznika wspierającego", "e-mail i subskrypcje są usuwane, historia rozsyłek traci adres", "wpis ADMIN_USER_DELETED w audycie (tylko identyfikatory)"] }} />
    </>
  );
}

function ViewAs({ open, data, error, busy, name, onClose }: { open: boolean; data: AccessExplanation | null; error: string | null; busy: boolean; name: string; onClose: () => void }) {
  return (
    <FieldsDialog open={open} title={`Podgląd jako ${name} (tylko odczyt)`} confirm="Zamknij" busy={false} error={error} onClose={onClose} onSubmit={onClose}>
      {!data && busy ? <p className="muted" role="status">Liczę dostęp…</p> : null}
      {data ? (
        <>
          <p className="text-2">Nic nie jest zmieniane i nie powstaje sesja tej osoby. To wyliczenie według zasad strony; otwarcie zapisało wpis ADMIN_VIEW_AS w audycie.</p>
          <dl className="kv">
            <dt>Logowanie</dt><dd><Badge kind={data.signIn.ok ? "ok" : "crit"}>{data.signIn.ok ? "możliwe" : "niemożliwe"}</Badge> {data.signIn.why}</dd>
            <dt>Komentowanie</dt><dd><Badge kind={data.commenting.ok ? "ok" : "warn"}>{data.commenting.ok ? "tak" : "nie"}</Badge> {data.commenting.why}</dd>
          </dl>
          <div className="table-scroll">
            <table className="table table-compact">
              <caption className="sr-only">Dostęp do filmów</caption>
              <thead><tr><th scope="col">Film</th><th scope="col">Poziom</th><th scope="col">Widzi?</th></tr></thead>
              <tbody>
                {data.films.map((f) => (
                  <tr key={f.videoId}><td className="wrap">{f.title}</td><td>{f.tier === "PUBLIC" ? "publiczny" : "dla zalogowanych"}</td><td><Badge kind={f.canWatch ? "ok" : "crit"} icon={false}>{f.canWatch ? "tak" : "nie"}</Badge><span className="sr-only"> {f.why}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </FieldsDialog>
  );
}
