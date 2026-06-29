"use client";

import React, { useState, Suspense } from "react";
import dynamic from "next/dynamic";

const FontSection = dynamic(() => import("./sections/FontSection"), { ssr: false });
const LinesSection = dynamic(() => import("./sections/LinesSection"), { ssr: false });
const BorderSection = dynamic(() => import("./sections/BorderSection"), { ssr: false });
const NotationSection = dynamic(() => import("./sections/NotationSection"), { ssr: false });
const WiredSection = dynamic(() => import("./sections/WiredSection"), { ssr: false });
const PaperSection = dynamic(() => import("./sections/PaperSection"), { ssr: false });
const ButtonsSection = dynamic(() => import("./sections/ButtonsSection"), { ssr: false });
const PatternsSection = dynamic(() => import("./sections/PatternsSection"), { ssr: false });
const PlaygroundSection = dynamic(() => import("./sections/PlaygroundSection"), { ssr: false });

const SECTIONS = [
  { id: "czcionki", label: "Czcionki", icon: "✍️", count: 8 },
  { id: "linie", label: "Linie", icon: "📏", count: 9 },
  { id: "ramki", label: "Ramki", icon: "⬜", count: 11 },
  { id: "notacja", label: "Rough Notation", icon: "🖊️", count: 10 },
  { id: "wired", label: "Wired Elements", icon: "🔌", count: 6 },
  { id: "papier", label: "Tła Papierowe", icon: "📄", count: 8 },
  { id: "przyciski", label: "Przyciski", icon: "🔲", count: 7 },
  { id: "wzorce", label: "Wzorce", icon: "🎨", count: 5 },
  { id: "playground", label: "Playground", icon: "🎮", count: null },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-neutral-400 text-sm flex items-center gap-2">
        <span className="animate-spin">⟳</span>
        Ładowanie sekcji...
      </div>
    </div>
  );
}

export default function KatalogClient() {
  const [active, setActive] = useState<SectionId>("czcionki");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeSection = SECTIONS.find(s => s.id === active);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fdfbf7" }}>
      {/* Noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: 0.04,
        }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/" className="text-[11px] font-mono text-neutral-400 hover:text-neutral-700 transition-colors">
              ← polutek.pl
            </a>
            <span className="text-neutral-200">/</span>
            <span className="font-black uppercase tracking-tighter text-neutral-900">Katalog Technik</span>
            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">v2</span>
          </div>

          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  active === s.id
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
                {s.count !== null && (
                  <span className={`text-[10px] rounded-full px-1 ${active === s.id ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-400"}`}>
                    {s.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            className="md:hidden text-sm font-semibold text-neutral-700 border border-neutral-200 rounded-lg px-3 py-1.5"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {activeSection?.icon} {activeSection?.label}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-100 bg-white px-4 py-3 grid grid-cols-3 gap-2">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => { setActive(s.id); setMobileMenuOpen(false); }}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-xs transition-all ${
                  active === s.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <span className="text-base">{s.icon}</span>
                <span className="font-semibold text-[10px] text-center">{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Secondary tab bar — visual breadcrumb */}
      <div className="sticky top-14 z-40 border-b border-neutral-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto scrollbar-none">
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  active === s.id
                    ? "border-neutral-900 text-neutral-900"
                    : "border-transparent text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span className="text-sm">{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
                {s.count !== null && (
                  <span className={`hidden sm:inline text-[10px] px-1 rounded ${active === s.id ? "text-neutral-600" : "text-neutral-300"}`}>
                    {s.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<SectionLoader />}>
          {active === "czcionki" && <FontSection />}
          {active === "linie" && <LinesSection />}
          {active === "ramki" && <BorderSection />}
          {active === "notacja" && <NotationSection />}
          {active === "wired" && <WiredSection />}
          {active === "papier" && <PaperSection />}
          {active === "przyciski" && <ButtonsSection />}
          {active === "wzorce" && <PatternsSection />}
          {active === "playground" && <PlaygroundSection />}
        </Suspense>
      </main>

      {/* Footer nav */}
      <div className="relative z-10 border-t border-neutral-200 bg-white/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-neutral-400">
          <span>Polutek.pl — Katalog Technik Rysunkowych</span>
          <div className="flex gap-3">
            {SECTIONS.map(s => {
              const idx = SECTIONS.findIndex(x => x.id === active);
              const sidx = SECTIONS.findIndex(x => x.id === s.id);
              if (sidx !== idx - 1 && sidx !== idx + 1) return null;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className="hover:text-neutral-700 transition-colors font-medium"
                >
                  {sidx === idx - 1 ? `← ${s.label}` : `${s.label} →`}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
