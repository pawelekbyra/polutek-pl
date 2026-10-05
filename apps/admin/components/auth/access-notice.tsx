import Link from "next/link";
import { ACCESS_LOGOUT_PATH } from "@admin/lib/config";
import { AuthBrand } from "./sign-in-card";

/**
 * Access mode (ADMIN_AUTH_MODE=access): there is no panel login screen, Cloudflare Access is the login.
 * This card is shown only to someone who passed Cloudflare Access but has no panel account, or when the
 * old login/enrollment addresses are opened by habit. Server component, no secrets.
 */
export function AccessNotice({ email, kind }: { email: string | null; kind: "no_account" | "retry" | "legacy" }) {
  const title = kind === "no_account" ? "To konto nie ma dostępu do panelu" : kind === "legacy" ? "Panel loguje się przez Cloudflare" : "Nie udało się potwierdzić logowania";
  const lede =
    kind === "no_account"
      ? `Zalogowano przez Cloudflare Access jako ${email ?? "nieznany adres"}, ale ten adres nie ma konta w panelu. Konta tłumaczy zakłada właściciel.`
      : kind === "legacy"
        ? "Klucze dostępu i rejestracja nie są potrzebne. Wystarczy kod z e-maila, o który prosi Cloudflare przy wejściu na admin.pawelperfect.com."
        : "Cloudflare przepuścił to żądanie, ale panel nie mógł sprawdzić konta (np. baza danych jest chwilowo niedostępna). Spróbuj za chwilę.";
  return (
    <section className="auth-card" aria-labelledby="page-title">
      <AuthBrand />
      <div>
        <h1 id="page-title" tabIndex={-1}>{title}</h1>
        <p className="auth-lede">{lede}</p>
      </div>
      <div className="auth-actions">
        <Link className="btn btn-primary" href="/">Wróć do panelu</Link>
        <a className="btn" href={ACCESS_LOGOUT_PATH}>Wyloguj z Cloudflare i zaloguj innym adresem</a>
      </div>
    </section>
  );
}
