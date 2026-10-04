import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <div>
          <h1>Nie ma takiej strony</h1>
          <p className="auth-lede">Adres mógł się zmienić. Wszystkie moduły są w nawigacji panelu.</p>
        </div>
        <Link className="btn btn-primary" href="/">
          Wróć do „Dzisiaj”
        </Link>
      </div>
    </main>
  );
}
