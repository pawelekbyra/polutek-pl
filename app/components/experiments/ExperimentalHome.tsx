import Link from "next/link";

const videos = [
  ["Sąd nad absurdami", "18:42", "Nowy odcinek"],
  ["Patroni pytają", "11:08", "Dyskusja"],
  ["Notatnik Polutka", "07:31", "Szkic"],
];

const cards = [
  ["Baza odcinków", "Wybrane materiały, serie i ślady poboczne w jednym miejscu."],
  ["Klub patronów", "Jednorazowe wsparcie odblokowuje stały dostęp do bonusów."],
  ["Komentarze", "Czytaj publicznie, pisz jako zalogowany patron albo admin."],
];

const variants = {
  1: {
    name: "Margines reportera",
    bg: "#f7efd9",
    ink: "#151515",
    accent: "#ffbf2f",
    accent2: "#ef4444",
    soft: "#fff7df",
    gradient: "linear-gradient(135deg,#fff7df 0%,#f7efd9 48%,#e8f7ff 100%)",
    title: "Polutek jako ręcznie składany dziennik wideo",
    lead: "Ciepły papier, czarny marker, żółte zakreślacze i czerwone dopiski. Kierunek: zaufanie, autorskość, lekko buntownicza publicystyka.",
  },
  2: {
    name: "Neonowy zeszyt",
    bg: "#101326",
    ink: "#f7f1df",
    accent: "#67e8f9",
    accent2: "#f472b6",
    soft: "#1b2140",
    gradient: "radial-gradient(circle at 20% 10%,#263b80 0,#101326 38%,#090b16 100%)",
    title: "Polutek nocą: kolorowe bazgroły na ciemnej kartce",
    lead: "Energia livestreamu, neonowe mazaki i szkicownik pełen strzałek. Kierunek: młodszy, odważniejszy, bardziej show + community.",
  },
  3: {
    name: "Pastelowy warsztat",
    bg: "#f8f1ef",
    ink: "#22312b",
    accent: "#7dd3a8",
    accent2: "#fb7185",
    soft: "#fffaf5",
    gradient: "linear-gradient(140deg,#fffaf5,#f8f1ef 45%,#e8fff1)",
    title: "Polutek jako przyjazna pracownia pomysłów",
    lead: "Miękkie pastele, zielone fiszki, różowe pieczątki i spokojne rytmy. Kierunek: premium, serdecznie, bardzo czytelnie.",
  },
  4: {
    name: "Komiksowy manifest",
    bg: "#fff3b0",
    ink: "#171717",
    accent: "#2563eb",
    accent2: "#f97316",
    soft: "#fffbe8",
    gradient: "linear-gradient(135deg,#fffbe8,#ffe66d 52%,#bde0fe)",
    title: "Polutek jako głośny, komiksowy plakat kanału",
    lead: "Grube ramki, przerysowane naklejki, dynamiczne dymki i mocny kontrast. Kierunek: najbardziej viralowy i rozpoznawalny.",
  },
} as const;

type Variant = keyof typeof variants;

function DoodleLayer({ ink, accent, accent2 }: { ink: string; accent: string; accent2: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-70" aria-hidden="true">
      <defs>
        <pattern id={`grid-${accent}`} width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M42 0H0V42" fill="none" stroke={ink} strokeOpacity=".08" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#grid-${accent})`} />
      <path d="M75 95c52-23 97-14 142 19M78 116c44-17 94-12 134 12" fill="none" stroke={accent2} strokeWidth="5" strokeLinecap="round" opacity=".55" />
      <path d="M82% 8% l38 12 -24 26 42 12" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      <path d="M9% 78% q7% -8% 14% 0t14% 0" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" opacity=".45" />
      <circle cx="91%" cy="79%" r="37" fill="none" stroke={accent2} strokeWidth="5" strokeDasharray="8 10" opacity=".5" />
    </svg>
  );
}

