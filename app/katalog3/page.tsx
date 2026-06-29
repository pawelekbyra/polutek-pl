import type { Metadata } from "next";
import Link from "next/link";
import s from "./Katalog3.module.css";

export const metadata: Metadata = {
  title: "Katalog 3 — gotowe komponenty · Polutek",
  description: "Bardzo duży atlas gotowych komponentów Polutek w czterech spójnych stylach inspirowanych eksperymentami 1, 2, 3 i 4.",
};

const styleFamilies = [
  { id: "rough", code: "S1", name: "Papier + cienkopis", source: "eksperyment1", desc: "Organiczny papier, miękkie obrysy, luźna ręczna kreska." },
  { id: "board", code: "S2", name: "Concept board", source: "eksperyment2", desc: "Projektowy szkicownik, notatki, markery i pigułki." },
  { id: "cards", code: "S3", name: "Katalog cards", source: "eksperyment3", desc: "Warstwowe karty, highlighty, gotowe moduły produkcyjne." },
  { id: "ink", code: "S4", name: "Ink blueprint", source: "eksperyment4", desc: "Techniczny szkic, kratka, mocniejsze linie i prostsze rogi." },
] as const;

const nav = [
  ["style", "Style"],
  ["buttons", "Przyciski"],
  ["lines", "Linie"],
  ["cards", "Karty"],
  ["forms", "Formularze"],
  ["navigation", "Nawigacja"],
  ["status", "Statusy"],
  ["sections", "Sekcje"],
] as const;

const buttons = [
  "Wesprzyj", "Wesprzyj POLUTEK.PL", "Subskrybuj", "Obejrzyj teraz", "Odblokuj odcinek", "Dołącz jako patron",
  "Zobacz katalog", "Udostępnij", "Lubię to", "Zapisz", "Otwórz kanał", "Anuluj", "Wyślij", "Zaloguj", "Kup dostęp", "Zobacz więcej",
];

const lines = [
  "Cienka", "Gruba", "Podwójna", "Falowana", "Przerywana", "Kropkowana", "Marker", "Underline", "Bracket lewy", "Bracket prawy", "Strzałka", "Separator sekcji", "Kratka", "Notatka boczna", "Przekreślenie", "Ramka robocza",
];

const cards = [
  "Karta filmu", "Karta twórcy", "Karta patrona", "Karta playlisty", "Karta statystyki", "Karta komentarza", "Locked content", "Empty state", "Plan 10 zł", "Plan 25 zł", "Plan 50 zł", "Mecenas",
];

const fields = ["Email", "Szukaj", "Kwota wsparcia", "Nazwa", "Komentarz", "Kod zaproszenia", "Krótki opis", "Link do kanału"];
const statuses = ["Publiczne", "Odblokowane", "Nowe", "Tylko patroni", "Popularne", "Gotowe", "Beta", "Live", "Archiwum", "Premium", "W trakcie", "Polecane"];

function cx(...names: Array<string | false | undefined>) {
  return names.filter(Boolean).join(" ");
}

