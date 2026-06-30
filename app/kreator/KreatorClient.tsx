"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import Link from "next/link";

/* ── types ── */
type Theme = "najs" | "noir" | "editorial" | "custom";
type FontId = "najs" | "outfit" | "brand" | "caveat" | "patrick";
type ButtonVariant = "rough" | "pill" | "square" | "ghost";

interface StyleState {
  theme: Theme;
  accent: string;
  bg: string;
  ink: string;
  fontId: FontId;
  roughness: number;
  buttonVariant: ButtonVariant;
  showAnnotations: boolean;
}

/* ── presets ── */
const PRESETS: Record<Theme, Omit<StyleState, "theme">> = {
  najs: {
    accent: "#2563eb",
    bg: "#f8f3e7",
    ink: "#171717",
    fontId: "najs",
    roughness: 2.2,
    buttonVariant: "rough",
    showAnnotations: true,
  },
  noir: {
    accent: "#2563eb",
    bg: "#100f0c",
    ink: "#f8f3e7",
    fontId: "outfit",
    roughness: 0,
    buttonVariant: "square",
    showAnnotations: false,
  },
  editorial: {
    accent: "#2563eb",
    bg: "#fafaf8",
    ink: "#171717",
    fontId: "brand",
    roughness: 0,
    buttonVariant: "square",
    showAnnotations: true,
  },
  custom: {
    accent: "#2563eb",
    bg: "#f8f3e7",
    ink: "#171717",
    fontId: "najs",
    roughness: 1.5,
    buttonVariant: "pill",
    showAnnotations: false,
  },
};

const FONTS: { id: FontId; label: string; css: string }[] = [
  { id: "najs", label: "Kalam (najs)", css: "var(--font-najs, Kalam, cursive)" },
  { id: "outfit", label: "Outfit (clean)", css: "var(--font-outfit, Outfit, sans-serif)" },
  { id: "brand", label: "Bebas Neue (brand)", css: "var(--font-brand, Bebas Neue, sans-serif)" },
  { id: "caveat", label: "Caveat (sketchy)", css: "var(--font-caveat, Caveat, cursive)" },
  { id: "patrick", label: "Patrick Hand (notes)", css: "var(--font-patrick, 'Patrick Hand', cursive)" },
];

const BUTTON_VARIANTS: { id: ButtonVariant; label: string }[] = [
  { id: "rough", label: "Rough SVG" },
  { id: "pill", label: "Pill" },
  { id: "square", label: "Square" },
  { id: "ghost", label: "Ghost" },
];

