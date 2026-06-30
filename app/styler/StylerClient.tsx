"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import Link from "next/link";

/* ─── shared mock data ─── */
const VIDEO = {
  title: "Dlaczego nikt nie mówi prawdy w internecie",
  duration: "18:42",
  views: "4 821",
};
const PLAYLIST = [
  { title: "Algorytm cię kontroluje", duration: "24:11", patron: true },
  { title: "Ekranowy tłum", duration: "31:05", patron: true },
  { title: "Wolne słowo", duration: "14:28", patron: false },
];

/* ─── roughjs box (reusable) ─── */
function RoughRect({
  roughness = 2,
  seed = 1,
  stroke,
  fill,
  strokeWidth = 1.4,
  className = "",
  children,
  style,
}: {
  roughness?: number;
  seed?: number;
  stroke: string;
  fill: string;
  strokeWidth?: number;
  className?: string;
  children: React.ReactNode;
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
      svg.appendChild(
        rc.rectangle(4, 4, width - 8, height - 8, {
          roughness,
          seed,
          fill,
          fillStyle: "solid",
          stroke,
          strokeWidth,
        })
      );
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [roughness, seed, stroke, fill, strokeWidth]);

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={style}>
      <svg ref={svgRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ─── rough-notation underline ─── */
function RoughUnder({ children, color, delay = 400 }: { children: React.ReactNode; color: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, { type: "underline", color, strokeWidth: 2.5, animate: true, animationDuration: 600 });
    const t = setTimeout(() => ann.show(), delay);
    return () => { clearTimeout(t); ann.remove(); };
  }, [color, delay]);
  return <span ref={ref}>{children}</span>;
}

function RoughHighlight({ children, color, delay = 600 }: { children: React.ReactNode; color: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, { type: "highlight", color, animate: true, animationDuration: 800 });
    const t = setTimeout(() => ann.show(), delay);
    return () => { clearTimeout(t); ann.remove(); };
  }, [color, delay]);
  return <span ref={ref}>{children}</span>;
}

