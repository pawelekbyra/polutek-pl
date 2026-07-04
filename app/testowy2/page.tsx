import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CircleDollarSign, Clapperboard, LockKeyhole, MessageCircle, Play, Zap } from "lucide-react";

const rails = ["Publiczne", "Zalogowani", "Patroni", "Komentarze", "Wsparcie"];
const cards = [
  { label: "PUBLIC", title: "Otwarte odcinki", copy: "Szybkie wejście bez tarcia — dla nowych widzów.", className: "bg-[#eaf0ff]" },
  { label: "LOGIN", title: "Materiały społeczności", copy: "Lekki próg logowania dla bliższych treści.", className: "bg-[#f7ead5]" },
  { label: "PATRON", title: "Thank You Zone", copy: "Stała nagroda za jednorazowe wsparcie.", className: "bg-zinc-950 text-white" },
];

export const metadata = {
  title: "Testowy 2 — Polutek.pl",
  description: "Szkicowa aplikacyjna koncepcja strony Polutek.pl: dynamiczny, aplikacyjny styl VOD z mocnym gridem.",
};

export default function ExperimentTwoPage() {
  return (
    <main className="rough-ui-page min-h-[100dvh] bg-[#f8f3e7] text-zinc-950">
      <section className="relative isolate overflow-hidden px-5 py-5 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.12),transparent_33%),radial-gradient(circle_at_80%_10%,rgba(245,196,81,.18),transparent_24%)]" />
        <div className="absolute left-1/2 top-24 -z-10 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full border border-zinc-950" />
        <div className="absolute left-1/2 top-10 -z-10 h-[54rem] w-[54rem] -translate-x-1/2 rounded-full border border-white/5" />

        <nav className="mx-auto flex max-w-7xl items-center justify-between rough-box rounded-[1.1rem] border-2 border-zinc-950 bg-[#fffaf0]/80 px-4 py-3 shadow-none backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-3 font-brand text-lg font-black tracking-tight">
            <span className="grid h-10 w-10 place-items-center rough-box rounded-2xl bg-blue-600"><Zap className="h-5 w-5 fill-white" /></span>
            POLUTEK/APP
          </Link>
          <div className="hidden gap-2 md:flex">
            {rails.map((rail) => (
              <span key={rail} className="rounded-full border border-zinc-950 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-zinc-600">{rail}</span>
            ))}
          </div>
          <Link href="/testowy1" className="rough-btn rounded-2xl bg-white px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-blue-100">Testowy 1</Link>
        </nav>

        <div className="mx-auto grid max-w-7xl gap-8 py-12 lg:grid-cols-[.82fr_1.18fr] lg:py-20">
          <div className="flex flex-col justify-between gap-10">
            <div>
              <p className="mb-5 inline-flex rough-chip rounded-[.8rem] border-2 border-blue-600/60 bg-[#fff7df] px-4 py-2 text-sm font-black text-blue-700">Eksperyment 2 · szybki, aplikacyjny, odważny</p>
              <h1 className="text-balance font-najs text-5xl font-black leading-[0.9] tracking-[-0.065em] sm:text-7xl lg:text-8xl">
                VOD, które wygląda jak cockpit twórcy.
              </h1>
              <p className="mt-7 max-w-xl text-pretty text-lg font-medium leading-8 text-zinc-700">
                Ta wersja idzie w kierunku nowoczesnej aplikacji: ciemna scena, mocne karty, żywy niebieski akcent i natychmiastowe rozróżnienie poziomów dostępu.
              </p>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-[1.75rem] border border-zinc-950 bg-white/[0.06]">
              {[["3", "poziomy"], ["1", "kanał"], ["∞", "dostęp"]].map(([n, l]) => (
                <div key={l} className="border-r border-zinc-950 p-5 last:border-r-0">
                  <p className="font-heading text-4xl font-black tracking-tight">{n}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-zinc-500">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_.72fr]">
            <div className="rough-box rounded-[1.2rem] border-2 border-zinc-950 bg-[#fffaf0]/70 p-3 shadow-none backdrop-blur-xl">
              <div className="relative overflow-hidden rough-box rounded-[1rem] bg-[#050505]">
                <div className="aspect-[16/10] bg-[radial-gradient(circle_at_50%_35%,rgba(37,99,235,.95),transparent_24%),linear-gradient(140deg,#27272a,#09090b_62%)]">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[length:44px_44px] opacity-30" />
                  <button className="absolute left-8 top-8 inline-flex items-center gap-3 rough-btn rounded-full bg-white px-5 py-3 font-black text-zinc-950 shadow-2xl">
                    <Play className="h-5 w-5 fill-current" /> Oglądaj
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/65 to-transparent p-7 pt-24">
                    <p className="text-xs font-black uppercase tracking-[0.35em] text-blue-200">Featured episode</p>
                    <h2 className="mt-3 max-w-lg font-heading text-4xl font-black leading-none tracking-[-0.04em] text-white">Premiera bez kompromisów i bez cudzych algorytmów</h2>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              <Panel icon={<Clapperboard className="h-5 w-5" />} title="Biblioteka" value="Sezony, serie, premiery" />
              <Panel icon={<LockKeyhole className="h-5 w-5" />} title="Access" value="Czytelne blokady bez wycieku źródeł" />
              <Panel icon={<MessageCircle className="h-5 w-5" />} title="Komentarze" value="Widoczne publicznie, aktywne po dostępie" />
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-8 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          {cards.map((card) => (
            <article key={card.label} className={`min-h-72 rough-card rounded-[1.2rem] border-2 border-zinc-950 p-7 shadow-none ${card.className}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-current/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.24em] opacity-70">{card.label}</span>
                <ArrowUpRight className="h-6 w-6 opacity-65" />
              </div>
              <h2 className="mt-16 font-heading text-4xl font-black tracking-[-0.045em]">{card.title}</h2>
              <p className="mt-4 max-w-sm text-lg font-semibold leading-7 opacity-70">{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rough-box rounded-[1.2rem] border-2 border-zinc-950 bg-[#fffaf0]/70 p-8 backdrop-blur-xl sm:p-10">
            <BadgeCheck className="h-9 w-9 text-blue-300" />
            <h2 className="mt-8 max-w-3xl font-heading text-4xl font-black leading-none tracking-[-0.045em] sm:text-6xl">Profesjonalny wygląd, który nadal czuje się niezależnie.</h2>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-zinc-700">Wersja 2 nadaje się na kierunek produktowy, gdy priorytetem jest energia, szybkość i poczucie nowoczesnej platformy — bez porzucania prostego modelu jednego twórcy.</p>
          </div>
          <div className="rough-box rounded-[1.2rem] border-2 border-zinc-950 bg-blue-600 p-8 text-white shadow-[0_25px_90px_rgba(37,99,235,.35)] sm:p-10">
            <CircleDollarSign className="h-10 w-10" />
            <h3 className="mt-8 font-heading text-4xl font-black tracking-[-0.04em]">Wsparcie jako jasny rytuał.</h3>
            <p className="mt-4 text-lg font-semibold leading-7 text-blue-50">Jednorazowy tip, stały status patrona, zero subskrypcyjnej mgły. Komunikat jest mocny, prosty i premium.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Panel({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rough-card rounded-[1.2rem] border-2 border-zinc-950 bg-[#fffaf0]/70 p-5 backdrop-blur-xl">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/20 text-blue-700">{icon}</div>
      <h3 className="mt-5 text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{value}</p>
    </div>
  );
}
