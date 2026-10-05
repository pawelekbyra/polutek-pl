"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { adminAuthClient } from "@admin/lib/auth/client";
import { Icon } from "../icons";
import { ToastProvider } from "./toasts";

/** The whole panel a TRANSLATOR sees: a header with the account and sign-out, and the translation screens. */
export function TranslatorShell({ children, name, email, languages }: { children: ReactNode; name: string; email: string; languages: string[] }) {
  const router = useRouter();
  async function signOut() {
    await adminAuthClient.signOut().catch(() => undefined);
    router.push("/logowanie");
  }
  return (
    <ToastProvider>
      <a className="skip-link" href="#main">Przejdź do treści</a>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">PP</div>
          <div className="brand-text"><div className="brand-name">Panel PP · tłumaczenia</div><div className="brand-env">{languages.length ? `języki: ${languages.join(", ")}` : "brak przyznanych języków"}</div></div>
        </div>
        <span className="topbar-spacer" />
        <nav aria-label="Menu tłumacza"><Link className="btn btn-sm btn-ghost" href="/tlumaczenia">Do przetłumaczenia</Link></nav>
        <span className="muted" title={email}>{name}</span>
        <button type="button" className="btn btn-sm" onClick={signOut}><Icon name="logout" />Wyloguj</button>
      </header>
      <main id="main" className="content" tabIndex={-1}>{children}</main>
    </ToastProvider>
  );
}
