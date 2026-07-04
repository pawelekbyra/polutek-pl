import Link from "next/link";
import { ArrowRight, CheckCircle2, Play, Sparkles, Star, Waves } from "lucide-react";

const features = [
  "Kino domowe bez platformowego szumu",
  "Materiały publiczne, logowane i patronackie w jednej osi",
  "Stały dostęp patrona po jednorazowym wsparciu",
];

const episodes = [
  { title: "Start kanału", meta: "12 min · publiczne", tone: "bg-blue-600" },
  { title: "Notatnik twórcy", meta: "18 min · po zalogowaniu", tone: "bg-zinc-950" },
  { title: "Thank You Zone", meta: "31 min · patron", tone: "bg-amber-400" },
];

export const metadata = {
  title: "Testowy 1 — Polutek.pl",
  description: "Szkicowa papierowa koncepcja strony Polutek.pl: spokojny, premium, editorialny styl VOD.",
};

export default function ExperimentOnePage() {
  return (
    <main className="rough-ui-page min-h-[100dvh] overflow-hidden bg-[#f8f3e7] text-zinc-950">
      <section className="relative isolate px-5 py-6 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.18),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(250,204,21,0.20),transparent_26%),linear-gradient(rgba(23,23,23,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(23,23,23,.055)_1px,transparent_1px)] bg-[length:auto,auto,38px_38px,38px_38px]" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between rough-box rounded-[1.2rem] border-2 border-zinc-950 bg-[#fffaf0]/80 px-4 py-3 shadow-none backdrop-blur">
          <Link href="/" className="font-brand text-lg font-black tracking-tight rough-underline">POLUTEK</Link>
          <div className="hidden items-center gap-6 text-sm font-semibold text-zinc-600 md:flex">
            <a href="#kolekcja">Kolekcja</a>
            <a href="#patron">Patron</a>
            <a href="#manifest">Manifest</a>
          </div>
          <Link href="/testowy2" className="rough-btn rough-btn-filled rounded-[1rem] bg-zinc-950 px-4 py-2 text-sm font-bold text-[#f8f3e7] transition hover:bg-blue-600">
            Testowy 2
          </Link>
        </nav>

        <div className="mx-auto grid max-w-7xl gap-10 pb-16 pt-14 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rough-chip rounded-[.8rem] border-2 border-blue-600/60 bg-[#fff7df] px-3 py-2 text-sm font-bold text-blue-700 shadow-none">
              <Sparkles className="h-4 w-4" /> Autorski kanał wideo, bez algorytmicznego hałasu
            </div>
            <h1 className="max-w-4xl text-balance font-najs text-5xl font-black leading-[0.95] tracking-[-0.055em] sm:text-7xl lg:text-8xl">
              Kino dla jednej społeczności. Z charakterem papieru i ostrością ekranu.
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-zinc-700 rough-copy sm:text-xl">
              Eksperyment 1 buduje profesjonalny, editorialny landing Polutek.pl: ciepły papier, precyzyjna typografia, mocny kontrast i jedna niebieska akcja prowadząca użytkownika do oglądania.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#kolekcja" className="group inline-flex items-center justify-center rough-btn rough-btn-blue rounded-[1rem] bg-blue-600 px-6 py-4 text-base font-black text-white shadow-[0_18px_45px_rgba(37,99,235,.28)] transition hover:-translate-y-0.5 hover:bg-blue-700">
                Zobacz układ strony <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
              </a>
              <Link href="/" className="inline-flex items-center justify-center rough-btn rounded-[1rem] border-2 border-zinc-950 bg-white/65 px-6 py-4 text-base font-black text-zinc-950 transition hover:bg-white">
                Powrót do serwisu
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-blue-600/20 blur-3xl" />
            <div className="rough-box rounded-[1.4rem] border-2 border-zinc-950 bg-zinc-950 p-3 shadow-none">
              <div className="overflow-hidden rounded-[1rem] bg-[#111]">
                <div className="relative aspect-video bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,.85),transparent_28%),linear-gradient(135deg,#18181b,#050505_70%)]">
                  <div className="absolute inset-5 rough-box rounded-3xl border border-white/30" />
                  <button className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rough-btn rounded-full bg-white text-zinc-950 shadow-none">
                    <Play className="ml-1 h-8 w-8 fill-current" />
                  </button>
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/55">Teraz oglądasz</p>
                      <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">Długi odcinek o rzeczach ważnych</h2>
                    </div>
                    <span className="rough-chip rounded-full bg-white/12 px-3 py-1 text-sm font-bold backdrop-blur">4K Ready</span>
                  </div>
                </div>
                <div className="grid gap-2 bg-[#f8f3e7] p-4">
                  {episodes.map((episode) => (
                    <div key={episode.title} className="flex items-center gap-3 rough-card rounded-2xl border-2 border-zinc-950 bg-white/70 p-3">
                      <span className={`h-12 w-16 rounded-xl ${episode.tone}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-black leading-tight">{episode.title}</p>
                        <p className="text-sm font-semibold text-zinc-500">{episode.meta}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-zinc-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="kolekcja" className="px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature} className="rough-card rounded-[1.1rem] border-2 border-zinc-950 bg-white/55 p-7 shadow-none backdrop-blur">
              <CheckCircle2 className="h-7 w-7 text-blue-600" />
              <p className="mt-5 text-xl font-black tracking-tight">{feature}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="patron" className="px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl overflow-hidden rough-box rounded-[1.2rem] border-2 border-zinc-950 bg-zinc-950 text-white shadow-[0_35px_90px_rgba(23,23,23,.22)] lg:grid-cols-[.9fr_1.1fr]">
          <div className="p-8 sm:p-10 lg:p-12">
            <Waves className="h-10 w-10 text-blue-400" />
            <h2 className="mt-8 font-heading text-4xl font-black tracking-[-0.04em] sm:text-5xl">Thank You Zone jako elegancka nagroda, nie paywall z krzykiem.</h2>
          </div>
          <div className="bg-white p-8 text-zinc-950 sm:p-10 lg:p-12">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Lifetime", "Jednorazowe wsparcie daje stały dostęp patrona."],
                ["Headless auth", "Logowanie jest częścią stylu, nie obcym widgetem."],
                ["Premium VOD", "Player i lista odcinków prowadzą wzrok bez chaosu."],
                ["Paper/ink", "System wizualny zostaje spójny z marką Polutek."],
              ].map(([k, v]) => (
                <div key={k} className="rough-card rounded-3xl border-2 border-zinc-950 bg-[#f8f3e7] p-5">
                  <Star className="h-5 w-5 fill-blue-600 text-blue-600" />
                  <h3 className="mt-4 text-2xl font-black">{k}</h3>
                  <p className="mt-2 font-semibold leading-6 text-zinc-600">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="manifest" className="px-5 pb-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl rough-box rounded-[1.2rem] border-2 border-zinc-950 bg-[#fffaf0]/75 p-8 text-center shadow-[0_18px_70px_rgba(23,23,23,.08)] sm:p-12">
          <p className="mx-auto max-w-4xl text-balance font-heading text-3xl font-black tracking-[-0.035em] sm:text-5xl">
            Wersja 1 jest spokojna, kinowa i premium — idealna, gdy Polutek ma wyglądać jak własny dom dla treści, a nie kolejny klon platformy streamingowej.
          </p>
        </div>
      </section>
    </main>
  );
}