/* ════════════════════════════════════════════════
   STYLE 1 — INK
   Kalam, roughjs, papier, czarny atrament
════════════════════════════════════════════════ */
function ColInk({ accent, mounted }: { accent: string; mounted: boolean }) {
  const bg = "#f8f3e7";
  const ink = "#171717";
  return (
    <div style={{ background: bg, fontFamily: "var(--font-najs, Kalam, cursive)", color: ink }}>
      {/* header */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `1px dashed ${ink}44` }}>
        <span className="font-brand tracking-[0.06em] uppercase text-sm">Polutek</span>
        <span className="text-[10px] opacity-40 uppercase tracking-widest" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Ink</span>
      </div>

      {/* player */}
      <RoughRect roughness={2.4} seed={3} stroke={ink} fill={bg} strokeWidth={1.6} className="m-2">
        <div className="aspect-video flex items-center justify-center text-xs" style={{ background: "#0d0d0b", color: accent, fontFamily: "var(--font-brand, Bebas Neue)" }}>
          POLUTEK.PL
        </div>
      </RoughRect>

      {/* title */}
      <div className="px-3 pt-1 pb-2">
        <p className="text-[13px] font-bold leading-snug mb-1">
          {mounted ? <RoughUnder color={accent}>{VIDEO.title}</RoughUnder> : VIDEO.title}
        </p>
        <p className="text-[10px] opacity-50">{VIDEO.views} wyśw. · {VIDEO.duration}</p>
      </div>

      {/* buttons */}
      <div className="px-3 flex gap-2 pb-2">
        <RoughRect roughness={2.8} seed={7} stroke={accent} fill={accent} strokeWidth={1.5} className="inline-block">
          <button className="h-8 px-4 text-[11px] font-bold text-white">Zaloguj się</button>
        </RoughRect>
        <RoughRect roughness={2.5} seed={12} stroke={ink} fill="transparent" strokeWidth={1.2} className="inline-block">
          <button className="h-8 px-4 text-[11px] font-bold" style={{ color: ink }}>Udostępnij</button>
        </RoughRect>
      </div>

      {/* badges */}
      <div className="px-3 flex gap-1.5 pb-2">
        <RoughRect roughness={3} seed={20} stroke={ink} fill="transparent" strokeWidth={1} className="inline-block">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>PUBLICZNE</span>
        </RoughRect>
        <RoughRect roughness={3} seed={21} stroke={accent} fill={`${accent}18`} strokeWidth={1.2} className="inline-block">
          <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest" style={{ color: accent, fontFamily: "var(--font-outfit, sans-serif)" }}>PATRON</span>
        </RoughRect>
      </div>

      {/* separator */}
      <div className="mx-3 my-1" style={{ borderTop: `1px dashed ${ink}33` }} />

      {/* playlist */}
      <div className="px-3 pb-2">
        <p className="text-[10px] font-bold mb-1.5 uppercase opacity-40" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Playlist</p>
        {PLAYLIST.map((v, i) => (
          <RoughRect key={i} roughness={2.2} seed={30 + i} stroke={ink + "33"} fill="transparent" strokeWidth={0.9} className="mb-1.5">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-10 h-6 flex items-center justify-center text-[9px] shrink-0" style={{ background: "#0d0d0b", color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-outfit, sans-serif)" }}>{v.duration}</div>
              <span className="text-[10px] flex-1 leading-tight line-clamp-1">{v.title}</span>
              {v.patron && <span className="text-[8px] font-bold shrink-0" style={{ color: accent, fontFamily: "var(--font-outfit, sans-serif)" }}>P</span>}
            </div>
          </RoughRect>
        ))}
      </div>

      {/* donate */}
      <RoughRect roughness={2} seed={50} stroke={accent} fill={`${accent}08`} strokeWidth={1.4} className="mx-3 mb-3 p-2.5">
        <p className="text-[11px] font-bold mb-1">Wesprzyj kanał</p>
        <div className="flex gap-1.5">
          {["20 zł", "50 zł", "100 zł"].map((a) => (
            <RoughRect key={a} roughness={3} seed={Math.random() * 99 | 0} stroke={accent} fill="transparent" strokeWidth={1} className="inline-block">
              <button className="h-6 px-2 text-[9px] font-bold" style={{ color: accent }}>{a}</button>
            </RoughRect>
          ))}
        </div>
      </RoughRect>

      {/* description */}
      <div className="mx-3 mb-3">
        {mounted
          ? <p className="text-[10px] leading-relaxed opacity-60">Materiały <RoughHighlight color="#fde68a">publiczne, patronackie i dla zalogowanych</RoughHighlight>. Bez reklam.</p>
          : <p className="text-[10px] leading-relaxed opacity-60">Materiały publiczne, patronackie i dla zalogowanych. Bez reklam.</p>
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   STYLE 2 — CIENKOPIS
   Outfit, 0.6px lines, pill buttons, clean
════════════════════════════════════════════════ */
function ColCienkopis({ accent }: { accent: string }) {
  const bg = "#fafaf8";
  const ink = "#1a1a18";
  const subtle = `${ink}12`;
  return (
    <div style={{ background: bg, fontFamily: "var(--font-outfit, Outfit, sans-serif)", color: ink }}>
      {/* header */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `0.6px solid ${ink}20` }}>
        <span className="font-bold tracking-[0.08em] uppercase text-[13px]" style={{ fontFamily: "var(--font-brand, Bebas Neue)" }}>Polutek</span>
        <span className="text-[10px] opacity-30 uppercase tracking-widest">Cienkopis</span>
      </div>

      {/* player */}
      <div className="m-2 aspect-video flex items-center justify-center" style={{ background: "#0d0d0b", border: `0.6px solid ${ink}18`, color: accent, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1rem", letterSpacing: "0.08em" }}>
        POLUTEK.PL
      </div>

      {/* title */}
      <div className="px-3 pt-1 pb-2">
        <p className="text-[12px] font-semibold leading-snug mb-1" style={{ borderBottom: `0.6px solid ${accent}`, paddingBottom: "2px", display: "inline" }}>
          {VIDEO.title}
        </p>
        <p className="text-[10px] opacity-40 mt-1.5">{VIDEO.views} wyśw. · {VIDEO.duration}</p>
      </div>

      {/* buttons */}
      <div className="px-3 flex gap-2 pb-2">
        <button
          className="h-8 px-4 text-[11px] font-bold text-white transition-all"
          style={{ background: accent, borderRadius: "999px" }}
        >
          Zaloguj się
        </button>
        <button
          className="h-8 px-4 text-[11px] font-medium transition-all"
          style={{ border: `0.8px solid ${ink}30`, borderRadius: "999px", background: "transparent" }}
        >
          Udostępnij
        </button>
      </div>

      {/* badges */}
      <div className="px-3 flex gap-1.5 pb-2">
        <span className="px-2.5 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ border: `0.6px solid ${ink}30`, borderRadius: "999px", color: ink + "80" }}>PUBLICZNE</span>
        <span className="px-2.5 py-0.5 text-[9px] uppercase tracking-widest font-bold text-white" style={{ background: accent, borderRadius: "999px" }}>PATRON</span>
      </div>

      {/* separator */}
      <div className="mx-3 my-1.5 flex items-center gap-2">
        <div className="flex-1" style={{ height: "0.6px", background: `${ink}14` }} />
        <span className="text-[9px] opacity-30 tracking-widest uppercase">Playlist</span>
        <div className="flex-1" style={{ height: "0.6px", background: `${ink}14` }} />
      </div>

      {/* playlist */}
      <div className="px-3 pb-2 space-y-1">
        {PLAYLIST.map((v, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: `0.6px solid ${ink}0e` }}>
            <div className="w-10 h-6 flex items-center justify-center text-[9px] shrink-0 font-mono" style={{ background: "#0d0d0b", color: "rgba(255,255,255,0.4)" }}>{v.duration}</div>
            <span className="text-[10px] flex-1 leading-tight line-clamp-1">{v.title}</span>
            {v.patron && <span className="text-[8px] font-bold shrink-0 px-1.5 py-0.5 text-white" style={{ background: accent, borderRadius: "999px" }}>P</span>}
          </div>
        ))}
      </div>

      {/* donate */}
      <div className="mx-3 mb-3 p-2.5" style={{ border: `0.6px solid ${accent}50`, borderRadius: "8px" }}>
        <p className="text-[11px] font-semibold mb-1.5">Wesprzyj kanał</p>
        <div className="flex gap-1.5">
          {["20 zł", "50 zł", "100 zł"].map((a) => (
            <button key={a} className="h-6 px-2.5 text-[9px] font-bold flex-1 transition-all" style={{ border: `0.8px solid ${accent}`, borderRadius: "999px", color: accent }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* description */}
      <p className="mx-3 mb-3 text-[10px] leading-relaxed opacity-40">
        Materiały publiczne, patronackie i dla zalogowanych. Bez reklam.
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════
   STYLE 3 — SPLASH
   Caveat, roughjs grubszy, żółty+niebieski, biały bg
════════════════════════════════════════════════ */
function ColSplash({ accent, mounted }: { accent: string; mounted: boolean }) {
  const bg = "#ffffff";
  const ink = "#1a1a18";
  const yellow = "#fde047";
  return (
    <div style={{ background: bg, fontFamily: "var(--font-caveat, Caveat, cursive)", color: ink }}>
      {/* header */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `2px solid ${ink}` }}>
        <span className="font-bold text-[15px] tracking-wide">Polutek</span>
        <span className="text-[9px] opacity-30 uppercase tracking-widest" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Splash</span>
      </div>

      {/* player */}
      <RoughRect roughness={2.8} seed={5} stroke={ink} fill="#0d0d0b" strokeWidth={2.2} className="m-2">
        <div className="aspect-video flex items-center justify-center" style={{ color: accent, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1.1rem", letterSpacing: "0.1em" }}>
          POLUTEK.PL
        </div>
      </RoughRect>

      {/* title */}
      <div className="px-3 pt-1 pb-2">
        <p className="text-[15px] font-bold leading-snug mb-1">
          {mounted ? <RoughHighlight color={yellow}>{VIDEO.title}</RoughHighlight> : VIDEO.title}
        </p>
        <p className="text-[10px] opacity-50" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>{VIDEO.views} wyśw. · {VIDEO.duration}</p>
      </div>

      {/* buttons */}
      <div className="px-3 flex gap-2 pb-2">
        <RoughRect roughness={2.6} seed={8} stroke={accent} fill={accent} strokeWidth={2} className="inline-block">
          <button className="h-8 px-4 text-[12px] font-bold text-white">Zaloguj się</button>
        </RoughRect>
        <RoughRect roughness={2.4} seed={14} stroke={ink} fill="transparent" strokeWidth={1.8} className="inline-block">
          <button className="h-8 px-4 text-[12px] font-bold" style={{ color: ink }}>Udostępnij</button>
        </RoughRect>
      </div>

      {/* badges */}
      <div className="px-3 flex gap-1.5 pb-2">
        <RoughRect roughness={3.5} seed={22} stroke={ink} fill={yellow} strokeWidth={1.5} className="inline-block">
          <span className="px-2 py-0.5 text-[10px] font-bold" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>PUBLICZNE</span>
        </RoughRect>
        <RoughRect roughness={3} seed={23} stroke={accent} fill={accent} strokeWidth={1.5} className="inline-block">
          <span className="px-2 py-0.5 text-[10px] font-bold text-white" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>PATRON</span>
        </RoughRect>
      </div>

      {/* separator */}
      <div className="mx-3 my-1" style={{ borderTop: `2px solid ${ink}` }} />

      {/* playlist */}
      <div className="px-3 pb-2">
        <p className="text-[11px] font-bold mb-1.5 uppercase" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Playlist</p>
        {PLAYLIST.map((v, i) => (
          <RoughRect key={i} roughness={2.5} seed={32 + i} stroke={i === 0 ? accent : `${ink}33`} fill={i === 0 ? `${accent}10` : "transparent"} strokeWidth={i === 0 ? 1.6 : 0.9} className="mb-1.5">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-10 h-6 flex items-center justify-center text-[9px] shrink-0" style={{ background: "#0d0d0b", color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-outfit, sans-serif)" }}>{v.duration}</div>
              <span className="text-[11px] flex-1 leading-tight line-clamp-1">{v.title}</span>
              {v.patron && <span className="text-[8px] font-bold shrink-0 px-1 py-0.5 text-white" style={{ background: accent, fontFamily: "var(--font-outfit, sans-serif)" }}>P</span>}
            </div>
          </RoughRect>
        ))}
      </div>

      {/* donate */}
      <RoughRect roughness={2.2} seed={55} stroke={accent} fill={`${yellow}40`} strokeWidth={2} className="mx-3 mb-3 p-2.5">
        <p className="text-[13px] font-bold mb-1">Wesprzyj kanał</p>
        <div className="flex gap-1.5">
          {["20 zł", "50 zł", "100 zł"].map((a) => (
            <RoughRect key={a} roughness={3.2} seed={Math.random() * 99 | 0} stroke={ink} fill="transparent" strokeWidth={1.5} className="inline-block flex-1">
              <button className="h-6 w-full text-[10px] font-bold" style={{ color: ink }}>{a}</button>
            </RoughRect>
          ))}
        </div>
      </RoughRect>
    </div>
  );
}

/* ════════════════════════════════════════════════
   STYLE 4 — MONO
   Dark, Space Grotesk, glow, zero roughjs
════════════════════════════════════════════════ */
function ColMono({ accent }: { accent: string }) {
  const bg = "#0f0f0d";
  const bg2 = "#1a1a17";
  const text = "#f0ede6";
  const dim = "rgba(240,237,230,0.38)";
  const border = "rgba(240,237,230,0.08)";
  return (
    <div style={{ background: bg, fontFamily: "var(--font-space-grotesk, Space Grotesk, sans-serif)", color: text }}>
      {/* header */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
          <span className="font-bold tracking-[0.06em] text-sm" style={{ fontFamily: "var(--font-brand, Bebas Neue)" }}>Polutek</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: dim }}>Mono</span>
      </div>

      {/* player */}
      <div className="m-2 aspect-video flex items-center justify-center relative overflow-hidden" style={{ background: "#000", border: `1px solid ${border}` }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)" }} />
        <span className="relative" style={{ color: accent, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "1rem", letterSpacing: "0.1em", textShadow: `0 0 24px ${accent}88` }}>POLUTEK.PL</span>
      </div>

      {/* title */}
      <div className="px-3 pt-1 pb-2">
        <p className="text-[12px] font-semibold leading-snug mb-1" style={{ color: text }}>{VIDEO.title}</p>
        <p className="text-[10px]" style={{ color: dim }}>{VIDEO.views} wyśw. · {VIDEO.duration}</p>
      </div>

      {/* buttons */}
      <div className="px-3 flex gap-2 pb-2">
        <button
          className="h-8 px-4 text-[11px] font-bold text-white transition-all"
          style={{ background: accent, boxShadow: `0 0 14px ${accent}44` }}
        >
          Zaloguj się
        </button>
        <button
          className="h-8 px-4 text-[11px] font-medium transition-all"
          style={{ border: `1px solid ${border}`, color: dim, background: "transparent" }}
        >
          Udostępnij
        </button>
      </div>

      {/* badges */}
      <div className="px-3 flex gap-1.5 pb-2">
        <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ border: `1px solid ${border}`, color: dim }}>PUBLICZNE</span>
        <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold text-white" style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent }}>PATRON</span>
      </div>

      {/* separator */}
      <div className="mx-3 my-1.5" style={{ height: "1px", background: border }} />

      {/* playlist */}
      <div className="px-3 pb-2 space-y-0">
        {PLAYLIST.map((v, i) => (
          <div key={i} className="flex items-center gap-2 py-2" style={{ borderLeft: i === 0 ? `2px solid ${accent}` : "2px solid transparent", paddingLeft: "6px", background: i === 0 ? `${accent}08` : "transparent" }}>
            <div className="w-10 h-6 flex items-center justify-center text-[9px] shrink-0 font-mono" style={{ background: "#000", color: "rgba(255,255,255,0.35)", border: `1px solid ${border}` }}>{v.duration}</div>
            <span className="text-[10px] flex-1 leading-tight line-clamp-1" style={{ color: i === 0 ? text : dim }}>{v.title}</span>
            {v.patron && <span className="text-[8px] font-bold shrink-0" style={{ color: accent }}>●</span>}
          </div>
        ))}
      </div>

      {/* donate */}
      <div className="mx-3 mb-3 p-2.5" style={{ border: `1px solid ${accent}30`, background: `${accent}06`, boxShadow: `0 0 20px ${accent}08` }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="inline-block w-1 h-1 rounded-full" style={{ background: accent, boxShadow: `0 0 4px ${accent}` }} />
          <p className="text-[11px] font-semibold">Wesprzyj kanał</p>
        </div>
        <div className="flex gap-1.5">
          {["20 zł", "50 zł", "100 zł"].map((a) => (
            <button key={a} className="h-6 px-2 text-[9px] font-bold flex-1 transition-all" style={{ border: `1px solid ${accent}40`, color: accent, background: "transparent" }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* description */}
      <p className="mx-3 mb-3 text-[10px] leading-relaxed" style={{ color: dim }}>
        Materiały publiczne, patronackie i dla zalogowanych. Bez reklam.
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════
   STYLE 5 — PRESS
   Bebas Neue headers, double rule, 2-col, Patrick Hand body
════════════════════════════════════════════════ */
function ColPress({ accent, mounted }: { accent: string; mounted: boolean }) {
  const bg = "#f5f2eb";
  const ink = "#1a1a14";
  const rule = `${ink}1a`;
  return (
    <div style={{ background: bg, fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)", color: ink }}>
      {/* masthead */}
      <div className="px-3 pt-2 pb-1.5 text-center" style={{ borderBottom: `2.5px double ${ink}` }}>
        <div className="text-[1.1rem] leading-none tracking-[0.06em] uppercase" style={{ fontFamily: "var(--font-brand, Bebas Neue)" }}>Polutek</div>
        <div className="text-[8px] tracking-[0.2em] uppercase opacity-40 mt-0.5" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>Press</div>
      </div>

      {/* player */}
      <div className="m-2 aspect-video flex items-center justify-center" style={{ background: "#0d0d0b", border: `1px solid ${rule}`, color: accent, fontFamily: "var(--font-brand, Bebas Neue)", fontSize: "0.95rem", letterSpacing: "0.08em" }}>
        POLUTEK.PL
      </div>

      {/* headline */}
      <div className="px-3 pt-1 pb-1.5" style={{ borderBottom: `1.5px solid ${ink}` }}>
        <p className="text-[0.85rem] leading-tight font-bold uppercase tracking-tight" style={{ fontFamily: "var(--font-brand, Bebas Neue)" }}>
          {mounted ? <RoughUnder color={accent} delay={500}>{VIDEO.title}</RoughUnder> : VIDEO.title}
        </p>
        <p className="text-[9px] opacity-50 mt-0.5" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>{VIDEO.views} wyśw. · {VIDEO.duration}</p>
      </div>

      {/* buttons */}
      <div className="px-3 pt-2 flex gap-2 pb-2">
        <button className="h-8 px-4 text-[11px] font-bold text-white" style={{ background: ink, fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}>
          → Zaloguj się
        </button>
        <button className="h-8 px-4 text-[11px] font-medium" style={{ border: `1px solid ${ink}`, fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}>
          Udostępnij
        </button>
      </div>

      {/* badges */}
      <div className="px-3 flex gap-1.5 pb-1.5">
        <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ border: `1px solid ${ink}`, fontFamily: "var(--font-outfit, sans-serif)" }}>PUBLICZNE</span>
        <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold" style={{ border: `1px solid ${accent}`, color: accent, fontFamily: "var(--font-outfit, sans-serif)" }}>PATRON</span>
      </div>

      {/* two-col body */}
      <div className="mx-3 py-1.5 text-[9.5px] leading-relaxed" style={{ borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`, columnCount: 2, columnGap: "12px", columnRule: `1px solid ${rule}`, color: `${ink}88` }}>
        Niezależny kanał. Materiały publiczne, patronackie i dla zalogowanych. Bez algorytmów, bez reklam.
      </div>

      {/* playlist */}
      <div className="px-3 pt-1.5 pb-1">
        <div className="text-[9px] uppercase tracking-widest opacity-40 mb-1.5 flex items-center gap-2" style={{ fontFamily: "var(--font-outfit, sans-serif)" }}>
          <div className="flex-1" style={{ height: "1px", background: rule }} />
          Playlist
          <div className="flex-1" style={{ height: "1px", background: rule }} />
        </div>
        {PLAYLIST.map((v, i) => (
          <div key={i} className="flex items-center gap-2 py-1" style={{ borderBottom: `1px solid ${rule}` }}>
            <span className="text-[9px] font-mono opacity-40 shrink-0">{v.duration}</span>
            <span className="text-[10px] flex-1 leading-tight line-clamp-1">{v.title}</span>
            {v.patron && <span className="text-[8px] font-bold shrink-0" style={{ color: accent, fontFamily: "var(--font-outfit, sans-serif)" }}>P</span>}
          </div>
        ))}
      </div>

      {/* donate */}
      <div className="mx-3 mt-2 mb-3 p-2.5" style={{ border: `1px solid ${ink}` }}>
        <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ fontFamily: "var(--font-brand, Bebas Neue)" }}>Wesprzyj kanał</p>
        <div className="flex gap-1.5">
          {["20 zł", "50 zł", "100 zł"].map((a) => (
            <button key={a} className="h-6 px-2 text-[10px] font-bold flex-1 transition-all hover:bg-black hover:text-white" style={{ border: `1px solid ${ink}`, background: "transparent", fontFamily: "var(--font-patrick, 'Patrick Hand')" }}>
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════ */
const ACCENT_PRESETS = [
  { label: "Niebieski", value: "#2563eb" },
  { label: "Zieleń", value: "#16a34a" },
  { label: "Czerwień", value: "#dc2626" },
  { label: "Fiolet", value: "#7c3aed" },
  { label: "Bursztyn", value: "#d97706" },
  { label: "Różowy", value: "#db2777" },
];

export default function StylerClient() {
  const [accent, setAccent] = useState("#2563eb");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const COLS = [
    { id: "ink", label: "Ink", Component: () => <ColInk accent={accent} mounted={mounted} /> },
    { id: "cienkopis", label: "Cienkopis", Component: () => <ColCienkopis accent={accent} /> },
    { id: "splash", label: "Splash", Component: () => <ColSplash accent={accent} mounted={mounted} /> },
    { id: "mono", label: "Mono", Component: () => <ColMono accent={accent} /> },
    { id: "press", label: "Press", Component: () => <ColPress accent={accent} mounted={mounted} /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0b", color: "#f0ede6", fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 flex items-center justify-between h-12" style={{ background: "#0d0d0b", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold tracking-wide opacity-80">Styler</span>
          <span className="text-[11px] opacity-30">5 stylów · te same komponenty</span>
        </div>
        <div className="flex items-center gap-3">
          {/* accent presets */}
          <div className="flex items-center gap-1.5">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                title={p.label}
                onClick={() => setAccent(p.value)}
                className="w-5 h-5 rounded-full transition-transform hover:scale-125"
                style={{
                  background: p.value,
                  border: accent === p.value ? `2px solid white` : "2px solid rgba(255,255,255,0.15)",
                  boxShadow: accent === p.value ? `0 0 8px ${p.value}` : "none",
                }}
              />
            ))}
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="w-5 h-5 rounded-full cursor-pointer border-0 opacity-60 hover:opacity-100 transition-opacity"
              style={{ padding: 0 }}
              title="Własny kolor"
            />
          </div>
          {/* links */}
          <div className="flex gap-2 text-[11px] opacity-30">
            <Link href="/kreator" className="hover:opacity-100 transition-opacity">Kreator</Link>
            <Link href="/eksperyment1" className="hover:opacity-100 transition-opacity">E1</Link>
            <Link href="/eksperyment2" className="hover:opacity-100 transition-opacity">E2</Link>
            <Link href="/eksperyment3" className="hover:opacity-100 transition-opacity">E3</Link>
            <Link href="/" className="hover:opacity-100 transition-opacity">← Oryginał</Link>
          </div>
        </div>
      </div>

      {/* Style name bar */}
      <div className="grid border-b" style={{ gridTemplateColumns: `repeat(${COLS.length}, 1fr)`, borderColor: "rgba(255,255,255,0.07)" }}>
        {COLS.map((col) => (
          <div key={col.id} className="px-3 py-2 text-center" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: accent }}>{col.label}</span>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS.length}, 1fr)` }}>
        {COLS.map((col) => (
          <div key={col.id} className="overflow-hidden" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", minWidth: 0 }}>
            <col.Component />
          </div>
        ))}
      </div>

      {/* Footer legend */}
      <div className="px-6 py-6 mt-2 flex flex-wrap gap-4 justify-center text-[11px]" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}>
        <span><b style={{ color: "rgba(255,255,255,0.5)" }}>Ink</b> — obecny styl, roughjs + Kalam</span>
        <span>·</span>
        <span><b style={{ color: "rgba(255,255,255,0.5)" }}>Cienkopis</b> — 0.6px, pill, Outfit</span>
        <span>·</span>
        <span><b style={{ color: "rgba(255,255,255,0.5)" }}>Splash</b> — Caveat, żółty akcent, grubszy rough</span>
        <span>·</span>
        <span><b style={{ color: "rgba(255,255,255,0.5)" }}>Mono</b> — ciemny, Space Grotesk, glow</span>
        <span>·</span>
        <span><b style={{ color: "rgba(255,255,255,0.5)" }}>Press</b> — Bebas Neue, double rule, kolumny</span>
        <span>·</span>
        <span>Kolor akcentu zmienia się we wszystkich kolumnach jednocześnie</span>
      </div>
    </div>
  );
}
