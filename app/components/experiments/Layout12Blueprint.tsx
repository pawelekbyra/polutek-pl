"use client";

/**
 * Layout 12 — "Kalka Techniczna / Blueprint"
 *
 * Techniki:
 * - Tło: ciemny niebieski jak blueprint (#003a6b), białe linie siatki
 * - Wszystkie elementy UI jako białe/jasne linie techniczne
 * - SVG ze strzałkami wymiarowymi, liniami pomocniczymi, oznaczeniami kątów
 * - CSS text jako negatyw (białe litery na niebieskim)
 * - framer-motion: elementy "rysowane" (strokeDashoffset animation w SVG)
 * - Odręczne notatki inżynierskie obok elementów (Caveat w kolorze żółtym)
 * - Fonts: Space Grotesk (techniczny mono) + Caveat (notatki) + Bebas Neue (nagłówki)
 * - Paleta: blueprint blue + white lines + yellow annotations
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const BLUE_BG = "#001f3f";
const BLUE_MID = "#003a6b";
const LINE = "rgba(180,220,255,0.65)";
const LINE_THIN = "rgba(180,220,255,0.25)";
const WHITE = "#e8f4ff";
const YELLOW = "#f5dd4b";
const RED_MARK = "#ff6b6b";

const videos = [
  { id: "1", title: "Jak to działa #12",    sub: "Dziwne prawa systemu",     time: "18:42", views: "12 tys." },
  { id: "2", title: "Patroni pytają Q&A",   sub: "Seria numer 5",            time: "11:08", views: "8 tys."  },
  { id: "3", title: "Notatnik #7",          sub: "Szkic tygodnia",           time: "7:31",  views: "5 tys."  },
  { id: "4", title: "Manifest twórcy",      sub: "Dlaczego mówię co mówię", time: "22:15", views: "21 tys." },
];

function BlueprintLine({ className = "", vertical = false, style = {} }: { className?: string; vertical?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: LINE_THIN,
        [vertical ? "width" : "height"]: "1px",
        [vertical ? "height" : "width"]: "100%",
        ...style,
      }}
    />
  );
}

function DimensionArrow({ label, width = 100 }: { label: string; width?: number }) {
  return (
    <svg width={width} height={20} viewBox={`0 0 ${width} 20`} style={{ display: "block" }}>
      <defs>
        <marker id="bpa-l" markerWidth="5" markerHeight="5" refX="0" refY="2.5" orient="auto">
          <path d="M5,0 L0,2.5 L5,5 Z" fill={LINE} />
        </marker>
        <marker id="bpa-r" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill={LINE} />
        </marker>
      </defs>
      <line x1="4" y1="10" x2={width - 4} y2="10" stroke={LINE} strokeWidth="0.8"
        markerStart="url(#bpa-l)" markerEnd="url(#bpa-r)" />
      <text x={width / 2} y={7} textAnchor="middle"
        fontFamily="var(--font-space-grotesk)" fontSize="8" fill={LINE} letterSpacing="0.1em">
        {label}
      </text>
    </svg>
  );
}

function CrossMark({ x = 10, y = 10, size = 8 }: { x?: number; y?: number; size?: number }) {
  return (
    <g>
      <line x1={x - size} y1={y} x2={x + size} y2={y} stroke={LINE} strokeWidth="0.6" />
      <line x1={x} y1={y - size} x2={x} y2={y + size} stroke={LINE} strokeWidth="0.6" />
      <circle cx={x} cy={y} r={size * 0.6} fill="none" stroke={LINE} strokeWidth="0.5" />
    </g>
  );
}

function DrawReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function VideoBlock({ video, isActive, onClick, delay = 0 }: {
  video: typeof videos[0]; isActive: boolean; onClick: () => void; delay?: number;
}) {
  return (
    <DrawReveal delay={delay}>
      <motion.div
        onClick={onClick}
        whileHover={{ backgroundColor: "rgba(180,220,255,0.06)" }}
        style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "12px 10px",
          border: `1px solid ${isActive ? LINE : LINE_THIN}`,
          cursor: "pointer",
          transition: "all 0.2s",
          background: isActive ? "rgba(180,220,255,0.08)" : "transparent",
          marginBottom: 1,
        }}
      >
        {/* Thumbnail */}
        <div style={{
          width: 80, aspectRatio: "16/9", flexShrink: 0,
          border: `1px solid ${LINE_THIN}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          background: "rgba(0,60,120,0.3)",
        }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <line x1="0" y1="0" x2="100%" y2="100%" stroke={LINE_THIN} strokeWidth="0.5"/>
            <line x1="100%" y1="0" x2="0" y2="100%" stroke={LINE_THIN} strokeWidth="0.5"/>
          </svg>
          <span style={{ fontSize: 11, color: LINE, opacity: 0.6 }}>▶</span>
          <div style={{
            position: "absolute", bottom: 2, right: 3,
            fontFamily: "var(--font-space-grotesk)", fontSize: 8, color: LINE_THIN,
          }}>{video.time}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "var(--font-space-grotesk)", fontSize: 12, fontWeight: 600,
            color: WHITE, lineHeight: 1.4, marginBottom: 2,
          }}>{video.title}</div>
          <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 10, color: LINE_THIN, marginBottom: 3 }}>
            {video.sub}
          </div>
          <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 9, color: LINE, letterSpacing: "0.1em" }}>
            {video.views} WYŚ.
          </div>
        </div>
        {isActive && (
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: YELLOW, flexShrink: 0, marginTop: 4,
            boxShadow: `0 0 6px ${YELLOW}`,
          }} />
        )}
      </motion.div>
    </DrawReveal>
  );
}

export default function Layout12Blueprint() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: BLUE_BG,
      backgroundImage: `
        linear-gradient(${LINE_THIN} 1px, transparent 1px),
        linear-gradient(90deg, ${LINE_THIN} 1px, transparent 1px),
        linear-gradient(rgba(180,220,255,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(180,220,255,0.06) 1px, transparent 1px)
      `,
      backgroundSize: "5px 5px, 5px 5px, 50px 50px, 50px 50px",
      fontFamily: "var(--font-space-grotesk)",
      color: WHITE,
      position: "relative",
    }}>

      {/* DRAWING TITLE BLOCK — top right corner like real blueprint */}
      <div style={{
        position: "fixed", top: 0, right: 0,
        border: `1px solid ${LINE}`,
        borderTop: "none", borderRight: "none",
        padding: 0, zIndex: 100,
        background: BLUE_BG,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {[
            { label: "PROJEKT", value: "POLUTEK.PL" },
            { label: "DATA", value: "01.07.2026" },
            { label: "SKALA", value: "1:1" },
            { label: "REWIZJA", value: "v2.0" },
          ].map((item, i) => (
            <div key={item.label} style={{
              padding: "5px 10px",
              borderBottom: `1px solid ${LINE_THIN}`,
              borderRight: i % 2 === 0 ? `1px solid ${LINE_THIN}` : "none",
            }}>
              <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 7, letterSpacing: "0.25em", color: LINE_THIN }}>
                {item.label}
              </div>
              <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 10, fontWeight: 700, color: LINE }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* HEADER */}
        <DrawReveal>
          <header style={{ padding: "24px 0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                fontFamily: "var(--font-brand)", fontSize: 52, letterSpacing: "0.06em",
                lineHeight: 1, color: WHITE,
                textShadow: `0 0 20px rgba(180,220,255,0.3)`,
              }}>POLUTEK</div>
              <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 9, letterSpacing: "0.3em", color: LINE_THIN, marginTop: 2 }}>
                KANAŁ WIDEO / REV. 2026 / TAJEMNICZE
              </div>
              <DimensionArrow label="640px" width={180} />
            </div>
            <nav style={{ display: "flex", gap: 0 }}>
              {["START", "ODCINKI", "PATRONI", "KOMENTARZE"].map((item, i) => (
                <motion.button
                  key={item}
                  whileHover={{ backgroundColor: "rgba(180,220,255,0.1)" }}
                  style={{
                    fontFamily: "var(--font-space-grotesk)", fontSize: 9, letterSpacing: "0.25em",
                    padding: "8px 14px",
                    background: i === 0 ? "rgba(180,220,255,0.12)" : "transparent",
                    border: `1px solid ${i === 0 ? LINE : LINE_THIN}`,
                    borderRight: i < 3 ? "none" : `1px solid ${LINE_THIN}`,
                    color: i === 0 ? WHITE : LINE_THIN,
                    cursor: "pointer",
                    fontWeight: i === 0 ? 700 : 400,
                  }}
                >{item}</motion.button>
              ))}
            </nav>
            <motion.button
              whileHover={{ backgroundColor: YELLOW, color: BLUE_BG }}
              style={{
                fontFamily: "var(--font-space-grotesk)", fontSize: 9, letterSpacing: "0.2em",
                padding: "10px 18px",
                background: "transparent",
                border: `1px solid ${YELLOW}`,
                color: YELLOW, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >→ WSPIERAM TWÓRCĘ</motion.button>
          </header>
        </DrawReveal>

        <BlueprintLine />

        {/* MAIN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 40, marginTop: 24 }}>

          {/* LEFT: FEATURE SECTION */}
          <div>
            {/* Section label */}
            <DrawReveal delay={0.05}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <CrossMark x={6} y={6} size={5} />
                </svg>
                <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 9, letterSpacing: "0.3em", color: LINE_THIN }}>
                  WIDOK A-A / GŁÓWNY MATERIAŁ
                </span>
                <div style={{ flex: 1, height: 1, background: LINE_THIN }} />
              </div>
            </DrawReveal>

            {/* Video frame */}
            <DrawReveal delay={0.1}>
              <div style={{ position: "relative", marginBottom: 20 }}>
                {/* Outer frame */}
                <div style={{
                  position: "absolute", inset: -8,
                  border: `1px solid ${LINE_THIN}`,
                  pointerEvents: "none",
                }}>
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                    <CrossMark x={12} y={12} size={6} />
                    <CrossMark x={"calc(100% - 12)" as unknown as number} y={12} size={6} />
                  </svg>
                </div>
                <div style={{
                  aspectRatio: "16/9",
                  border: `1px solid ${LINE}`,
                  position: "relative",
                  overflow: "hidden",
                  background: "rgba(0,40,90,0.5)",
                }}>
                  {/* Grid overlay */}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <line key={`h${i}`} x1="0" y1={`${(i / 12) * 100}%`} x2="100%" y2={`${(i / 12) * 100}%`} stroke={LINE} strokeWidth="0.5" />
                    ))}
                    {Array.from({ length: 20 }).map((_, i) => (
                      <line key={`v${i}`} x1={`${(i / 20) * 100}%`} y1="0" x2={`${(i / 20) * 100}%`} y2="100%" stroke={LINE} strokeWidth="0.5" />
                    ))}
                  </svg>
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 70, height: 70,
                      border: `1.5px solid ${LINE}`,
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: LINE, fontSize: 26,
                    }}>▶</div>
                  </motion.div>
                  {/* Time label */}
                  <div style={{
                    position: "absolute", bottom: 10, right: 14,
                    background: "rgba(0,20,50,0.8)",
                    border: `1px solid ${LINE_THIN}`,
                    padding: "2px 8px",
                    fontFamily: "var(--font-space-grotesk)", fontSize: 11, color: LINE,
                    letterSpacing: "0.1em",
                  }}>{active.time}</div>
                  {/* Annotation */}
                  <div style={{
                    position: "absolute", top: 10, left: 14,
                    fontFamily: "var(--font-caveat)", fontSize: 13, color: YELLOW,
                    transform: "rotate(-1deg)",
                  }}>← główny film tygodnia!</div>
                </div>
                {/* Dimension lines */}
                <div style={{ marginTop: 4 }}>
                  <DimensionArrow label="1280 × 720" width={200} />
                </div>
              </div>
            </DrawReveal>

            {/* Info block */}
            <DrawReveal delay={0.15}>
              <div style={{
                border: `1px solid ${LINE_THIN}`,
                padding: "16px",
                marginBottom: 20,
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: -9, left: 16,
                  background: BLUE_BG, padding: "0 8px",
                  fontFamily: "var(--font-space-grotesk)", fontSize: 8, letterSpacing: "0.2em", color: LINE_THIN,
                }}>INFORMACJE</div>
                <h1 style={{
                  fontFamily: "var(--font-brand)", fontSize: 28, letterSpacing: "0.03em",
                  lineHeight: 1.1, color: WHITE, margin: "0 0 8px",
                }}>{active.title} — {active.sub}</h1>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: `1px solid ${LINE_THIN}`, marginBottom: 14 }}>
                  {[
                    { k: "WYŚWIETLEŃ", v: active.views },
                    { k: "CZAS", v: active.time + " min" },
                    { k: "STATUS", v: "PUBLICZNE" },
                  ].map((item, i) => (
                    <div key={item.k} style={{
                      padding: "8px 10px",
                      borderRight: i < 2 ? `1px solid ${LINE_THIN}` : "none",
                    }}>
                      <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 7, letterSpacing: "0.2em", color: LINE_THIN, marginBottom: 3 }}>
                        {item.k}
                      </div>
                      <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 12, fontWeight: 700, color: LINE }}>
                        {item.v}
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontFamily: "var(--font-outfit)", fontSize: 13, lineHeight: 1.7, color: LINE_THIN, margin: 0 }}>
                  Przez kilka tygodni zbierałem przykłady absurdalnych przepisów. Rozmowy z prawnikami i obywatelami.
                </p>
              </div>
            </DrawReveal>

            {/* Actions */}
            <DrawReveal delay={0.2}>
              <div style={{ display: "flex", gap: 0 }}>
                {["👍  1847", "👎  23", "↗  Udostępnij", "⋯"].map((btn, i) => (
                  <motion.button
                    key={btn}
                    whileHover={{ backgroundColor: "rgba(180,220,255,0.1)" }}
                    style={{
                      fontFamily: "var(--font-space-grotesk)", fontSize: 10, letterSpacing: "0.12em",
                      padding: "8px 14px",
                      background: "transparent",
                      border: `1px solid ${LINE_THIN}`,
                      borderRight: i < 3 ? "none" : `1px solid ${LINE_THIN}`,
                      color: LINE, cursor: "pointer",
                    }}
                  >{btn}</motion.button>
                ))}
              </div>
            </DrawReveal>
          </div>

          {/* RIGHT: SIDEBAR */}
          <DrawReveal delay={0.08}>
            <div>
              {/* Patron block */}
              <div style={{
                border: `1px solid ${YELLOW}55`,
                padding: "14px",
                marginBottom: 28,
                position: "relative",
                background: "rgba(245,221,75,0.04)",
              }}>
                <div style={{
                  position: "absolute", top: -9, left: 12,
                  background: BLUE_BG, padding: "0 8px",
                  fontFamily: "var(--font-space-grotesk)", fontSize: 8, letterSpacing: "0.2em", color: YELLOW,
                }}>PATRONAT / DOSTĘP</div>
                <p style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: LINE_THIN, margin: "0 0 12px", lineHeight: 1.6 }}>
                  Jednorazowe wsparcie → dożywotni dostęp do materiałów bonusowych.
                </p>
                <motion.button
                  whileHover={{ background: YELLOW, color: BLUE_BG }}
                  style={{
                    width: "100%", padding: "10px",
                    fontFamily: "var(--font-space-grotesk)", fontSize: 9, letterSpacing: "0.25em",
                    border: `1px solid ${YELLOW}`,
                    background: "transparent", color: YELLOW, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >→ WEJDŹ TERAZ</motion.button>
              </div>

              {/* Section */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 7, letterSpacing: "0.3em", color: LINE_THIN, whiteSpace: "nowrap" }}>
                  LISTA MATERIAŁÓW
                </span>
                <div style={{ flex: 1, height: 1, background: LINE_THIN }} />
              </div>

              {videos.map((v, i) => (
                <VideoBlock
                  key={v.id}
                  video={v}
                  isActive={v.id === activeId}
                  onClick={() => setActiveId(v.id)}
                  delay={0.1 + i * 0.06}
                />
              ))}

              {/* Handwritten note */}
              <div style={{
                marginTop: 20, padding: "12px",
                border: `1px dashed ${LINE_THIN}`,
                transform: "rotate(-0.8deg)",
              }}>
                <div style={{ fontFamily: "var(--font-caveat)", fontSize: 14, color: YELLOW, lineHeight: 1.6 }}>
                  * więcej odcinków wkrótce!<br/>
                  patrz: zakładka Odcinki →
                </div>
              </div>
            </div>
          </DrawReveal>
        </div>
      </div>

      {/* NAV */}
      <div style={{ textAlign: "center", padding: "20px 0 32px", borderTop: `1px solid ${LINE_THIN}` }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 9, letterSpacing: "0.25em", color: LINE_THIN, textDecoration: "none" }}>
          ← WSZYSTKIE LAYOUTY
        </Link>
      </div>
    </main>
  );
}
