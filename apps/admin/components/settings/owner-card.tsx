"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeChannelOwnerAction, lookupChannelOwnerAction } from "@admin/app/(panel)/ustawienia/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { Field } from "@admin/components/form/field";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

type Candidate = { id: string; email: string; name: string | null };

/** "Konto kanału": search an account by e-mail or nickname, confirm by retyping the e-mail, step-up, reason. */
export function ChannelOwnerCard({ owner }: { owner: Candidate | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Candidate[] | null>(null);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const search = () =>
    start(async () => {
      setError(null);
      const res = await lookupChannelOwnerAction({ query });
      if (!res.ok) return setError(res.message);
      setFound(res.data?.candidates ?? []);
    });

  const confirm = (typed: string) =>
    start(async () => {
      if (!chosen) return;
      const res = await changeChannelOwnerAction({ userId: chosen.id, typedEmail: typed, reason });
      if (!res.ok) {
        if (res.code === "STEP_UP_REQUIRED") return router.push(`/potwierdz?next=${encodeURIComponent("/ustawienia")}`);
        return setError(res.fieldErrors?.reason ?? res.message);
      }
      setChosen(null);
      setOpen(false);
      toast("ok", res.message ?? "Zapisano");
      router.refresh();
    });

  return (
    <section className="card" aria-labelledby="h-own">
      <div className="card-head">
        <h2 id="h-own">Konto kanału</h2>
        <p className="sub">Konto na stronie, które jest „Twórcą” (odznaka przy komentarzach, odpowiedzi twórcy).</p>
      </div>
      {owner ? (
        <div className="row">
          <span className="avatar" aria-hidden="true">{(owner.name ?? owner.email).slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{owner.name ?? "bez pseudonimu"}</strong>
            <div className="muted">{owner.email}</div>
          </div>
        </div>
      ) : (
        <p className="muted">Nie udało się wczytać konta właściciela kanału.</p>
      )}
      {open ? (
        <div className="stack mt-3">
          <div className="search-row">
            <Field id="own-q" label="Szukaj konta (e-mail albo pseudonim)">
              <input id="own-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} autoComplete="off" />
            </Field>
            <button type="button" className="btn" onClick={search} aria-busy={pending}>
              <Icon name="search" />
              Szukaj
            </button>
          </div>
          {found && found.length === 0 ? <p className="muted">Nic nie znaleziono.</p> : null}
          {found?.length ? (
            <ul className="list" aria-label="Znalezione konta">
              {found.map((c) => (
                <li key={c.id}>
                  <div className="li-main">
                    <span className="li-title">{c.name ?? "bez pseudonimu"}</span>
                    <span className="li-sub">{c.email}</span>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setChosen(c)}>
                    Wybierz
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {error && !chosen ? <p className="form-error" role="alert"><Icon name="crit" />{error}</p> : null}
        </div>
      ) : null}
      <div className="card-foot">
        <span className="muted">Wymaga potwierdzenia tożsamości z ostatnich 5 minut.</span>
        <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Zamknij" : "Zmień konto…"}
        </button>
      </div>
      <ConfirmDialog
        open={!!chosen}
        options={chosen ? {
          title: "Zmienić konto kanału?",
          confirm: "Zmień konto kanału",
          danger: true,
          body: (
            <>
              <p>Nowe konto kanału: <strong>{chosen.email}</strong>.</p>
              <div className="field">
                <label htmlFor="own-reason">Powód zmiany</label>
                <input id="own-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
              </div>
            </>
          ),
          effect: ["odznaka twórcy i odpowiedzi twórcy przechodzą na to konto", "dotychczasowe konto traci odznakę twórcy", "wpis CHANNEL_OWNER_CHANGED w audycie (stare i nowe konto, powód)"],
          typed: { label: "Wpisz e-mail nowego konta", expect: chosen.email },
        } : null}
        busy={pending}
        error={error}
        onConfirm={confirm}
        onClose={() => { setChosen(null); setError(null); }}
      />
    </section>
  );
}
