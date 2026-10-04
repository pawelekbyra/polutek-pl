"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { adminAuthClient, polishAuthError } from "@admin/lib/auth/client";
import { Icon } from "../icons";

export function AuthBrand() {
  return (
    <div className="auth-brand">
      <div className="brand-mark" aria-hidden="true">
        PP
      </div>
      <div>
        <div className="brand-name">Panel PP</div>
        <div className="brand-env">admin.pawelperfect.com</div>
      </div>
    </div>
  );
}

const noSubscribe = () => () => undefined;

function errorCode(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const err = e as { code?: string; message?: string };
  return err.code ?? err.message ?? null;
}

/**
 * Sign-in = a passkey with user verification (Windows Hello, Face ID, phone, security key with PIN).
 * No password, no e-mail link: lost every device -> `admin-enroll --reset` over SSH.
 */
export function SignInCard({ next, expired }: { next: string; expired: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(expired ? "Sesja wygasła po 12 godzinach. Zaloguj się ponownie." : null);
  // WebAuthn support is a fact of the browser: read it without an effect (server render assumes yes).
  const supported = useSyncExternalStore(
    noSubscribe,
    () => "PublicKeyCredential" in window,
    () => true,
  );
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function signIn() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminAuthClient.signIn.passkey();
      if (res?.error) {
        const code = errorCode(res.error);
        setMessage(code === "AUTH_CANCELLED" || code === "ERROR_CEREMONY_ABORTED" ? "Anulowano. Spróbuj ponownie, gdy klucz będzie pod ręką." : polishAuthError(code) ?? "Klucz nie został przyjęty.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (e) {
      setMessage(polishAuthError(errorCode(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <AuthBrand />
      <div>
        <h1 ref={heading} tabIndex={-1}>
          Logowanie
        </h1>
        <p className="auth-lede">Użyj klucza dostępu tego urządzenia albo telefonu. Hasła tu nie ma.</p>
      </div>
      <div className="auth-actions">
        <button type="button" className="btn btn-primary" onClick={signIn} disabled={busy || !supported} aria-busy={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="passkey" />}
          {busy ? "Czekam na klucz…" : "Zaloguj kluczem dostępu"}
        </button>
      </div>
      <p className="auth-status" role="status" aria-live="polite">
        {!supported ? (
          <span className="state warn">
            <Icon name="warn" />
            Ta przeglądarka nie obsługuje kluczy dostępu.
          </span>
        ) : message ? (
          <span className={`state ${expired && !busy ? "info" : "warn"}`}>
            <Icon name={expired ? "info" : "warn"} />
            {message}
          </span>
        ) : null}
      </p>
      <div className="auth-foot">
        <span>Wejście chronią trzy warstwy: Cloudflare Access, klucz dostępu i dziennik logowań.</span>
        <span>Zgubione wszystkie urządzenia? Nowy link wydaje się tylko na serwerze: admin-enroll --reset.</span>
      </div>
    </div>
  );
}
