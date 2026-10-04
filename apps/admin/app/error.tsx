"use client";
import { useEffect } from "react";

/** A screen failed to render (e.g. the database is down). The message names what to check; no stack trace. */
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] render error", error.digest ?? error.name);
  }, [error]);
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div>
          <h1>Ekran się nie wczytał</h1>
          <p className="auth-lede">
            Najczęściej to chwilowy brak połączenia z bazą. Spróbuj ponownie; jeśli to się powtarza, sprawdź kontenery na serwerze (docs/operations/ADMIN-PANEL.md).
          </p>
          {error.digest ? <p className="muted mono">kod zdarzenia: {error.digest}</p> : null}
        </div>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Spróbuj ponownie
        </button>
      </div>
    </main>
  );
}
