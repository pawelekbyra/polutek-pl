import Link from "next/link";

const TABS = [
  ["przeglad", "Przegląd", ""],
  ["edycja", "Edycja", "/edycja"],
  ["tlumaczenia", "Tłumaczenia", "/tlumaczenia"],
  ["komentarze", "Komentarze", "/komentarze"],
  ["analityka", "Analityka", "/analityka"],
  ["jakosc", "Jakość", "/jakosc"],
] as const;

/** Sections of one film; plain links, the current one marked for assistive tech. */
export function FilmTabs({ slug, current }: { slug: string; current: (typeof TABS)[number][0] }) {
  return (
    <nav className="tabs" aria-label="Sekcje filmu">
      {TABS.map(([id, label, suffix]) => (
        <Link key={id} href={`/tresci/${slug}${suffix}`} aria-current={id === current ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
