"use client";

import React, { useEffect, useRef, useState } from "react";
import { annotate } from "rough-notation";
import Link from "next/link";

const BLUE = "#2563eb";
const PAPER = "#fafaf8";
const INK = "#171717";
const RULE = "#17171718";

const MOCK_VIDEOS = [
  { id: "1", title: "Dlaczego nikt nie mówi prawdy w internecie", duration: "18:42", locked: false, views: 4821, col: 1 },
  { id: "2", title: "Algorytm cię kontroluje (i wiesz o tym)", duration: "24:11", locked: true, views: 12340, col: 2 },
  { id: "3", title: "Ekranowy tłum i jego złudzenie wspólnoty", duration: "31:05", locked: true, views: 8970, col: 3 },
  { id: "4", title: "Wolne słowo kontra korporacyjne filtry", duration: "14:28", locked: false, views: 2140, col: 1 },
];

function BoxAnnotation({ children, color = "#fde68a" }: { children: React.ReactNode; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, {
      type: "box",
      color,
      strokeWidth: 2,
      animate: true,
      animationDuration: 800,
    });
    const t = setTimeout(() => ann.show(), 400);
    return () => { clearTimeout(t); ann.remove(); };
  }, [color]);
  return <span ref={ref}>{children}</span>;
}

function CircleAnnotation({ children, color = BLUE }: { children: React.ReactNode; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, {
      type: "circle",
      color,
      strokeWidth: 2.5,
      animate: true,
      animationDuration: 900,
      padding: 6,
    });
    const t = setTimeout(() => ann.show(), 600);
    return () => { clearTimeout(t); ann.remove(); };
  }, [color]);
  return <span ref={ref}>{children}</span>;
}

