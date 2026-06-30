"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import Link from "next/link";

const INK = "#171717";
const BLUE = "#2563eb";
const PAPER = "#f8f3e7";

function RoughBox({
  children,
  className = "",
  seed = 1,
  roughness = 1.6,
  fill = PAPER,
  stroke = INK,
  strokeWidth = 1.4,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  seed?: number;
  roughness?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;

    const draw = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (!width || !height) return;
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const rc = rough.svg(svg);
      const rect = rc.rectangle(6, 6, width - 12, height - 12, {
        roughness,
        seed,
        fill,
        fillStyle: "solid",
        stroke,
        strokeWidth,
      });
      svg.appendChild(rect);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [roughness, seed, fill, stroke, strokeWidth]);

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={style}>
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function RoughUnderline({ children, color = BLUE }: { children: React.ReactNode; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, {
      type: "underline",
      color,
      strokeWidth: 2.5,
      padding: 2,
      animate: true,
      animationDuration: 700,
    });
    const timer = setTimeout(() => ann.show(), 300);
    return () => {
      clearTimeout(timer);
      ann.remove();
    };
  }, [color]);
  return <span ref={ref}>{children}</span>;
}

function RoughHighlight({ children, color = "#fde68a" }: { children: React.ReactNode; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, {
      type: "highlight",
      color,
      animate: true,
      animationDuration: 900,
    });
    const timer = setTimeout(() => ann.show(), 600);
    return () => {
      clearTimeout(timer);
      ann.remove();
    };
  }, [color]);
  return <span ref={ref}>{children}</span>;
}

const MOCK_VIDEOS = [
  { id: "1", title: "Dlaczego nikt nie mówi prawdy w internecie", duration: "18:42", locked: false, views: 4821 },
  { id: "2", title: "Algorytm cię kontroluje (i wiesz o tym)", duration: "24:11", locked: true, views: 12340 },
  { id: "3", title: "Ekranowy tłum i jego złudzenie wspólnoty", duration: "31:05", locked: true, views: 8970 },
  { id: "4", title: "Wolne słowo kontra korporacyjne filtry", duration: "14:28", locked: false, views: 2140 },
];