function Intro({ id, eyebrow, title, text }: { id: string; eyebrow: string; title: string; text: string }) {
  return (
    <section id={id} className={s.intro}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function Label({ code, title }: { code: string; title: string }) {
  return <div className={s.label}><span>{code}</span><strong>{title}</strong></div>;
}

function Box({ styleId, children, tall = false }: { styleId: string; children: React.ReactNode; tall?: boolean }) {
  return <div className={cx(s.box, s[styleId], tall && s.tall)}>{children}</div>;
}

function Button({ variant = "primary", children }: { variant?: string; children: React.ReactNode }) {
  return <button className={cx(s.button, s[variant])}>{children}</button>;
}

function Line({ index }: { index: number }) {
  return <div className={cx(s.line, s[`line${(index % 16) + 1}`])} />;
}

export default function Katalog3Page() {
  return (
    <div className={s.page}>
      <div className={s.noise} />
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link href="/" className={s.back}>← polutek.pl</Link>
          <strong>Katalog 3 — gotowe komponenty</strong>
          <nav>{nav.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
        </div>
      </header>

      <main className={s.main}>
        <section className={s.hero}>
          <div>
            <span className={s.pill}>component atlas / production ready</span>
            <h1>Bardzo duży katalog gotowych komponentów Polutek</h1>
            <p>Cztery spójne style inspirowane eksperymentami 1, 2, 3 i 4. To są gotowe elementy strony: przyciski, linie, karty, formularze, statusy, nawigacje i większe sekcje.</p>
            <div className={s.actions}><a href="#buttons">Przycisk Wesprzyj w każdym stylu</a><a href="#lines">Linie i separatory</a></div>
          </div>
          <div className={s.heroGrid}>
            {styleFamilies.map((family) => (
              <Box key={family.id} styleId={family.id} tall>
                <Label code={family.code} title={family.name} />
                <Button>Wesprzyj</Button>
                <Line index={styleFamilies.indexOf(family) + 2} />
                <span className={s.micro}>{family.source}</span>
              </Box>
            ))}
          </div>
        </section>

        <Intro id="style" eyebrow="00 / style families" title="Style są podobne, ale nie takie same" text="Każdy wariant ma papier, szkicowy obrys i mocny CTA. Różnice są w geometrii, kresce, stopniu techniczności i sposobie użycia markerów." />
        <div className={s.grid4}>{styleFamilies.map((family) => (
          <Box key={family.id} styleId={family.id} tall>
            <Label code={family.code} title={family.name} />
            <p>{family.desc}</p>
            <div className={s.swatches}><i /><i /><i /><i /></div>
            <Button>Wesprzyj</Button>
            <Button variant="ghost">Subskrybuj</Button>
          </Box>
        ))}</div>

        <Intro id="buttons" eyebrow="01 / buttons" title="Wszystkie podstawowe przyciski" text="Przycisk Wesprzyj jest pokazany w każdym stylu i w wielu stanach. Poniżej są gotowe akcje dla strony głównej, kanału, płatności i odcinków." />
        <div className={s.grid4}>{styleFamilies.map((family) => (
          <Box key={family.id} styleId={family.id} tall>
            <Label code={`BTN-${family.code}`} title={`Zestaw — ${family.name}`} />
            <div className={s.stack}><Button>Wesprzyj</Button><Button>Wesprzyj POLUTEK.PL</Button><Button variant="secondary">Subskrybuj</Button><Button variant="ghost">Zobacz więcej</Button><Button variant="soft">Zapisz</Button><Button variant="disabled">Niedostępne</Button></div>
          </Box>
        ))}</div>
        <div className={s.grid6}>{buttons.map((button, index) => (
          <Box key={button} styleId={styleFamilies[index % 4].id}>
            <Label code={`BTN-${String(index + 1).padStart(2, "0")}`} title={button} />
            <div className={s.center}><Button variant={index % 4 === 0 ? "primary" : index % 4 === 1 ? "secondary" : index % 4 === 2 ? "ghost" : "soft"}>{button}</Button></div>
          </Box>
        ))}</div>
        <div className={s.matrix}>{styleFamilies.map((family) => (
          <Box key={family.id} styleId={family.id}>
            <Label code={`WSP-${family.code}`} title="Wesprzyj — stany" />
            <div className={s.stateRow}><Button>Default</Button><Button variant="hover">Hover</Button><Button variant="active">Active</Button><Button variant="disabled">Disabled</Button></div>
          </Box>
        ))}</div>

        <Intro id="lines" eyebrow="02 / lines" title="Linie, separatory i obrysy" text="Gotowe kreski do sekcji, kart, tytułów, notatek, aktywnych stanów i ramek roboczych." />
        <div className={s.grid4}>{lines.map((line, index) => (
          <Box key={line} styleId={styleFamilies[index % 4].id}>
            <Label code={`LIN-${String(index + 1).padStart(2, "0")}`} title={line} />
            <Line index={index} />
            <p>{index < 6 ? "Separator i rytm layoutu." : index < 11 ? "Akcent kierunkowy lub notacja." : "Element techniczny i porządkujący."}</p>
          </Box>
        ))}</div>

        <Intro id="cards" eyebrow="03 / cards" title="Karty i kontenery produkcyjne" text="Karty do filmów, patronów, playlist, planów wsparcia i stanów pustych. Każda karta jest gotowa jako wzorzec UI." />
        <div className={s.grid4}>{cards.map((card, index) => (
          <Box key={card} styleId={styleFamilies[index % 4].id} tall>
            <Label code={`CARD-${String(index + 1).padStart(2, "0")}`} title={card} />
            <div className={s.mockCard}><div className={s.thumb}>16:9</div><div><strong>{card}</strong><p>Gotowy kontener do użycia na stronie.</p><span className={s.badge}>{index % 2 ? "Odblokowane" : "Publiczne"}</span></div></div>
            <Button variant="mini">Wesprzyj</Button>
          </Box>
        ))}</div>

        <Intro id="forms" eyebrow="04 / forms" title="Formularze, inputy i płatności" text="Pola, kwoty, checkboxy i całe mini formularze wsparcia w czterech stylach." />
        <div className={s.grid4}>{fields.map((field, index) => (
          <Box key={field} styleId={styleFamilies[index % 4].id}>
            <Label code={`INP-${String(index + 1).padStart(2, "0")}`} title={field} />
            <label className={s.fieldLabel}>{field}</label><input className={s.input} placeholder={field === "Kwota wsparcia" ? "25 zł" : field} />
          </Box>
        ))}</div>
        <div className={s.grid4}>{styleFamilies.map((family) => (
          <Box key={family.id} styleId={family.id} tall>
            <Label code={`FORM-${family.code}`} title="Formularz Wesprzyj" />
            <label className={s.fieldLabel}>Email</label><input className={s.input} placeholder="kontakt@polutek.pl" />
            <div className={s.amounts}><button>10 zł</button><button className={s.selected}>25 zł</button><button>50 zł</button><button>inna</button></div>
            <label className={s.check}><i /> Chcę wspierać co miesiąc</label><Button>Wesprzyj POLUTEK.PL</Button>
          </Box>
        ))}</div>

        <Intro id="navigation" eyebrow="05 / navigation" title="Nawigacja, taby i topbar" text="Gotowe topbary, filtry, taby i mini nawigacje do strony głównej, kanału oraz widoku odcinka." />
        <div className={s.grid2}>{styleFamilies.map((family) => (
          <Box key={family.id} styleId={family.id} tall>
            <Label code={`NAV-${family.code}`} title={family.name} />
            <div className={s.navDemo}><strong>POLUTEK</strong><button>Główna</button><button>Kanały</button><button>Wspieraj</button><Button variant="mini">Zaloguj</Button></div>
            <div className={s.tabs}><button className={s.selected}>Wideo</button><button>Opis</button><button>Komentarze</button><button>Patroni</button></div>
          </Box>
        ))}</div>

        <Intro id="status" eyebrow="06 / status" title="Badge, statusy i alerty" text="Etykiety do filmów, materiałów premium, nowych odcinków, błędów i komunikatów systemowych." />
        <div className={s.grid6}>{statuses.map((status, index) => (
          <Box key={status} styleId={styleFamilies[index % 4].id}>
            <Label code={`TAG-${String(index + 1).padStart(2, "0")}`} title={status} />
            <div className={s.center}><span className={cx(s.badge, index % 3 === 1 && s.blueBadge, index % 3 === 2 && s.darkBadge)}>{status}</span></div>
          </Box>
        ))}</div>
        <div className={s.grid4}>{styleFamilies.map((family) => (
          <Box key={family.id} styleId={family.id} tall>
            <Label code={`ALERT-${family.code}`} title="Alerty" />
            <div className={s.alertGood}><strong>Gotowe</strong><span>Wsparcie zostało zapisane.</span></div>
            <div className={s.alertWarn}><strong>Uwaga</strong><span>Odcinek jest w przygotowaniu.</span></div>
            <div className={s.alertBad}><strong>Błąd</strong><span>Nie udało się wczytać materiału.</span></div>
          </Box>
        ))}</div>

        <Intro id="sections" eyebrow="07 / sections" title="Duże gotowe sekcje strony" text="Większe moduły, które można traktować jako gotowe fragmenty strony: hero, panel wsparcia, locked content, profil twórcy, wyniki wyszukiwania i footer." />
        <div className={s.productionList}>{["Topbar sticky", "Hero z video", "Panel wsparcia", "Profil twórcy", "Locked content", "Lista odcinków", "Wyniki wyszukiwania", "Footer"].map((section, index) => (
          <div key={section} className={cx(s.productionRow, s[styleFamilies[index % 4].id])}><span>{`SEC-${String(index + 1).padStart(2, "0")}`}</span><strong>{section}</strong><p>Gotowa sekcja produkcyjna w stylu Polutek.</p><Button variant="mini">Podgląd</Button></div>
        ))}</div>
      </main>
    </div>
  );
}
