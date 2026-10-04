"use client";
/**
 * Step-up (re-authentication before a sensitive action, DESIGN-SYSTEM.md 3): passkey (a fresh sign-in)
 * or a TOTP code confirmed on the current session. Valid for 5 minutes. Phase 1 ships the mechanism and
 * this screen; the actions that require it (refunds, broadcasts, exports) come in phase 4.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminAuthClient, panelAuthPost, polishAuthError } from "@admin/lib/auth/client";
import { Icon } from "../icons";
import { OtpInput } from "./otp-input";

export function StepUpCard({ next, secondsLeft }: { next: string; secondsLeft: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "warn" | "crit"; text: string } | null>(
    secondsLeft > 0 ? { kind: "ok", text: `Tożsamość potwierdzona; ważne jeszcze ${Math.ceil(secondsLeft / 60)} min.` } : null,
  );
  const passkeyBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.getElementById("page-title")?.focus();
  }, []);

  function done(how: string) {
    setStatus({ kind: "ok", text: `Tożsamość potwierdzona (${how}). Wracam…` });
    router.replace(next);
    router.refresh();
  }

  async function withPasskey() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await adminAuthClient.signIn.passkey();
      if (res?.error) {
        setStatus({ kind: "warn", text: "code" in res.error && res.error.code ? polishAuthError(res.error.code) : "Klucz nie został przyjęty. Spróbuj ponownie." });
        return;
      }
      done("klucz dostępu");
    } finally {
      setBusy(false);
    }
  }

  async function withTotp(value: string) {
    setBusy(true);
    setStatus(null);
    const r = await panelAuthPost("/step-up/totp", { code: value });
    setBusy(false);
    if (!r.ok) {
      setCode("");
      setStatus({ kind: "crit", text: polishAuthError(r.code) });
      return;
    }
    done("kod TOTP");
  }

  return (
    <div className="stack">
      <div className="passkey-box">
        <Icon name="passkey" />
        <div>
          <strong>Klucz dostępu</strong>
          <div className="muted">Windows Hello, Face ID, telefon albo klucz sprzętowy z PIN-em</div>
        </div>
        <button ref={passkeyBtn} type="button" className="btn btn-primary" onClick={withPasskey} disabled={busy} aria-busy={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          Użyj klucza
        </button>
      </div>
      <div className="field">
        <span className="field-label" id="otp-label">
          albo kod z aplikacji (TOTP)
        </span>
        <OtpInput value={code} onChange={setCode} onComplete={withTotp} invalid={status?.kind === "crit"} labelledBy="otp-label" disabled={busy} />
        <span className="hint">Po 5 błędnych kodach TOTP jest blokowany na 15 minut.</span>
      </div>
      <p className="auth-status" role="status" aria-live="polite">
        {status ? (
          <span className={`state ${status.kind}`}>
            <Icon name={status.kind === "ok" ? "ok" : status.kind === "crit" ? "crit" : "warn"} />
            {status.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}
