"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import Link from "next/link";

/* ── shared mock content ── */
const VIDEO_TITLE = "Dlaczego nikt nie mówi prawdy w internecie";
const VIDEO_META = "4 821 wyśw. · 18 min 42 s";
const PLAYLIST = [
  { t: "Algorytm cię kontroluje", d: "24:11", p: true },
  { t: "Ekranowy tłum", d: "31:05", p: true },
  { t: "Wolne słowo", d: "14:28", p: false },
];

/* ── accent presets ── */
const ACCENTS = [
  { name: "Niebieski", v: "#2563eb" },
  { name: "Złoty", v: "#d4a020" },
  { name: "Zieleń", v: "#16a34a" },
  { name: "Fiolet", v: "#7c3aed" },
  { name: "Karmin", v: "#dc2626" },
  { name: "Różowy", v: "#db2777" },
];

/* ── RoughBox ── */
function RB({
  r = 2, s = 1, stroke, fill, sw = 1.4, className = "", children, style,
}: {
  r?: number; s?: number; stroke: string; fill: string; sw?: number;
  className?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = wRef.current; const svg = svgRef.current;
    if (!w || !svg) return;
    const draw = () => {
      const { width: W, height: H } = w.getBoundingClientRect();
      if (!W || !H) return;
      svg.setAttribute("width", String(W)); svg.setAttribute("height", String(H));
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const rc = rough.svg(svg);
      svg.appendChild(rc.rectangle(4, 4, W - 8, H - 8, { roughness: r, seed: s, fill, fillStyle: "solid", stroke, strokeWidth: sw }));
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(w);
    return () => ro.disconnect();
  }, [r, s, stroke, fill, sw]);

  return (
    <div ref={wRef} className={`relative ${className}`} style={style}>
      <svg ref={svgRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ── Rough annotation helpers ── */
function RU({ children, color, delay = 300 }: { children: React.ReactNode; color: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const a = annotate(ref.current, { type: "underline", color, strokeWidth: 2.5, animate: true, animationDuration: 700 });
    const t = setTimeout(() => a.show(), delay);
    return () => { clearTimeout(t); a.remove(); };
  }, [color, delay]);
  return <span ref={ref}>{children}</span>;
}

function RH({ children, color, delay = 500 }: { children: React.ReactNode; color: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const a = annotate(ref.current, { type: "highlight", color, animate: true, animationDuration: 900 });
    const t = setTimeout(() => a.show(), delay);
    return () => { clearTimeout(t); a.remove(); };
  }, [color, delay]);
  return <span ref={ref}>{children}</span>;
}

/* ══════════════════════════════════════════════════════
   STYLE A — ZŁOTO
   Cel: maksymalny wow, złoto jako materiał, papier + atrament
══════════════════════════════════════════════════════ */
const GOLD_CSS = `
@keyframes goldShimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
.gold-shimmer {
  background: linear-gradient(105deg,
    #3d2000 0%, #9a6800 12%, #d4a020 25%,
    #f7e060 40%, #fff5b0 50%,
    #f7e060 60%, #d4a020 75%, #9a6800 88%, #3d2000 100%
  );
  background-size: 260% 100%;
  animation: goldShimmer 4s linear infinite;
  box-shadow: 0 2px 24px rgba(212,160,32,.5), inset 0 1px 0 rgba(255,240,140,.4), inset 0 -1px 0 rgba(60,30,0,.35);
}
@keyframes neonPulse {
  0%,100% { box-shadow: 0 0 8px var(--nc), 0 0 24px var(--nc), inset 0 0 6px rgba(0,220,255,.08); }
  50%      { box-shadow: 0 0 16px var(--nc), 0 0 40px var(--nc), inset 0 0 10px rgba(0,220,255,.14); }
}
.neon-btn {
  animation: neonPulse 2.5s ease-in-out infinite;
}
@keyframes waterIn {
  from { opacity:0; transform: scaleX(0.85); }
  to   { opacity:1; transform: scaleX(1); }
}
`;

function StyleZloto({ accent, mounted }: { accent: string; mounted: boolean }) {
  const BG = "#f8f3e7", INK = "#171717";
  const GOLD = "#d4a020", GOLDDARK = "#b8860b";
  return (
    <div style={{ background: BG, fontFamily: "var(--font-najs, Kalam, cursive)", color: INK, height: "100%" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px dashed ${INK}33` }}>
        <span className="font-brand text-sm tracking-[0.06em] uppercase">Polutek</span>
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD, fontFamily: "var(--font-outfit, sans-serif)" }}>ZŁOTO</span>
      </div>

      <RB r={2.3} s={3} stroke={INK} fill={BG} sw={1.6} className="m-3">
        <div className="aspect-video flex items-center justify-center relative overflow-hidden" style={{ background: "#0d0d0b" }}>
          <span style={{ color: GOLD, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1.1rem", letterSpacing: "0.1em", textShadow: `0 0 30px ${GOLD}88` }}>POLUTEK.PL</span>
        </div>
      </RB>

      <div className="px-4 pb-3">
        <p className="text-[13px] font-bold leading-snug mb-1">
          {mounted ? <RU color={GOLD}>{VIDEO_TITLE}</RU> : VIDEO_TITLE}
        </p>
        <p className="text-[10px] opacity-50 mb-3">{VIDEO_META}</p>

        {/* Gold subscribe button */}
        <div className="flex gap-2 mb-3">
          <div className="relative inline-block">
            <RB r={2.6} s={7} stroke={GOLDDARK} fill="transparent" sw={1.7} className="inline-block">
              <button className="gold-shimmer relative z-10 h-9 px-5 text-[12px] font-bold" style={{ color: "#2d1400", fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                ♪ Subskrajb
              </button>
            </RB>
          </div>
          <RB r={2.3} s={12} stroke={`${INK}55`} fill="transparent" sw={1.1} className="inline-block">
            <button className="relative z-10 h-9 px-4 text-[11px] font-bold" style={{ color: INK }}>Udostępnij</button>
          </RB>
        </div>

        {/* Gold badges */}
        <div className="flex gap-2 mb-3">
          <RB r={3} s={20} stroke={`${INK}40`} fill="transparent" sw={0.9} className="inline-block">
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>PUBLICZNE</span>
          </RB>
          <RB r={3} s={21} stroke={GOLDDARK} fill={`${GOLD}18`} sw={1.3} className="inline-block">
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLDDARK, fontFamily: "var(--font-outfit, sans-serif)" }}>♔ PATRON</span>
          </RB>
        </div>

        <div style={{ borderTop: `1px dashed ${INK}25`, margin: "8px 0" }} />

        {/* Playlist */}
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Playlist</p>
        {PLAYLIST.map((v, i) => (
          <RB key={i} r={2.2} s={30 + i} stroke={i === 0 ? GOLDDARK : `${INK}22`} fill={i === 0 ? `${GOLD}10` : "transparent"} sw={i === 0 ? 1.4 : 0.8} className="mb-1.5">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-11 h-7 flex items-center justify-center text-[9px] shrink-0" style={{ background: "#0d0d0b", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-outfit, sans-serif)" }}>{v.d}</div>
              <span className="text-[10px] flex-1 line-clamp-1 leading-tight">{v.t}</span>
              {v.p && <span className="text-[8px] font-bold shrink-0" style={{ color: GOLDDARK }}>♔</span>}
            </div>
          </RB>
        ))}

        <RB r={2} s={50} stroke={GOLDDARK} fill={`${GOLD}09`} sw={1.5} className="mt-3 p-3">
          <p className="text-[11px] font-bold mb-1.5">Wesprzyj kanał</p>
          <div className="flex gap-1.5">
            {["20 zł", "50 zł", "100 zł"].map((a, i) => (
              <RB key={a} r={3} s={60 + i} stroke={GOLDDARK} fill="transparent" sw={1.1} className="inline-block flex-1">
                <button className="h-7 w-full text-[10px] font-bold" style={{ color: GOLDDARK }}>{a}</button>
              </RB>
            ))}
          </div>
        </RB>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STYLE B — INK (current baseline)
══════════════════════════════════════════════════════ */
function StyleInk({ accent, mounted }: { accent: string; mounted: boolean }) {
  const BG = "#f8f3e7", INK = "#171717";
  return (
    <div style={{ background: BG, fontFamily: "var(--font-najs, Kalam, cursive)", color: INK, height: "100%" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px dashed ${INK}33` }}>
        <span className="font-brand text-sm tracking-[0.06em] uppercase">Polutek</span>
        <span className="text-[10px] opacity-30 tracking-widest uppercase" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>INK (obecny)</span>
      </div>
      <RB r={2.2} s={3} stroke={INK} fill={BG} sw={1.5} className="m-3">
        <div className="aspect-video flex items-center justify-center" style={{ background: "#0d0d0b" }}>
          <span style={{ color: accent, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1rem", letterSpacing: "0.1em" }}>POLUTEK.PL</span>
        </div>
      </RB>
      <div className="px-4 pb-3">
        <p className="text-[13px] font-bold leading-snug mb-1">
          {mounted ? <RU color={accent}>{VIDEO_TITLE}</RU> : VIDEO_TITLE}
        </p>
        <p className="text-[10px] opacity-50 mb-3">{VIDEO_META}</p>
        <div className="flex gap-2 mb-3">
          <RB r={2.6} s={7} stroke={accent} fill={accent} sw={1.5} className="inline-block">
            <button className="relative z-10 h-9 px-5 text-[11px] font-bold text-white">Subskrajb</button>
          </RB>
          <RB r={2.3} s={12} stroke={`${INK}55`} fill="transparent" sw={1.1} className="inline-block">
            <button className="relative z-10 h-9 px-4 text-[11px] font-bold" style={{ color: INK }}>Udostępnij</button>
          </RB>
        </div>
        <div className="flex gap-2 mb-3">
          <RB r={3} s={20} stroke={`${INK}40`} fill="transparent" sw={0.9} className="inline-block">
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>PUBLICZNE</span>
          </RB>
          <RB r={3} s={21} stroke={accent} fill={`${accent}15`} sw={1.2} className="inline-block">
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ color: accent, fontFamily: "var(--font-outfit, sans-serif)" }}>PATRON</span>
          </RB>
        </div>
        <div style={{ borderTop: `1px dashed ${INK}25`, margin: "8px 0" }} />
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Playlist</p>
        {PLAYLIST.map((v, i) => (
          <RB key={i} r={2.2} s={30 + i} stroke={i === 0 ? accent : `${INK}22`} fill={i === 0 ? `${accent}10` : "transparent"} sw={i === 0 ? 1.3 : 0.8} className="mb-1.5">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-11 h-7 flex items-center justify-center text-[9px] shrink-0" style={{ background: "#0d0d0b", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-outfit, sans-serif)" }}>{v.d}</div>
              <span className="text-[10px] flex-1 line-clamp-1 leading-tight">{v.t}</span>
              {v.p && <span className="text-[8px] font-bold shrink-0" style={{ color: accent, fontFamily: "var(--font-outfit, sans-serif)" }}>P</span>}
            </div>
          </RB>
        ))}
        <RB r={2} s={50} stroke={accent} fill={`${accent}08`} sw={1.4} className="mt-3 p-3">
          <p className="text-[11px] font-bold mb-1.5">Wesprzyj kanał</p>
          <div className="flex gap-1.5">
            {["20 zł", "50 zł", "100 zł"].map((a, i) => (
              <RB key={a} r={3} s={60 + i} stroke={accent} fill="transparent" sw={1} className="inline-block flex-1">
                <button className="h-7 w-full text-[10px] font-bold" style={{ color: accent }}>{a}</button>
              </RB>
            ))}
          </div>
        </RB>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STYLE C — NEON INK
   Ciemne tło, świecące roughjs granice, atrament na nocy
══════════════════════════════════════════════════════ */
function StyleNeon({ accent, mounted }: { accent: string; mounted: boolean }) {
  const BG = "#0c0c0a", BG2 = "#161612";
  const TEXT = "#f0ede5", DIM = "rgba(240,237,229,0.42)";
  const NEON = accent;
  const neonGlow = `0 0 8px ${NEON}, 0 0 24px ${NEON}55`;
  return (
    <div style={{ background: BG, fontFamily: "var(--font-najs, Kalam, cursive)", color: TEXT, height: "100%" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: NEON, boxShadow: neonGlow }} />
          <span className="font-brand text-sm tracking-[0.06em] uppercase">Polutek</span>
        </div>
        <span className="text-[10px] tracking-widest uppercase" style={{ color: NEON, fontFamily: "var(--font-outfit, sans-serif)", textShadow: `0 0 8px ${NEON}` }}>NEON INK</span>
      </div>
      <RB r={2.3} s={4} stroke={NEON} fill={BG} sw={1.6} className="m-3" style={{ filter: `drop-shadow(0 0 6px ${NEON}55)` }}>
        <div className="aspect-video flex items-center justify-center relative overflow-hidden" style={{ background: "#000" }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${NEON}08 0%, transparent 70%)` }} />
          <span className="relative" style={{ color: NEON, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1rem", letterSpacing: "0.1em", textShadow: `0 0 20px ${NEON}` }}>POLUTEK.PL</span>
        </div>
      </RB>
      <div className="px-4 pb-3">
        <p className="text-[13px] font-bold leading-snug mb-1">{VIDEO_TITLE}</p>
        <p className="text-[10px] mb-3" style={{ color: DIM }}>{VIDEO_META}</p>
        <div className="flex gap-2 mb-3">
          <RB r={2.5} s={8} stroke={NEON} fill="transparent" sw={1.7} className="inline-block" style={{ filter: `drop-shadow(0 0 4px ${NEON}66)` }}>
            <button className="relative z-10 h-9 px-5 text-[11px] font-bold" style={{ color: NEON }}>Subskrajb</button>
          </RB>
          <RB r={2.2} s={13} stroke="rgba(255,255,255,0.15)" fill="transparent" sw={1} className="inline-block">
            <button className="relative z-10 h-9 px-4 text-[11px] font-bold" style={{ color: DIM }}>Udostępnij</button>
          </RB>
        </div>
        <div className="flex gap-2 mb-3">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest border font-bold" style={{ borderColor: "rgba(255,255,255,0.15)", color: DIM, fontFamily: "var(--font-outfit, sans-serif)" }}>PUBLICZNE</span>
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ background: `${NEON}20`, border: `1px solid ${NEON}55`, color: NEON, fontFamily: "var(--font-outfit, sans-serif)", textShadow: `0 0 6px ${NEON}` }}>PATRON</span>
        </div>
        <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
        <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: DIM, fontFamily: "var(--font-outfit, sans-serif)" }}>Playlist</p>
        {PLAYLIST.map((v, i) => (
          <div key={i} className="flex items-center gap-2 mb-1.5 py-2" style={{
            borderLeft: i === 0 ? `2px solid ${NEON}` : "2px solid transparent",
            paddingLeft: "6px",
            background: i === 0 ? `${NEON}08` : "transparent",
          }}>
            <div className="w-11 h-7 flex items-center justify-center text-[9px] shrink-0" style={{ background: "#000", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "var(--font-outfit, sans-serif)" }}>{v.d}</div>
            <span className="text-[10px] flex-1 line-clamp-1 leading-tight" style={{ color: i === 0 ? TEXT : DIM }}>{v.t}</span>
            {v.p && <span className="text-[9px] font-bold shrink-0" style={{ color: NEON, textShadow: `0 0 6px ${NEON}` }}>●</span>}
          </div>
        ))}
        <div className="mt-3 p-3" style={{ border: `1px solid ${NEON}35`, background: `${NEON}06`, boxShadow: `0 0 20px ${NEON}10` }}>
          <p className="text-[11px] font-bold mb-1.5">Wesprzyj kanał</p>
          <div className="flex gap-1.5">
            {["20 zł", "50 zł", "100 zł"].map((a) => (
              <button key={a} className="h-7 px-2 text-[10px] font-bold flex-1" style={{ border: `1px solid ${NEON}45`, color: NEON, background: "transparent" }}>{a}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STYLE D — AKWARELA
   Miękkie watercolor washe za roughjs liniami, elegancja
══════════════════════════════════════════════════════ */
function StyleAkwarela({ accent, mounted }: { accent: string; mounted: boolean }) {
  const BG = "#fffefa", INK = "#1a1814";
  const wash = (hex: string, a: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const A = accent;
  return (
    <div style={{ background: BG, fontFamily: "var(--font-caveat, Caveat, cursive)", color: INK, height: "100%" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `0.8px solid ${INK}20` }}>
        <span className="font-bold text-[15px]">Polutek</span>
        <span className="text-[10px] opacity-30 tracking-widest uppercase" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>AKWARELA</span>
      </div>
      {/* Player — rough line, watercolor fill */}
      <RB r={1.8} s={5} stroke={`${INK}60`} fill={wash(A, 0.06)} sw={1.2} className="m-3">
        <div className="aspect-video flex items-center justify-center relative" style={{ background: "transparent" }}>
          <span style={{ color: A, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1rem", letterSpacing: "0.1em", opacity: 0.8 }}>POLUTEK.PL</span>
        </div>
      </RB>
      <div className="px-4 pb-3">
        <p className="text-[15px] font-bold leading-snug mb-1">
          {mounted ? <RH color={wash(A, 0.25)}>{VIDEO_TITLE}</RH> : VIDEO_TITLE}
        </p>
        <p className="text-[10px] opacity-40 mb-3" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>{VIDEO_META}</p>
        <div className="flex gap-2 mb-3">
          <RB r={1.6} s={9} stroke={A} fill={wash(A, 0.15)} sw={1.3} className="inline-block">
            <button className="relative z-10 h-9 px-5 text-[12px] font-bold" style={{ color: A }}>Subskrajb</button>
          </RB>
          <RB r={1.5} s={14} stroke={`${INK}30`} fill="transparent" sw={0.9} className="inline-block">
            <button className="relative z-10 h-9 px-4 text-[12px] font-bold" style={{ color: INK, opacity: 0.6 }}>Udostępnij</button>
          </RB>
        </div>
        <div className="flex gap-2 mb-3">
          <RB r={2} s={22} stroke={`${INK}25`} fill={`${INK}05`} sw={0.8} className="inline-block">
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest" style={{ fontFamily: "var(--font-outfit, sans-serif)", opacity: 0.6 }}>PUBLICZNE</span>
          </RB>
          <RB r={2} s={23} stroke={A} fill={wash(A, 0.18)} sw={1.1} className="inline-block">
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ color: A, fontFamily: "var(--font-outfit, sans-serif)" }}>PATRON</span>
          </RB>
        </div>
        {/* watercolor separator */}
        <div className="my-2 h-[2px] rounded-full" style={{ background: `linear-gradient(to right, transparent, ${wash(A, 0.3)}, transparent)` }} />
        <p className="text-[11px] font-bold mb-2 opacity-50">Playlist</p>
        {PLAYLIST.map((v, i) => (
          <RB key={i} r={1.5} s={33 + i} stroke={i === 0 ? A : `${INK}18`} fill={i === 0 ? wash(A, 0.09) : "transparent"} sw={i === 0 ? 1.1 : 0.7} className="mb-1.5">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-11 h-7 flex items-center justify-center text-[9px] shrink-0 rounded" style={{ background: wash(A, 0.1), color: A, fontFamily: "var(--font-outfit, sans-serif)" }}>{v.d}</div>
              <span className="text-[11px] flex-1 line-clamp-1 leading-tight">{v.t}</span>
              {v.p && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: wash(A, 0.5) }} />}
            </div>
          </RB>
        ))}
        <RB r={1.5} s={55} stroke={A} fill={wash(A, 0.07)} sw={1.2} className="mt-3 p-3">
          <p className="text-[13px] font-bold mb-2">Wesprzyj kanał</p>
          <div className="flex gap-1.5">
            {["20 zł", "50 zł", "100 zł"].map((a, i) => (
              <RB key={a} r={2} s={62 + i} stroke={A} fill={wash(A, 0.12)} sw={0.9} className="inline-block flex-1">
                <button className="h-7 w-full text-[11px] font-bold" style={{ color: A }}>{a}</button>
              </RB>
            ))}
          </div>
        </RB>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STYLE E — BRUTALIST
   Grube linie 3px+, duże typo, czarno-białe + akcent
══════════════════════════════════════════════════════ */
function StyleBrutalist({ accent, mounted }: { accent: string; mounted: boolean }) {
  const BG = "#f5f2eb", INK = "#0a0a08";
  return (
    <div style={{ background: BG, fontFamily: "var(--font-outfit, Outfit, sans-serif)", color: INK, height: "100%" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `3px solid ${INK}` }}>
        <span className="font-bold text-[13px] tracking-[0.08em] uppercase" style={{ fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1rem" }}>Polutek</span>
        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ background: accent, color: "white", padding: "2px 6px" }}>BRUTAL</span>
      </div>
      <RB r={3.5} s={6} stroke={INK} fill={BG} sw={3} className="m-3">
        <div className="aspect-video flex items-center justify-center" style={{ background: INK }}>
          <span style={{ color: accent, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1.2rem", letterSpacing: "0.12em" }}>POLUTEK.PL</span>
        </div>
      </RB>
      <div className="px-4 pb-3">
        <p className="text-[1rem] font-black leading-tight mb-1 uppercase" style={{ fontFamily: "var(--font-brand, Bebas Neue)", letterSpacing: "0.02em" }}>
          {VIDEO_TITLE}
        </p>
        <p className="text-[10px] font-bold opacity-40 mb-3 uppercase tracking-widest">{VIDEO_META}</p>
        <div className="flex gap-2 mb-3">
          <RB r={3.2} s={9} stroke={INK} fill={accent} sw={2.5} className="inline-block">
            <button className="relative z-10 h-9 px-5 text-[11px] font-black text-white uppercase tracking-widest">Subskrajb</button>
          </RB>
          <RB r={3} s={14} stroke={INK} fill="transparent" sw={2} className="inline-block">
            <button className="relative z-10 h-9 px-4 text-[11px] font-black uppercase tracking-widest" style={{ color: INK }}>→ Udostępnij</button>
          </RB>
        </div>
        <div className="flex gap-2 mb-3">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-black border-2" style={{ borderColor: INK }}>PUBLICZNE</span>
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-black text-white" style={{ background: accent }}>PATRON</span>
        </div>
        <div style={{ height: "3px", background: INK, margin: "10px 0" }} />
        <p className="text-[9px] font-black uppercase tracking-widest mb-2">Playlist</p>
        {PLAYLIST.map((v, i) => (
          <div key={i} className="flex items-center gap-2 mb-1.5" style={{ borderLeft: `3px solid ${i === 0 ? accent : INK}`, paddingLeft: "6px", background: i === 0 ? `${accent}12` : "transparent" }}>
            <span className="text-[9px] font-mono font-bold opacity-50 shrink-0">{v.d}</span>
            <span className="text-[10px] flex-1 line-clamp-1 font-bold">{v.t}</span>
            {v.p && <span className="text-[8px] font-black shrink-0 text-white px-1" style={{ background: accent }}>P</span>}
          </div>
        ))}
        <div className="mt-3 p-3" style={{ border: `3px solid ${INK}` }}>
          <p className="text-[12px] font-black uppercase mb-2">Wesprzyj kanał</p>
          <div className="flex gap-1.5">
            {["20 zł", "50 zł", "100 zł"].map((a) => (
              <button key={a} className="h-7 px-2 text-[10px] font-black uppercase flex-1 transition-all hover:bg-black hover:text-white" style={{ border: `2px solid ${INK}`, background: "transparent" }}>{a}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════ */
const STYLES = [
  { id: "zloto", label: "Złoto", desc: "metaliczny blask + roughjs", Component: StyleZloto },
  { id: "ink", label: "Ink", desc: "obecny baseline", Component: StyleInk },
  { id: "neon", label: "Neon Ink", desc: "ciemność + glow", Component: StyleNeon },
  { id: "akwarela", label: "Akwarela", desc: "watercolor + Caveat", Component: StyleAkwarela },
  { id: "brutalist", label: "Brutalist", desc: "3px+ border, czarno-białe", Component: StyleBrutalist },
];

export default function StylerClient() {
  const [accent, setAccent] = useState("#2563eb");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a08", color: "#f0ede5", fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}>
      <style>{GOLD_CSS}</style>

      {/* Top bar */}
      <div className="sticky top-0 z-50 px-5 h-11 flex items-center justify-between" style={{ background: "#0a0a08ee", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold tracking-widest uppercase opacity-70">Styler</span>
          <span className="text-[10px] opacity-20">5 kierunków stylu · ten sam kanał</span>
        </div>
        <div className="flex items-center gap-4">
          {/* color switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] opacity-30 mr-1">akcent:</span>
            {ACCENTS.map((p) => (
              <button
                key={p.v}
                title={p.name}
                onClick={() => setAccent(p.v)}
                className="w-4 h-4 rounded-full transition-all hover:scale-125"
                style={{
                  background: p.v,
                  border: accent === p.v ? "2px solid white" : "2px solid rgba(255,255,255,0.12)",
                  boxShadow: accent === p.v ? `0 0 10px ${p.v}` : "none",
                }}
              />
            ))}
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
              className="w-4 h-4 rounded-full cursor-pointer opacity-40 hover:opacity-100 transition-opacity border-0"
              style={{ padding: 0 }} title="własny" />
          </div>
          <div className="flex gap-3 text-[11px] opacity-30">
            <Link href="/" className="hover:opacity-100 transition-opacity">← Główna</Link>
          </div>
        </div>
      </div>

      {/* style headers */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${STYLES.length}, 1fr)`, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {STYLES.map((s) => (
          <div key={s.id} className="px-3 py-2 text-center" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[12px] font-bold tracking-wide" style={{ color: accent }}>{s.label}</div>
            <div className="text-[9px] opacity-30 mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* style columns */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${STYLES.length}, 1fr)`, alignItems: "start" }}>
        {STYLES.map((s, idx) => (
          <div key={s.id} style={{ borderRight: "1px solid rgba(255,255,255,0.05)", minWidth: 0 }}>
            <s.Component accent={accent} mounted={mounted} />
          </div>
        ))}
      </div>

      {/* footer */}
      <div className="px-6 py-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-[10px] opacity-20">Zmień kolor akcentu u góry — aktualizuje wszystkie 5 kolumn jednocześnie.</span>
        <Link href="/" className="text-[11px] opacity-30 hover:opacity-70 transition-opacity">← Wróć do głównej</Link>
      </div>
    </div>
  );
}