export default function E3Home() {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState("1");
  useEffect(() => setMounted(true), []);
  const video = MOCK_VIDEOS.find((v) => v.id === active) || MOCK_VIDEOS[0];

  return (
    <div
      className="min-h-screen"
      style={{ background: PAPER, color: INK, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
    >
      {/* Masthead */}
      <header style={{ borderBottom: `3px double ${INK}` }}>
        <div className="max-w-6xl mx-auto px-4">
          <div
            className="flex items-center justify-between py-1 text-[10px] tracking-widest uppercase"
            style={{ borderBottom: `1px solid ${RULE}`, color: "rgba(23,23,23,0.4)" }}
          >
            <span>Niezależne media</span>
            <div className="flex gap-4">
              <Link href="/eksperyment1" className="hover:underline">→ Rough Press</Link>
              <Link href="/eksperyment2" className="hover:underline">→ Noir</Link>
              <Link href="/kreator" className="hover:underline">→ Kreator</Link>
              <Link href="/" className="hover:underline">→ Oryginał</Link>
            </div>
          </div>
          <div className="text-center py-5">
            <div
              className="text-[3.5rem] leading-none tracking-[0.06em] uppercase"
              style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)" }}
            >
              Polutek.pl
            </div>
            <div
              className="text-[10px] tracking-[0.25em] uppercase mt-1"
              style={{ color: "rgba(23,23,23,0.45)" }}
            >
              Eksperyment 3 — Editorial
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Hero headline */}
        <div
          className="pb-6 mb-6"
          style={{ borderBottom: `2px solid ${INK}` }}
        >
          <h1
            className="text-[2.8rem] sm:text-[4rem] leading-[0.9] uppercase tracking-tight mb-4"
            style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)" }}
          >
            {mounted ? (
              <>
                <BoxAnnotation color="#fde68a">Dlaczego nikt</BoxAnnotation>
                <br />
                nie mówi
                <br />
                <span style={{ color: BLUE }}>prawdy</span>
                <br />
                w internecie
              </>
            ) : (
              "Dlaczego nikt nie mówi prawdy w internecie"
            )}
          </h1>
          <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(23,23,23,0.5)" }}>
            <span>4 821 wyświetleń</span>
            <span>·</span>
            <span>18 min 42 s</span>
            <span>·</span>
            <span style={{ fontStyle: "italic" }}>publiczny</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          {/* Player + description */}
          <div>
            <div
              className="aspect-video w-full mb-5 flex items-center justify-center"
              style={{ background: "#0d0d0b", border: `1px solid ${RULE}` }}
            >
              <div className="text-center">
                <div
                  className="text-5xl mb-2"
                  style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)", color: BLUE, letterSpacing: "0.1em" }}
                >
                  POLUTEK.PL
                </div>
                <p className="text-xs text-white/40">Odtwarzacz wideo</p>
              </div>
            </div>

            <div className="flex gap-3 mb-5">
              <button
                className="h-10 px-6 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
                style={{ background: BLUE, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
              >
                Zaloguj się
              </button>
              <button
                className="h-10 px-6 text-sm font-medium transition-all hover:bg-black/5 active:scale-95"
                style={{ border: `1px solid ${RULE}`, background: "transparent" }}
              >
                Udostępnij
              </button>
            </div>

            {/* Description in newspaper columns */}
            <div
              className="text-sm leading-relaxed mb-6 pb-6"
              style={{
                columnCount: 2,
                columnGap: "2rem",
                columnRule: `1px solid ${RULE}`,
                borderBottom: `1px solid ${RULE}`,
                color: "rgba(23,23,23,0.7)",
              }}
            >
              Niezależny kanał wideo — bez algorytmów, bez reklam, bez kompromisów.
              Materiały dostępne publicznie, dla zalogowanych i dla patronów.
              Jednorazowe wsparcie odblokowuje dostęp do treści patronackich na zawsze.
              To nie jest subskrypcja cykliczna — to wyraz solidarności z niezależnymi mediami.
              Każdy materiał jest efektem pracy bez zewnętrznego finansowania i bez nacisku wydawców.
            </div>

            {/* Comments */}
            <div>
              <h2
                className="text-lg uppercase tracking-widest mb-4"
                style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)", borderBottom: `1px solid ${RULE}`, paddingBottom: "0.5rem" }}
              >
                Komentarze
              </h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3" style={{ paddingBottom: "1rem", borderBottom: `1px solid ${RULE}` }}>
                    <div className="w-8 h-8 rounded-full bg-black/5 shrink-0" />
                    <div className="flex-1">
                      <div className="h-2.5 rounded w-20 mb-2 bg-black/10" />
                      <div className="h-2.5 rounded w-full mb-1.5 bg-black/6" />
                      <div className="h-2.5 rounded w-2/3 bg-black/6" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar — playlist + donate */}
          <div>
            <div style={{ borderLeft: `2px solid ${INK}`, paddingLeft: "1.5rem" }}>
              <h2
                className="text-lg uppercase tracking-widest mb-4"
                style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)" }}
              >
                Wszystkie materiały
              </h2>
              <div className="space-y-0">
                {MOCK_VIDEOS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setActive(v.id)}
                    className="w-full text-left py-4 block"
                    style={{ borderBottom: `1px solid ${RULE}` }}
                  >
                    <p
                      className="text-sm font-semibold leading-snug mb-1 line-clamp-2"
                      style={{ color: v.id === active ? BLUE : INK, textDecoration: v.id === active ? "underline" : "none" }}
                    >
                      {v.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: "rgba(23,23,23,0.4)" }}>
                      <span>{v.duration}</span>
                      <span>·</span>
                      <span>{v.views.toLocaleString("pl")} wyśw.</span>
                      {v.locked && (
                        <span
                          className="font-bold tracking-widest"
                          style={{ color: BLUE, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
                        >
                          PATRON
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Donate */}
              <div className="mt-6 p-4" style={{ border: `1px solid ${INK}` }}>
                <h3
                  className="text-base uppercase tracking-widest mb-2"
                  style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)" }}
                >
                  {mounted ? <CircleAnnotation color={BLUE}>Wesprzyj</CircleAnnotation> : "Wesprzyj"} kanał
                </h3>
                <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(23,23,23,0.6)" }}>
                  Jednorazowe wsparcie. Brak subskrypcji. Dostęp na zawsze.
                </p>
                <div className="flex gap-2">
                  {["20 zł", "50 zł", "100 zł"].map((amt) => (
                    <button
                      key={amt}
                      className="flex-1 h-8 text-xs font-bold transition-all hover:bg-black hover:text-white active:scale-95"
                      style={{ border: `1px solid ${INK}`, background: "transparent" }}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
