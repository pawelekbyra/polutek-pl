"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createBroadcastAction, sendBroadcastTestAction } from "@admin/app/(panel)/komunikacja/actions";
import { ConfirmDialog } from "@admin/components/confirm-dialog";
import { Field, describe } from "@admin/components/form/field";
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

const STEPS = ["Odbiorcy", "Treść", "Test", "Wysyłka"] as const;

/** Four steps: audience -> PL/EN content -> test to yourself -> confirm (step-up). Creating only queues the mail. */
export function BroadcastWizard({ audience, email }: { audience: number; email: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const requestKey = useMemo(() => crypto.randomUUID(), []);
  const [step, setStep] = useState(0);
  const [c, setC] = useState({ subjectPl: "", htmlPl: "", subjectEn: "", htmlEn: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tested, setTested] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof c) => (e: { target: { value: string } }) => {
    setC((v) => ({ ...v, [k]: e.target.value }));
    setTested(null);
  };

  const contentProblem = () => {
    const e: Record<string, string> = {};
    if (!c.subjectPl.trim()) e.subjectPl = "Podaj temat po polsku.";
    if (!c.htmlPl.trim()) e.htmlPl = "Podaj treść po polsku.";
    if (!!c.subjectEn.trim() !== !!c.htmlEn.trim()) e[c.subjectEn.trim() ? "htmlEn" : "subjectEn"] = "Wersja angielska musi mieć i temat, i treść (albo obie puste).";
    return e;
  };
  const next = () => {
    if (step === 1) {
      const e = contentProblem();
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const sendTest = (language: "pl" | "en") =>
    start(async () => {
      setError(null);
      const res = await sendBroadcastTestAction({ ...c, language });
      if (!res.ok) return setError(res.fieldErrors ? "Popraw treść w kroku 2." : res.message);
      setTested(language);
      toast("ok", res.message ?? "Test wysłany");
    });

  const create = () =>
    start(async () => {
      setError(null);
      const res = await createBroadcastAction({ ...c, requestKey });
      if (!res.ok) {
        if (res.code === "STEP_UP_REQUIRED") return router.push(`/potwierdz?next=${encodeURIComponent("/komunikacja?tab=rozsylki")}`);
        return setError(res.message);
      }
      setConfirm(false);
      toast("ok", res.message ?? "Rozsyłka w kolejce");
      router.push("/komunikacja?tab=rozsylki");
      router.refresh();
    });

  return (
    <section className="card" aria-labelledby="h-wiz">
      <div className="card-head">
        <h2 id="h-wiz">Nowa rozsyłka</h2>
        <ol className="wizard-steps" aria-label="Kroki">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined}>{i + 1}. {s}</li>
          ))}
        </ol>
      </div>

      {step === 0 ? (
        <div className="stack">
          <div className="tiles"><div className="tile"><span className="tile-label">Odbiorcy</span><span className="tile-value">{audience}</span></div></div>
          <p className="text-2">Osoby z kontem, które obserwują kanał i włączyły powiadomienia o nowych treściach, z wyłączeniem adresów zablokowanych po odbiciu albo skardze. Przed wysyłką każdej partii lista jest sprawdzana ponownie, więc kto się wypisał, nie dostanie wiadomości. Każdy mail ma stopkę z wypisem i nagłówek List-Unsubscribe (RFC 8058).</p>
          {audience === 0 ? <p className="form-error" role="alert"><Icon name="crit" />Nie ma odbiorców: nikt nie ma włączonych powiadomień.</p> : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid">
          <div className="span-6"><Field id="b-sub-pl" label="Temat (PL)" error={errors.subjectPl}><input className="input" value={c.subjectPl} onChange={set("subjectPl")} maxLength={200} {...describe("b-sub-pl", errors.subjectPl)} /></Field></div>
          <div className="span-6"><Field id="b-sub-en" label="Temat (EN)" error={errors.subjectEn}><input className="input" value={c.subjectEn} onChange={set("subjectEn")} maxLength={200} {...describe("b-sub-en", errors.subjectEn)} /></Field></div>
          <div className="span-6"><Field id="b-body-pl" label="Treść (PL, HTML)" hint="Zmienne: {{firstName}} {{appUrl}} {{brandName}} {{unsubscribeLink}}" error={errors.htmlPl}><textarea className="input mono" rows={10} value={c.htmlPl} onChange={set("htmlPl")} {...describe("b-body-pl", errors.htmlPl, true)} /></Field></div>
          <div className="span-6"><Field id="b-body-en" label="Treść (EN, HTML)" hint="Bez wersji angielskiej wszyscy dostaną polską." error={errors.htmlEn}><textarea className="input mono" rows={10} value={c.htmlEn} onChange={set("htmlEn")} {...describe("b-body-en", errors.htmlEn, true)} /></Field></div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="stack">
          <p>Test przyjdzie na Twój adres panelu: <strong>{email}</strong>. Składa się tak samo jak prawdziwa rozsyłka (stopka, nagłówki, język), temat dostaje przedrostek [TEST].</p>
          <div className="row">
            <button type="button" className="btn" aria-busy={pending} onClick={() => sendTest("pl")}>Wyślij test (PL)</button>
            {c.subjectEn.trim() ? <button type="button" className="btn" aria-busy={pending} onClick={() => sendTest("en")}>Wyślij test (EN)</button> : null}
          </div>
          {tested ? <p role="status" className="muted"><Icon name="ok" /> Test ({tested.toUpperCase()}) wysłany. Sprawdź skrzynkę, zanim przejdziesz dalej.</p> : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="stack">
          <dl className="kv kv-wide"><dt>Odbiorcy</dt><dd>{audience}</dd><dt>Temat (PL)</dt><dd>{c.subjectPl}</dd><dt>Wersja EN</dt><dd>{c.subjectEn.trim() ? c.subjectEn : "brak: wszyscy dostaną polską"}</dd><dt>Test do siebie</dt><dd>{tested ? "wysłany" : "niewysłany (zalecany)"}</dd></dl>
        </div>
      ) : null}

      {error ? <p className="form-error mt-3" role="alert"><Icon name="crit" />{error}</p> : null}
      <div className="card-foot">
        <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Wstecz</button>
        {step < 3 ? (
          <button type="button" className="btn btn-primary" disabled={step === 0 && audience === 0} onClick={next}>Dalej</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={audience === 0} onClick={() => { setError(null); setConfirm(true); }}>Dalej: potwierdź i wyślij</button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        busy={pending}
        error={error}
        onConfirm={create}
        onClose={() => setConfirm(false)}
        options={{
          title: `Wysłać rozsyłkę do ${audience} osób?`,
          confirm: "Wyślij rozsyłkę",
          danger: true,
          body: "Wymaga potwierdzenia tożsamości z ostatnich 5 minut. Wysłanych maili nie da się cofnąć; trwającą rozsyłkę można anulować w historii.",
          effect: [`${audience} e-maili przez Resend, w partiach przez kolejkę na stronie (limit Resend Free: 100 dziennie, reszta czeka na następny dzień)`, "każdy mail ze stopką wypisu i nagłówkiem List-Unsubscribe", "ponowne kliknięcie nie utworzy drugiej rozsyłki (klucz żądania)", "wpis BROADCAST_CREATED w audycie"],
        }}
      />
    </section>
  );
}
