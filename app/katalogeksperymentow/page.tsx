import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Katalog eksperymentów · Polutek",
  description: "Tymczasowy katalog linków do wszystkich istniejących eksperymentów stylistycznych Polutek.",
};

const experiments = [
  { number: 1, href: "/eksperyment1", title: "Rough UI", description: "Papier i cienkopis — pierwsza pełna próba ręcznej kreski." },
  { number: 2, href: "/eksperyment2", title: "UI concept board", description: "Szkicowy concept board inspirowany katalogiem elementów stylu." },
  { number: 3, href: "/eksperyment3", title: "katalog cards", description: "Karty, etykiety i markerowe warstwy z /katalog." },
  { number: 4, href: "/eksperyment4", title: "uproszczona rama", description: "Spokojna rama z bocznymi marginesami i papierowym tłem." },
  { number: 5, href: "/eksperyment5", title: "nocne kino", description: "Neonowa, kinowa stylizacja VHS." },
  { number: 6, href: "/eksperyment6", title: "editorial premium", description: "Elegancka, magazynowa wersja editorial." },
  { number: 7, href: "/eksperyment7", title: "bauhaus blocks", description: "Geometryczna, blokowa stylizacja inspirowana plakatem." },
  { number: 8, href: "/eksperyment8", title: "rough paper system", description: "Papierowe ramki i obrysy generowane przez roughjs." },
  { number: 9, href: "/eksperyment9", title: "freehand organic", description: "Organiczna kreska z perfect-freehand i własnymi pathami SVG." },
  { number: 10, href: "/eksperyment10", title: "notation marks", description: "rough-notation, zakreślenia i własne adnotacje SVG." },
  { number: 11, href: "/eksperyment11", title: "wired prototype", description: "Test wired-elements i szkicowych web components." },
  { number: 12, href: "/eksperyment12", title: "blueprint SVG", description: "Chłodny blueprint z własnymi pathami SVG i siatką." },
  { number: 13, href: "/eksperyment13", title: "tactile app", description: "Aplikacyjny, dotykowy UI z mikrointerakcjami." },
  { number: 14, href: "/eksperyment14", title: "soft poster paper", description: "Spokojne połączenie papierowego szkicu i geometrii bez czerwieni." },
  { number: 15, href: "/eksperyment15", title: "quiet gallery blocks", description: "Galeryjna, spokojniejsza wersja bloków i ramek." },
  { number: 16, href: "/eksperyment16", title: "bauhaus bez czerwieni", description: "Geometryczne bloki bez czerwonego koloru i bez nieruchomego tła." },
  { number: 17, href: "/eksperyment17", title: "spokojny szkic", description: "Kratkowana, spokojna stylizacja inspirowana eksperymentem 4." },
  { number: 18, href: "/eksperyment18", title: "bauhaus scroll background", description: "Wariant eksperymentu 7 z topbarem sticky i tłem przewijanym ze stroną." },
];

export default function KatalogEksperymentowPage() {
  return (
    <main className="min-h-screen bg-[#f7f1e4] px-4 py-8 text-[#171411] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-2 border-[#171411] bg-[#fffaf0] p-6 shadow-[8px_8px_0_rgba(23,20,17,0.16)]">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#5f6f52]">
            Tymczasowe laboratorium stylu
          </p>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
            Katalog eksperymentów Polutek
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#4d463b]">
            To jest robocza podstrona z linkami do wszystkich istniejących wariantów stylistycznych.
            Służy do szybkiego porównywania kierunków: papier, cienkopis, rough UI, geometrię,
            blueprint, notatki i spokojniejsze wersje bloków. Po wyborze finalnego kierunku te
            eksperymenty można zarchiwizować albo usunąć.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.16em]">
            <Link className="border-2 border-[#171411] bg-[#f4c542] px-3 py-2" href="/">
              Strona główna
            </Link>
            <Link className="border-2 border-[#171411] bg-[#dfe8d8] px-3 py-2" href="/katalog">
              /katalog
            </Link>
            <Link className="border-2 border-[#171411] bg-[#dfe8d8] px-3 py-2" href="/katalog2">
              /katalog2
            </Link>
            <Link className="border-2 border-[#171411] bg-[#dfe8d8] px-3 py-2" href="/katalog3">
              /katalog3
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {experiments.map((experiment) => (
            <Link
              key={experiment.href}
              href={experiment.href}
              className="group flex min-h-[180px] flex-col justify-between border-2 border-[#171411] bg-[#fffaf0] p-5 shadow-[6px_6px_0_rgba(23,20,17,0.12)] transition hover:-translate-y-1 hover:shadow-[10px_10px_0_rgba(23,20,17,0.18)]"
            >
              <div>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center border-2 border-[#171411] bg-[#171411] text-lg font-black text-[#fffaf0]">
                    {experiment.number}
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#6f675a]">
                    {experiment.href}
                  </span>
                </div>
                <h2 className="text-2xl font-black leading-tight group-hover:underline">
                  {experiment.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#4d463b]">
                  {experiment.description}
                </p>
              </div>
              <span className="mt-6 inline-flex w-fit border-2 border-[#171411] bg-[#f4c542] px-3 py-2 text-xs font-black uppercase tracking-[0.16em]">
                Otwórz eksperyment
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