function ScribbleFrame({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative ${className}`} style={style}>
      <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-[2rem] border-2 border-current opacity-30 [clip-path:polygon(1%_4%,98%_1%,100%_92%,3%_100%)]" />
      <div className="relative rounded-[2rem] border-[3px] border-current bg-[color:var(--paper)] shadow-[10px_12px_0_rgba(0,0,0,.16)] [clip-path:polygon(0_2%,99%_0,100%_96%,2%_100%)]">
        {children}
      </div>
    </div>
  );
}

export default function ExperimentalHome({ variant }: { variant: Variant }) {
  const v = variants[variant];
  const nav = ["Start", "Odcinki", "Patroni", "Komentarze"];
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-8" style={{ background: v.gradient, color: v.ink, ["--paper" as string]: v.soft, fontFamily: "var(--font-najs), Kalam, 'Comic Sans MS', cursive" }}>
      <DoodleLayer ink={v.ink} accent={v.accent} accent2={v.accent2} />
      <div className="relative mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border-[3px] border-current bg-white/45 px-5 py-4 shadow-[6px_7px_0_rgba(0,0,0,.14)] backdrop-blur">
          <Link href="/" className="text-3xl font-black tracking-tight underline decoration-[6px] underline-offset-8" style={{ textDecorationColor: v.accent }}>POLUTEK</Link>
          <nav className="flex flex-wrap gap-2 text-sm font-bold uppercase tracking-[.16em]">
            {nav.map((item, idx) => <span key={item} className="rounded-full border-2 border-current px-3 py-2" style={{ background: idx === 0 ? v.accent : "transparent" }}>{item}</span>)}
          </nav>
          <Link href="/e4" className="rounded-full border-[3px] border-current px-4 py-2 font-black shadow-[4px_4px_0_rgba(0,0,0,.2)]" style={{ background: v.accent2, color: variant === 2 ? "#101326" : "white" }}>Wspieram</Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <ScribbleFrame className="min-h-[620px]" style={{ ["--paper" as string]: v.soft }}>
            <div className="p-6 sm:p-9 lg:p-12">
              <div className="mb-6 inline-flex rotate-[-2deg] rounded-full border-2 border-current px-4 py-2 text-sm font-black uppercase tracking-[.2em]" style={{ background: v.accent }}>{v.name}</div>
              <h1 className="max-w-4xl text-5xl font-black leading-[.95] tracking-[-.05em] sm:text-7xl lg:text-8xl">{v.title}</h1>
              <p className="mt-7 max-w-2xl text-xl font-bold leading-relaxed opacity-85">{v.lead}</p>
              <div className="mt-9 flex flex-wrap gap-4">
                <a className="rounded-[1.2rem] border-[3px] border-current px-6 py-4 text-lg font-black shadow-[5px_6px_0_rgba(0,0,0,.2)] transition hover:-translate-y-1" style={{ background: v.ink, color: v.bg }}>Oglądaj główny film</a>
                <a className="rounded-[1.2rem] border-[3px] border-current px-6 py-4 text-lg font-black transition hover:rotate-1" style={{ background: v.accent }}>Zobacz katalog</a>
              </div>
              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {cards.map(([title, text], i) => (
                  <div key={title} className="rounded-[1.4rem] border-2 border-current bg-white/35 p-4 shadow-[4px_5px_0_rgba(0,0,0,.12)]" style={{ transform: `rotate(${[-1.2, .7, -0.5][i]}deg)` }}>
                    <div className="mb-3 h-12 w-12 rounded-2xl border-2 border-current text-center text-3xl font-black" style={{ background: i === 1 ? v.accent2 : v.accent }}>{i + 1}</div>
                    <h3 className="text-xl font-black">{title}</h3>
                    <p className="mt-2 text-sm font-bold opacity-75">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScribbleFrame>

          <div className="grid gap-6">
            <ScribbleFrame style={{ ["--paper" as string]: variant === 2 ? "#141a33" : "#ffffffcc" }}>
              <div className="p-5 sm:p-7">
                <div className="aspect-video rounded-[1.5rem] border-[3px] border-current bg-black/10 p-4 shadow-inner">
                  <div className="flex h-full items-center justify-center rounded-[1rem] border-2 border-dashed border-current" style={{ background: `linear-gradient(135deg, ${v.accent}55, ${v.accent2}55)` }}>
                    <div className="grid h-24 w-24 place-items-center rounded-full border-[4px] border-current bg-white/70 text-5xl shadow-[5px_5px_0_rgba(0,0,0,.18)]">▶</div>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <div><p className="text-sm font-black uppercase tracking-[.22em] opacity-60">Teraz na stronie</p><h2 className="text-3xl font-black">Główny materiał tygodnia</h2></div>
                  <span className="rotate-3 rounded-full border-2 border-current px-3 py-2 font-black" style={{ background: v.accent }}>LIVE szkic</span>
                </div>
              </div>
            </ScribbleFrame>

            <ScribbleFrame>
              <div className="p-5 sm:p-7">
                <h2 className="mb-5 text-3xl font-black underline decoration-[5px] underline-offset-4" style={{ textDecorationColor: v.accent2 }}>Kolejne odcinki</h2>
                <div className="space-y-3">
                  {videos.map(([title, time, label], i) => (
                    <div key={title} className="flex items-center gap-4 rounded-[1.2rem] border-2 border-current bg-white/25 p-3">
                      <div className="grid h-16 w-20 shrink-0 place-items-center rounded-xl border-2 border-current text-2xl font-black" style={{ background: i === 0 ? v.accent : v.accent2 }}>{i + 1}</div>
                      <div className="min-w-0 flex-1"><h3 className="truncate text-xl font-black">{title}</h3><p className="font-bold opacity-65">{label} · {time}</p></div>
                      <span className="text-3xl">→</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScribbleFrame>
          </div>
        </section>

        <section className="my-7 grid gap-5 md:grid-cols-4">
          {["odręczne", "kolorowe", "spójne", "gotowe 9/10"].map((word, i) => <div key={word} className="rounded-[1.4rem] border-[3px] border-current bg-white/35 p-5 text-center text-2xl font-black shadow-[4px_5px_0_rgba(0,0,0,.13)]" style={{ background: i % 2 ? v.accent : "white/40" }}>{word}</div>)}
        </section>
      </div>
    </main>
  );
}