/* ── helpers ── */
function getFontCss(id: FontId) {
  return FONTS.find((f) => f.id === id)?.css ?? FONTS[0].css;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

/* ── RoughFrame ── */
function RoughFrame({
  roughness,
  stroke,
  fill,
  seed = 1,
  strokeWidth = 1.6,
  children,
  className = "",
}: {
  roughness: number;
  stroke: string;
  fill: string;
  seed?: number;
  strokeWidth?: number;
  children: React.ReactNode;
  className?: string;
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
      if (roughness === 0) return;
      const rc = rough.svg(svg);
      const rect = rc.rectangle(5, 5, width - 10, height - 10, {
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
  }, [roughness, stroke, fill, seed, strokeWidth]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {roughness > 0 && (
        <svg ref={svgRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ── StyledButton ── */
function StyledButton({
  children,
  variant,
  accent,
  ink,
  bg,
  roughness,
  fontCss,
  outlined = false,
}: {
  children: React.ReactNode;
  variant: ButtonVariant;
  accent: string;
  ink: string;
  bg: string;
  roughness: number;
  fontCss: string;
  outlined?: boolean;
}) {
  if (variant === "rough") {
    return (
      <RoughFrame
        roughness={Math.max(roughness, 1.5)}
        stroke={outlined ? ink : accent}
        fill={outlined ? bg : accent}
        seed={outlined ? 17 : 7}
        strokeWidth={1.6}
        className="inline-block"
      >
        <button
          type="button"
          className="relative z-10 h-10 px-7 font-bold text-sm transition-all active:scale-95"
          style={{ fontFamily: fontCss, color: outlined ? ink : "white" }}
        >
          {children}
        </button>
      </RoughFrame>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        className="h-10 px-7 font-bold text-sm rounded-full transition-all hover:brightness-110 active:scale-95"
        style={{
          fontFamily: fontCss,
          background: outlined ? "transparent" : accent,
          color: outlined ? accent : "white",
          border: `2px solid ${accent}`,
          boxShadow: outlined ? "none" : `0 4px 16px rgba(${hexToRgb(accent)},0.28)`,
        }}
      >
        {children}
      </button>
    );
  }

  if (variant === "ghost") {
    return (
      <button
        type="button"
        className="h-10 px-7 font-bold text-sm transition-all hover:bg-black/5 active:scale-95"
        style={{
          fontFamily: fontCss,
          background: "transparent",
          color: outlined ? `rgba(${hexToRgb(ink)},0.5)` : accent,
          borderBottom: `2px solid ${outlined ? `rgba(${hexToRgb(ink)},0.2)` : accent}`,
        }}
      >
        {children}
      </button>
    );
  }

  // square
  return (
    <button
      type="button"
      className="h-10 px-7 font-bold text-sm transition-all hover:brightness-110 active:scale-95"
      style={{
        fontFamily: fontCss,
        background: outlined ? "transparent" : accent,
        color: outlined ? accent : "white",
        border: `1.5px solid ${outlined ? accent : "transparent"}`,
        boxShadow: outlined ? "none" : `0 2px 12px rgba(${hexToRgb(accent)},0.22)`,
      }}
    >
      {children}
    </button>
  );
}

/* ── AnnotatedTitle ── */
function AnnotatedTitle({ text, color, fontCss }: { text: string; color: string; fontCss: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, {
      type: "underline",
      color,
      strokeWidth: 3,
      animate: true,
      animationDuration: 800,
    });
    const t = setTimeout(() => ann.show(), 400);
    return () => { clearTimeout(t); ann.remove(); };
  }, [color]);
  return (
    <span ref={ref} style={{ fontFamily: fontCss }}>
      {text}
    </span>
  );
}

/* ── Control helpers ── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 opacity-60">
      {children}
    </label>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border-0"
        style={{ padding: "1px" }}
      />
      <code className="text-xs opacity-60">{value}</code>
    </div>
  );
}

const MOCK_VIDEOS = [
  { id: "1", title: "Dlaczego nikt nie mówi prawdy w internecie", duration: "18:42", locked: false },
  { id: "2", title: "Algorytm cię kontroluje (i wiesz o tym)", duration: "24:11", locked: true },
  { id: "3", title: "Wolne słowo kontra filtry", duration: "14:28", locked: false },
];

/* ── Main ── */
export default function KreatorClient() {
  const [s, setS] = useState<StyleState>({ theme: "najs", ...PRESETS.najs });
  const [mounted, setMounted] = useState(false);
  const [activeVideo, setActiveVideo] = useState("1");

  useEffect(() => setMounted(true), []);

  const applyPreset = (theme: Theme) => setS({ theme, ...PRESETS[theme] });

  const isDark = s.bg.startsWith("#0") || s.bg.startsWith("#1") || parseInt(s.bg.slice(1, 3), 16) < 60;
  const fontCss = getFontCss(s.fontId);
  const borderColor = isDark ? `rgba(${hexToRgb(s.ink)},0.15)` : `rgba(${hexToRgb(s.ink)},0.12)`;
  const textDim = isDark ? `rgba(${hexToRgb(s.ink)},0.5)` : `rgba(${hexToRgb(s.ink)},0.5)`;
  const panelBg = isDark
    ? `rgba(255,255,255,0.04)`
    : `rgba(${hexToRgb(s.ink)},0.03)`;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: "#0d0d0b", color: "#f8f3e7", fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}>

      {/* ── Controls panel ── */}
      <aside className="w-full lg:w-[300px] shrink-0 overflow-y-auto" style={{ background: "#141412", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-base font-bold tracking-wide">Kreator stylu</h1>
            <Link href="/" className="text-[11px] opacity-40 hover:opacity-100 transition-opacity">← Oryginał</Link>
          </div>

          {/* Theme presets */}
          <div className="mb-5">
            <Label>Preset stylu</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["najs", "noir", "editorial", "custom"] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyPreset(t)}
                  className="h-9 text-xs font-bold rounded transition-all"
                  style={{
                    background: s.theme === t ? s.accent : "rgba(255,255,255,0.06)",
                    color: s.theme === t ? "white" : "rgba(255,255,255,0.6)",
                    border: s.theme === t ? `1px solid ${s.accent}` : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {t === "najs" ? "Rough Press" : t === "editorial" ? "Editorial" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Accent */}
            <div>
              <Label>Kolor akcentu</Label>
              <ColorPicker value={s.accent} onChange={(v) => setS((p) => ({ ...p, accent: v, theme: "custom" }))} />
            </div>

            {/* Background */}
            <div>
              <Label>Tło</Label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {["#f8f3e7", "#fafaf8", "#ffffff", "#100f0c", "#1a1915", "#0a0a08"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setS((p) => ({ ...p, bg: c, theme: "custom" }))}
                    className="w-8 h-8 rounded transition-transform hover:scale-110"
                    style={{
                      background: c,
                      border: s.bg === c ? `2px solid ${s.accent}` : "2px solid rgba(255,255,255,0.1)",
                    }}
                  />
                ))}
              </div>
              <ColorPicker value={s.bg} onChange={(v) => setS((p) => ({ ...p, bg: v, theme: "custom" }))} />
            </div>

            {/* Ink */}
            <div>
              <Label>Kolor tekstu</Label>
              <div className="flex gap-2 mb-2">
                {["#171717", "#f8f3e7", "#2563eb"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setS((p) => ({ ...p, ink: c, theme: "custom" }))}
                    className="w-8 h-8 rounded transition-transform hover:scale-110"
                    style={{ background: c, border: s.ink === c ? `2px solid ${s.accent}` : "2px solid rgba(255,255,255,0.1)" }}
                  />
                ))}
              </div>
              <ColorPicker value={s.ink} onChange={(v) => setS((p) => ({ ...p, ink: v, theme: "custom" }))} />
            </div>

            {/* Font */}
            <div>
              <Label>Czcionka</Label>
              <div className="space-y-1">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setS((p) => ({ ...p, fontId: f.id, theme: "custom" }))}
                    className="w-full text-left px-3 h-9 text-sm rounded transition-all"
                    style={{
                      fontFamily: f.css,
                      background: s.fontId === f.id ? `rgba(${hexToRgb(s.accent)},0.15)` : "rgba(255,255,255,0.04)",
                      color: s.fontId === f.id ? s.accent : "rgba(255,255,255,0.6)",
                      border: s.fontId === f.id ? `1px solid rgba(${hexToRgb(s.accent)},0.4)` : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Roughness */}
            <div>
              <Label>Szorstkość (roughjs): {s.roughness.toFixed(1)}</Label>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={s.roughness}
                onChange={(e) => setS((p) => ({ ...p, roughness: parseFloat(e.target.value), theme: "custom" }))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] opacity-40 mt-0.5">
                <span>0 (gładki)</span>
                <span>4 (chaotyczny)</span>
              </div>
            </div>

            {/* Button variant */}
            <div>
              <Label>Styl przycisku</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {BUTTON_VARIANTS.map((bv) => (
                  <button
                    key={bv.id}
                    type="button"
                    onClick={() => setS((p) => ({ ...p, buttonVariant: bv.id, theme: "custom" }))}
                    className="h-8 text-xs font-medium rounded transition-all"
                    style={{
                      background: s.buttonVariant === bv.id ? `rgba(${hexToRgb(s.accent)},0.15)` : "rgba(255,255,255,0.05)",
                      color: s.buttonVariant === bv.id ? s.accent : "rgba(255,255,255,0.5)",
                      border: s.buttonVariant === bv.id ? `1px solid rgba(${hexToRgb(s.accent)},0.4)` : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {bv.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Annotations toggle */}
            <div>
              <Label>Rough-notation</Label>
              <button
                type="button"
                onClick={() => setS((p) => ({ ...p, showAnnotations: !p.showAnnotations, theme: "custom" }))}
                className="w-full h-9 text-sm font-medium rounded transition-all"
                style={{
                  background: s.showAnnotations ? `rgba(${hexToRgb(s.accent)},0.12)` : "rgba(255,255,255,0.05)",
                  color: s.showAnnotations ? s.accent : "rgba(255,255,255,0.4)",
                  border: s.showAnnotations ? `1px solid rgba(${hexToRgb(s.accent)},0.3)` : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {s.showAnnotations ? "✓ Włączone animacje" : "Wyłączone"}
              </button>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-1">
            <Link href="/eksperyment1" className="text-xs opacity-40 hover:opacity-80 transition-opacity py-0.5">→ Eksperyment 1 — Rough Press</Link>
            <Link href="/eksperyment2" className="text-xs opacity-40 hover:opacity-80 transition-opacity py-0.5">→ Eksperyment 2 — Noir</Link>
            <Link href="/eksperyment3" className="text-xs opacity-40 hover:opacity-80 transition-opacity py-0.5">→ Eksperyment 3 — Editorial</Link>
          </div>
        </div>
      </aside>

      {/* ── Live preview ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: s.bg, color: s.ink }}>
        {/* Inner nav preview */}
        <nav
          className="sticky top-0 z-50 px-5 flex items-center justify-between h-14"
          style={{
            background: isDark ? `${s.bg}ee` : `${s.bg}f0`,
            backdropFilter: "blur(8px)",
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <span
            className="text-[1.25rem] tracking-[0.06em] uppercase font-bold"
            style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)", color: s.ink }}
          >
            Polutek
          </span>
          <span className="text-xs" style={{ color: textDim }}>podgląd na żywo</span>
        </nav>

        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
            {/* Player + info */}
            <div>
              {/* Player box */}
              <RoughFrame
                roughness={s.roughness}
                stroke={s.ink}
                fill={s.bg}
                seed={3}
                strokeWidth={1.8}
                className="overflow-hidden mb-4"
              >
                <div
                  className="aspect-video flex items-center justify-center"
                  style={{ background: isDark ? "#0d0d0b" : "#0d0d0b" }}
                >
                  <div className="text-center">
                    <div
                      className="text-4xl mb-2"
                      style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)", color: s.accent, letterSpacing: "0.08em" }}
                    >
                      POLUTEK.PL
                    </div>
                    <p className="text-xs text-white/40">Odtwarzacz wideo</p>
                  </div>
                </div>
              </RoughFrame>

              {/* Title */}
              <h1
                className="text-[1.5rem] font-bold leading-snug mb-2"
                style={{ fontFamily: fontCss }}
              >
                {mounted && s.showAnnotations ? (
                  <AnnotatedTitle
                    key={`${s.accent}-${s.showAnnotations}-${s.fontId}`}
                    text="Dlaczego nikt nie mówi prawdy w internecie"
                    color={s.accent}
                    fontCss={fontCss}
                  />
                ) : (
                  "Dlaczego nikt nie mówi prawdy w internecie"
                )}
              </h1>

              <div className="flex items-center gap-3 text-xs mb-4" style={{ color: textDim, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}>
                <span>4 821 wyświetleń</span>
                <span>·</span>
                <span>18 min 42 s</span>
                <span>·</span>
                <span>publiczny</span>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap gap-3 mb-5">
                <StyledButton
                  variant={s.buttonVariant}
                  accent={s.accent}
                  ink={s.ink}
                  bg={s.bg}
                  roughness={s.roughness}
                  fontCss={fontCss}
                >
                  Zaloguj się
                </StyledButton>
                <StyledButton
                  variant={s.buttonVariant}
                  accent={s.accent}
                  ink={s.ink}
                  bg={s.bg}
                  roughness={s.roughness}
                  fontCss={fontCss}
                  outlined
                >
                  Udostępnij
                </StyledButton>
              </div>

              {/* Description */}
              <RoughFrame
                roughness={s.roughness * 0.7}
                stroke={`rgba(${hexToRgb(s.ink)},0.25)`}
                fill={panelBg}
                seed={5}
                className="p-4 mb-5"
              >
                <p className="text-sm leading-relaxed" style={{ color: textDim, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}>
                  Niezależny kanał wideo. Materiały publiczne, dla zalogowanych i patronackie.
                  Bez algorytmów, bez reklam, bez kompromisów.
                </p>
              </RoughFrame>

              {/* Comments skeleton */}
              <RoughFrame
                roughness={s.roughness * 0.6}
                stroke={borderColor}
                fill={panelBg}
                seed={42}
                className="p-5"
              >
                <h2
                  className="font-bold mb-4 text-sm"
                  style={{ fontFamily: fontCss, borderBottom: `1px solid ${borderColor}`, paddingBottom: "0.75rem" }}
                >
                  Komentarze
                </h2>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div
                        className="w-8 h-8 rounded-full shrink-0"
                        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }}
                      />
                      <div className="flex-1 space-y-1.5">
                        {[1, 0.7, 0.5].map((w, j) => (
                          <div
                            key={j}
                            className="h-2.5 rounded"
                            style={{
                              width: `${w * 100}%`,
                              background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </RoughFrame>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Playlist */}
              <RoughFrame
                roughness={s.roughness * 0.8}
                stroke={borderColor}
                fill={panelBg}
                seed={9}
                className="p-4"
              >
                <h2
                  className="text-sm font-bold mb-3 pb-2"
                  style={{ fontFamily: fontCss, borderBottom: `1px solid ${borderColor}` }}
                >
                  Wszystkie materiały
                </h2>
                <div className="space-y-2">
                  {MOCK_VIDEOS.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActiveVideo(v.id)}
                      className="w-full text-left flex gap-2.5 p-2 rounded transition-all"
                      style={{
                        background: activeVideo === v.id ? `rgba(${hexToRgb(s.accent)},0.1)` : "transparent",
                        borderLeft: activeVideo === v.id ? `2px solid ${s.accent}` : "2px solid transparent",
                        paddingLeft: "8px",
                      }}
                    >
                      <div
                        className="w-12 h-8 shrink-0 flex items-center justify-center text-[9px] rounded-sm"
                        style={{ background: "#0d0d0b", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
                      >
                        {v.duration}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-xs font-medium leading-snug line-clamp-2"
                          style={{ fontFamily: fontCss, color: activeVideo === v.id ? s.accent : s.ink }}
                        >
                          {v.title}
                        </p>
                        {v.locked && (
                          <span
                            className="text-[9px] font-bold tracking-widest"
                            style={{ color: s.accent, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
                          >
                            PATRON
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </RoughFrame>

              {/* Donate box */}
              <RoughFrame
                roughness={s.roughness}
                stroke={s.accent}
                fill={`rgba(${hexToRgb(s.accent)},0.05)`}
                seed={31}
                strokeWidth={1.5}
                className="p-4"
              >
                <h3
                  className="font-bold text-sm mb-2"
                  style={{ fontFamily: fontCss, color: s.ink }}
                >
                  Wesprzyj kanał
                </h3>
                <p
                  className="text-xs leading-relaxed mb-3"
                  style={{ color: textDim, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
                >
                  Jednorazowe wsparcie. Dostęp na zawsze.
                </p>
                <div className="flex gap-2">
                  {["20 zł", "50 zł", "100 zł"].map((amt) => (
                    <StyledButton
                      key={amt}
                      variant={s.buttonVariant}
                      accent={s.accent}
                      ink={s.ink}
                      bg={s.bg}
                      roughness={s.roughness}
                      fontCss={fontCss}
                      outlined
                    >
                      {amt}
                    </StyledButton>
                  ))}
                </div>
              </RoughFrame>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
