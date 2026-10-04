"use client";
/**
 * Enrollment of the administrator from the one-time link printed by `admin-enroll` (token in the URL
 * fragment, never sent to any server except in the redeem request body). Steps: redeem the link ->
 * authenticator app (TOTP, QR + manual key, 10 backup codes) -> passkey -> finish. Resumable: the server
 * tells which steps are already done.
 */
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminAuthClient, panelAuthGet, panelAuthPost, polishAuthError } from "@admin/lib/auth/client";
import { Icon } from "../icons";
import { OtpInput } from "./otp-input";
import { AuthBrand } from "./sign-in-card";

type State = { email: string | null; totp: boolean; passkeys: number; enrolled: boolean };
type Phase = "redeeming" | "no-link" | "steps";

function secretFromUri(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

export function EnrollFlow({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(hasSession ? "steps" : "redeeming");
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totp, setTotp] = useState<{ uri: string; backup: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [codesSaved, setCodesSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const refresh = useCallback(async () => {
    const s = await panelAuthGet<State>("/enrollment/state");
    if (s) setState(s);
    return s;
  }, []);

  const started = useRef(false);
  useEffect(() => {
    heading.current?.focus();
    // Once per mount, also under React StrictMode's double effect: the token works only once.
    if (started.current) return;
    started.current = true;
    const token = hasSession ? null : new URLSearchParams(window.location.hash.slice(1)).get("t");
    // The token must not stay in the address bar, history or a screenshot.
    if (!hasSession) window.history.replaceState(null, "", window.location.pathname);
    (async () => {
      if (!hasSession) {
        const r = token ? await panelAuthPost("/enrollment/redeem", { token }) : ({ ok: false, code: "" } as const);
        if (!r.ok) {
          setError(r.code ? polishAuthError(r.code) : null);
          setPhase("no-link");
          return;
        }
        setPhase("steps");
      }
      const s = await panelAuthGet<State>("/enrollment/state");
      if (s) setState(s);
    })();
  }, [hasSession]);

  async function startTotp() {
    setBusy(true);
    setError(null);
    const res = await adminAuthClient.twoFactor.enable({ issuer: "Panel PP", method: "totp" });
    setBusy(false);
    if (res.error || !res.data || !("totpURI" in res.data)) {
      setError(polishAuthError(res.error?.code));
      return;
    }
    setTotp({ uri: res.data.totpURI, backup: res.data.backupCodes });
  }

  async function verifyTotp(value: string) {
    setBusy(true);
    setError(null);
    const res = await adminAuthClient.twoFactor.verifyTotp({ code: value });
    setBusy(false);
    if (res.error) {
      setCode("");
      setError(polishAuthError(res.error.code ?? "INVALID_CODE"));
      return;
    }
    await refresh();
  }

  async function addPasskey() {
    setBusy(true);
    setError(null);
    const res = await adminAuthClient.passkey.addPasskey({ name: "Klucz rejestracyjny" });
    setBusy(false);
    if (res?.error) {
      const code = "code" in res.error ? res.error.code : null;
      setError(code ? polishAuthError(code) : "Klucz nie został dodany. Spróbuj ponownie albo użyj innego urządzenia.");
      return;
    }
    await refresh();
  }

  async function finish() {
    setBusy(true);
    const r = await panelAuthPost("/enrollment/complete");
    setBusy(false);
    if (!r.ok) {
      setError(polishAuthError(r.code));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const totpDone = !!state?.totp;
  const passkeyDone = (state?.passkeys ?? 0) > 0;
  const current = !totpDone ? 1 : !passkeyDone ? 2 : 3;
  const secret = totp ? secretFromUri(totp.uri) : null;

  return (
    <div className="auth-card">
      <AuthBrand />
      <div>
        <h1 ref={heading} tabIndex={-1}>
          Rejestracja administratora
        </h1>
        <p className="auth-lede">{state?.email ? `Konto: ${state.email}. ` : ""}Trzy kroki, ok. 3 minuty. Link działa raz i 15 minut.</p>
      </div>

      {phase === "redeeming" ? (
        <p className="auth-status" role="status">
          <span className="state info">
            <span className="spinner" aria-hidden="true" />
            Sprawdzam link…
          </span>
        </p>
      ) : null}

      {phase === "no-link" ? (
        <div className="banner warn" role="alert">
          <Icon name="warn" />
          <div className="banner-body">
            <span className="banner-title">{error ?? "Brak linku rejestracji."}</span>
            <span className="text-2">Na serwerze: docker compose --profile admin run --rm admin node apps/admin/scripts/admin-enroll.mjs --email … (z --reset, jeśli konto już istnieje).</span>
          </div>
        </div>
      ) : null}

      {phase === "steps" && state ? (
        <ol className="steps" aria-label="Kroki rejestracji">
          <li className={totpDone ? "is-done" : ""} aria-current={current === 1 ? "step" : undefined}>
            <span className="step-num" aria-hidden="true">{totpDone ? <Icon name="ok" /> : "1"}</span>
            <div className="step-body">
              <span className="step-title">Aplikacja z kodami (TOTP)</span>
              {totpDone ? (
                <span className="muted">Gotowe. Kod z aplikacji potwierdza tożsamość przed groźnymi operacjami.</span>
              ) : !totp ? (
                <>
                  <span className="text-2">Google Authenticator, Aegis, 1Password lub podobna. Służy do ponownego potwierdzenia tożsamości.</span>
                  <button type="button" className="btn btn-primary" onClick={startTotp} disabled={busy}>
                    Pokaż kod QR
                  </button>
                </>
              ) : (
                <>
                  <div className="qr" aria-hidden="true">
                    <QRCodeSVG value={totp.uri} size={164} marginSize={0} level="M" />
                  </div>
                  {secret ? (
                    <div className="field">
                      <span className="field-label">albo wpisz klucz ręcznie</span>
                      <code className="secret">{secret}</code>
                    </div>
                  ) : null}
                  <div className="field">
                    <span className="field-label">Kody zapasowe (każdy działa raz; zapisz je poza komputerem)</span>
                    <ul className="codes" aria-label="Kody zapasowe">
                      {totp.backup.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    <label className="choice">
                      <input type="checkbox" checked={codesSaved} onChange={(e) => setCodesSaved(e.target.checked)} /> Zapisałem kody zapasowe
                    </label>
                  </div>
                  <div className="field">
                    <span className="field-label" id="totp-label">
                      Kod z aplikacji (6 cyfr)
                    </span>
                    <OtpInput value={code} onChange={setCode} onComplete={(v) => codesSaved && verifyTotp(v)} invalid={!!error} labelledBy="totp-label" disabled={busy || !codesSaved} />
                    {!codesSaved ? <span className="hint">Najpierw potwierdź zapisanie kodów zapasowych.</span> : null}
                  </div>
                </>
              )}
            </div>
          </li>
          <li className={passkeyDone ? "is-done" : ""} aria-current={current === 2 ? "step" : undefined}>
            <span className="step-num" aria-hidden="true">{passkeyDone ? <Icon name="ok" /> : "2"}</span>
            <div className="step-body">
              <span className="step-title">Klucz dostępu (passkey)</span>
              {passkeyDone ? (
                <span className="muted">Dodano {state.passkeys === 1 ? "1 klucz" : `${state.passkeys} klucze`}. Drugi (np. telefon) możesz dodać od razu.</span>
              ) : (
                <span className="text-2">Windows Hello, Face ID, telefon albo klucz sprzętowy z PIN-em. Tym kluczem będziesz się logować.</span>
              )}
              {totpDone ? (
                <button type="button" className={`btn${passkeyDone ? "" : " btn-primary"}`} onClick={addPasskey} disabled={busy}>
                  <Icon name="passkey" />
                  {passkeyDone ? "Dodaj kolejny klucz" : "Dodaj klucz dostępu"}
                </button>
              ) : null}
            </div>
          </li>
          <li aria-current={current === 3 ? "step" : undefined}>
            <span className="step-num" aria-hidden="true">3</span>
            <div className="step-body">
              <span className="step-title">Gotowe</span>
              <button type="button" className="btn btn-primary" onClick={finish} disabled={busy || !totpDone || !passkeyDone}>
                Zakończ i otwórz panel
              </button>
            </div>
          </li>
        </ol>
      ) : null}

      <p className="auth-status" role="status" aria-live="polite">
        {error && phase === "steps" ? (
          <span className="state warn">
            <Icon name="warn" />
            {error}
          </span>
        ) : null}
      </p>
    </div>
  );
}