export default function E1Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className="min-h-screen"
      style={{ background: PAPER, fontFamily: "var(--font-najs, Kalam, cursive)" }}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-dashed border-[#17171733] bg-[#f8f3e7]/90 backdrop-blur px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-brand tracking-[0.05em] text-[1.35rem] uppercase text-[#171717]">
          Polutek
        </Link>
        <div className="flex gap-2">
          <Link href="/eksperyment2" className="text-xs opacity-50 hover:opacity-100 transition-opacity px-2 py-1">→ Noir</Link>
          <Link href="/eksperyment3" className="text-xs opacity-50 hover:opacity-100 transition-opacity px-2 py-1">→ Editorial</Link>
          <Link href="/kreator" className="text-xs opacity-50 hover:opacity-100 transition-opacity px-2 py-1">→ Kreator</Link>
          <Link href="/" className="text-xs opacity-50 hover:opacity-100 transition-opacity px-2 py-1">→ Oryginał</Link>
        </div>
      </nav>

      {/* Label */}
      <div className="text-center py-3 text-[11px] tracking-widest uppercase opacity-40" style={{ fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}>
        Eksperyment 1 — Rough Press
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* Main player */}
          <div>
            <RoughBox seed={3} roughness={2.2} strokeWidth={1.8} className="overflow-hidden">
              <div
                className="aspect-video w-full flex items-center justify-center"
                style={{ background: "#0d0d0b" }}
              >
                <div className="text-center text-white/70 px-8">
                  <div className="text-5xl mb-4" style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)", letterSpacing: "0.08em", color: BLUE }}>
                    POLUTEK.PL
                  </div>
                  <p className="text-sm opacity-50">Odtwarzacz wideo</p>
                </div>
              </div>
            </RoughBox>

            <div className="mt-4 px-1">
              <h1
                className="text-[1.6rem] leading-tight font-bold text-[#171717] mb-3"
                style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
              >
                {mounted ? (
                  <RoughUnderline color={BLUE}>
                    Dlaczego nikt nie mówi prawdy w internecie
                  </RoughUnderline>
                ) : (
                  "Dlaczego nikt nie mówi prawdy w internecie"
                )}
              </h1>

              <div className="flex items-center gap-4 text-sm opacity-60 mb-4">
                <span>4 821 wyświetleń</span>
                <span>·</span>
                <span>18 min 42 s</span>
                <span>·</span>
                <span>publiczny</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <RoughBox seed={7} roughness={2.8} strokeWidth={1.6} stroke={BLUE} fill={BLUE} className="inline-block">
                  <button className="relative z-10 h-10 px-6 text-white font-bold text-sm" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                    Zaloguj się
                  </button>
                </RoughBox>
                <RoughBox seed={12} roughness={2.4} strokeWidth={1.4} stroke={INK} fill="transparent" className="inline-block">
                  <button className="relative z-10 h-10 px-6 text-[#171717] font-bold text-sm" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                    Udostępnij
                  </button>
                </RoughBox>
              </div>

              <div className="mt-5">
                <RoughBox seed={5} roughness={1.8} strokeWidth={1.2} fill="rgba(248,243,231,0.5)" className="p-4">
                  <p className="text-sm leading-relaxed opacity-70">
                    {mounted ? (
                      <>
                        Niezależny kanał wideo. Materiały{" "}
                        <RoughHighlight>publiczne, patronackie i dla zalogowanych</RoughHighlight>.
                        Bez algorytmów, bez reklam, bez kompromisów.
                      </>
                    ) : (
                      "Niezależny kanał wideo. Materiały publiczne, patronackie i dla zalogowanych. Bez algorytmów, bez reklam, bez kompromisów."
                    )}
                  </p>
                </RoughBox>
              </div>
            </div>
          </div>

          {/* Playlist sidebar */}
          <div>
            <RoughBox seed={9} roughness={1.9} strokeWidth={1.3} className="p-4">
              <h2
                className="text-base font-bold mb-4 pb-2 border-b border-dashed border-[#17171733]"
                style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
              >
                Wszystkie materiały
              </h2>
              <div className="space-y-3">
                {MOCK_VIDEOS.map((v, i) => (
                  <RoughBox
                    key={v.id}
                    seed={i + 20}
                    roughness={2.5}
                    strokeWidth={1.1}
                    fill={i === 0 ? "rgba(37,99,235,0.07)" : "transparent"}
                    stroke={i === 0 ? BLUE : "#17171733"}
                    className="p-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-16 h-10 shrink-0 flex items-center justify-center text-xs rounded"
                        style={{ background: "#0d0d0b", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
                      >
                        {v.duration}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-snug line-clamp-2 text-[#171717]">
                          {v.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] opacity-50">{v.views.toLocaleString("pl")} wyśw.</span>
                          {v.locked && (
                            <span className="text-[10px] font-bold px-1.5 rounded" style={{ background: BLUE, color: "white", fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}>
                              PATRON
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </RoughBox>
                ))}
              </div>
            </RoughBox>

            {/* Donation box */}
            <RoughBox seed={31} roughness={2.1} strokeWidth={1.5} stroke={BLUE} fill="rgba(37,99,235,0.04)" className="p-5 mt-4">
              <h3 className="font-bold text-sm mb-2" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                Wesprzyj kanał
              </h3>
              <p className="text-xs opacity-60 mb-3 leading-relaxed">
                Jednorazowe wsparcie odblokowuje dostęp do treści patronackich na zawsze.
              </p>
              <div className="flex gap-2 flex-wrap">
                {["20 zł", "50 zł", "100 zł"].map((amt) => (
                  <RoughBox key={amt} seed={Math.random() * 100 | 0} roughness={3} strokeWidth={1.2} stroke={BLUE} fill="transparent" className="inline-block">
                    <button className="h-8 px-4 text-xs font-bold text-[#2563eb]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                      {amt}
                    </button>
                  </RoughBox>
                ))}
              </div>
            </RoughBox>
          </div>
        </div>

        {/* Comments skeleton */}
        <div className="mt-8">
          <RoughBox seed={42} roughness={1.7} strokeWidth={1.2} className="p-6">
            <h2 className="font-bold mb-4" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
              Komentarze
            </h2>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#17171715] shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-[#17171712] rounded w-24 mb-2" />
                    <div className="h-3 bg-[#17171709] rounded w-full mb-1" />
                    <div className="h-3 bg-[#17171709] rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </RoughBox>
        </div>
      </div>
    </div>
  );
}
