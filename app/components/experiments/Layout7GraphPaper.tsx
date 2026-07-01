"use client";

/**
 * Layout 7 — "Papier Milimetrowy"
 *
 * Techniki:
 * - CSS background-image: siatka milimetrowa (linie co 4px, grubsze co 40px)
 * - roughjs w TRYBIE technicznym: roughness=0.3, cienkie linie inżynierskie
 * - SVG "pomiarowe" strzałki i etykiety wymiarowe jak na rysunku technicznym
 * - framer-motion: elementy "pojawiają się" jak rysowane ołówkiem (strokeDashoffset animation)
 * - Czcionki: Space Grotesk (techniczny) + Patrick Hand (odręczne notki)
 * - Kolory: jasny niebieski papier + ciemnoszary ołówek + czerwone wymiary
 */

import React, { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const PAPER = "#f0f4f8";
const GRID_MINOR = "rgba(100,140,200,0.18)";
const GRID_MAJOR = "rgba(80,120,180,0.32)";
const PENCIL = "#2a3545";
const PENCIL_LIGHT = "#8a9ab5";
const RED = "#c0392b";
const BLUE_MARK = "#1a56a0";

const videos = [
  { id: "1", title: "Jak to działa #12 — dziwne prawa",    time: "18:42", views: "12 tys.", w: 220, h: 130 },
  { id: "2", title: "Patroni pytają — Q&A #5",             time: "11:08", views: "8 tys.",  w: 220, h: 130 },
  { id: "3", title: "Notatnik Polutka #7",                 time: "7:31",  views: "5 tys.",  w: 220, h: 130 },
  { id: "4", title: "Dlaczego mówię to co mówię",          time: "22:15", views: "21 tys.", w: 220, h: 130 },
];

function DrawIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function DimensionLine({ x1 = 0, y1 = 0, x2 = 100, y2 = 0, label = "", vertical = false }: {
  x1?: number; y1?: number; x2?: number; y2?: number; label?: string; vertical?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      <defs>
        <marker id="arrowR" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={RED} />
        </marker>
        <marker id="arrowL" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
          <path d="M6,0 L0,3 L6,6 Z" fill={RED} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={RED} strokeWidth="0.8"
        markerEnd="url(#arrowR)" markerStart="url(#arrowL)" strokeDasharray="none" />
      <text x={mx + (vertical ? 4 : 0)} y={my + (vertical ? 0 : -4)}
        fontFamily="var(--font-space-grotesk)" fontSize="9" fill={RED}
        textAnchor="middle" dominantBaseline="middle">
        {label}
      </text>
    </svg>
  );
}

function AnnotationBox({ children, x = 0, y = 0, angle = -1 }: { children: React.ReactNode; x?: number; y?: number; angle?: number }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      fontFamily: "var(--font-patrick)", fontSize: 11, color: BLUE_MARK,
      transform: `rotate(${angle}deg)`,
      pointerEvents: "none",
    }}>
      {children}
    </div>
  );
}

function TechnicalCard({ video, delay = 0 }: { video: typeof videos[0]; delay?: number }) {
  return (
    <DrawIn delay={delay}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        style={{ cursor: "pointer", position: "relative", padding: "0 0 16px 0" }}
      >
        {/* Video placeholder */}
        <div style={{
          aspectRatio: "16/9",
          border: `1px solid ${PENCIL}`,
          position: "relative",
          overflow: "hidden",
          background: "rgba(255,255,255,0.6)",
          marginBottom: 8,
        }}>
          {/* X marks */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <line x1="0" y1="0" x2="100%" y2="100%" stroke={PENCIL_LIGHT} strokeWidth="0.7" />
            <line x1="100%" y1="0" x2="0" y2="100%" stroke={PENCIL_LIGHT} strokeWidth="0.7" />
            <circle cx="50%" cy="50%" r="14" fill="none" stroke={PENCIL} strokeWidth="0.8" />
            <polygon points="46%,44% 46%,56% 58%,50%" fill={PENCIL} opacity="0.6" />
          </svg>
          <div style={{
            position: "absolute", bottom: 4, right: 6,
            fontFamily: "var(--font-space-grotesk)", fontSize: 10, color: PENCIL,
          }}>{video.time}</div>
        </div>
        {/* Title */}
        <div style={{ fontFamily: "var(--font-patrick)", fontSize: 13, color: PENCIL, lineHeight: 1.4, marginBottom: 4 }}>
          {video.title}
        </div>
        {/* Views */}
        <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 10, color: PENCIL_LIGHT }}>
          {video.views} wyświetleń
        </div>
        {/* Bottom dimension line */}
        <div style={{ height: 1, background: PENCIL_LIGHT, opacity: 0.4, marginTop: 12 }} />
      </motion.div>
    </DrawIn>
  );
}

export default function Layout7GraphPaper() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <main style={{
      minHeight: "100vh",
      background: PAPER,
      backgroundImage: `
        linear-gradient(${GRID_MINOR} 1px, transparent 1px),
        linear-gradient(90deg, ${GRID_MINOR} 1px, transparent 1px),
        linear-gradient(${GRID_MAJOR} 1px, transparent 1px),
        linear-gradient(90deg, ${GRID_MAJOR} 1px, transparent 1px)
      `,
      backgroundSize: "4px 4px, 4px 4px, 40px 40px, 40px 40px",
      fontFamily: "var(--font-space-grotesk)",
      color: PENCIL,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 80px" }}>

        {/* HEADER */}
        <DrawIn>
          <header style={{ paddingTop: 24, paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                {/* Title block */}
                <div style={{
                  border: `1px solid ${PENCIL}`,
                  padding: "8px 16px",
                  display: "inline-block",
                  position: "relative",
                  background: "rgba(255,255,255,0.5)",
                }}>
                  <div style={{ fontFamily: "var(--font-brand)", fontSize: 44, letterSpacing: "0.06em", lineHeight: 1 }}>
                    POLUTEK
                  </div>
                  <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 10, letterSpacing: "0.25em", color: PENCIL_LIGHT, marginTop: 2 }}>
                    KANAŁ WIDEO / REV. 2026
                  </div>
                  {/* Corner marks */}
                  <div style={{ position: "absolute", top: -3, left: -3, width: 8, height: 8, borderTop: `1.5px solid ${RED}`, borderLeft: `1.5px solid ${RED}` }} />
                  <div style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderTop: `1.5px solid ${RED}`, borderRight: `1.5px solid ${RED}` }} />
                  <div style={{ position: "absolute", bottom: -3, left: -3, width: 8, height: 8, borderBottom: `1.5px solid ${RED}`, borderLeft: `1.5px solid ${RED}` }} />
                  <div style={{ position: "absolute", bottom: -3, right: -3, width: 8, height: 8, borderBottom: `1.5px solid ${RED}`, borderRight: `1.5px solid ${RED}` }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
                {/* Nav as technical buttons */}
                <nav style={{ display: "flex", gap: 0 }}>
                  {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
                    <motion.button
                      key={item}
                      onClick={() => setActiveTab(i)}
                      whileHover={{ background: "rgba(26,86,160,0.08)" }}
                      style={{
                        fontFamily: "var(--font-space-grotesk)", fontSize: 11, letterSpacing: "0.15em",
                        padding: "8px 14px",
                        background: activeTab === i ? "rgba(26,86,160,0.12)" : "rgba(255,255,255,0.5)",
                        border: `1px solid ${PENCIL}`,
                        borderRight: i < 3 ? "none" : `1px solid ${PENCIL}`,
                        color: activeTab === i ? BLUE_MARK : PENCIL,
                        cursor: "pointer",
                        fontWeight: activeTab === i ? 700 : 400,
                      }}
                    >{item}</motion.button>
                  ))}
                </nav>
                <motion.button
                  whileHover={{ background: PENCIL, color: PAPER }}
                  style={{
                    fontFamily: "var(--font-space-grotesk)", fontSize: 11, letterSpacing: "0.2em",
                    padding: "8px 20px",
                    background: "rgba(255,255,255,0.5)",
                    border: `1.5px solid ${PENCIL}`,
                    color: PENCIL, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >→ WSPIERAM TWÓRCĘ</motion.button>
              </div>
            </div>

            {/* Ruler line */}
            <div style={{ height: 20, borderBottom: `1px solid ${PENCIL}`, position: "relative", marginTop: 12 }}>
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} style={{
                  position: "absolute",
                  left: `${(i / 29) * 100}%`,
                  bottom: 0,
                  width: 1,
                  height: i % 5 === 0 ? 8 : 4,
                  background: PENCIL_LIGHT,
                }} />
              ))}
            </div>
          </header>
        </DrawIn>

        {/* SECTION LABEL */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 14px" }}>
          <span style={{
            fontFamily: "var(--font-space-grotesk)", fontSize: 9, letterSpacing: "0.3em",
            color: PENCIL_LIGHT, whiteSpace: "nowrap",
          }}>WIDOK GŁÓWNY — SKALA 1:1</span>
          <div style={{ flex: 1, height: 1, background: PENCIL_LIGHT, opacity: 0.4 }} />
          <span style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: RED, transform: "rotate(-1deg)" }}>
            główny materiał
          </span>
        </div>

        {/* MAIN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 40 }}>

          {/* LEFT: HERO */}
          <DrawIn delay={0.05}>
            <div style={{ position: "relative" }}>
              {/* Video frame */}
              <div style={{
                border: `1px solid ${PENCIL}`,
                position: "relative",
                background: "rgba(255,255,255,0.5)",
              }}>
                {/* Dimension marks */}
                <AnnotationBox x={-40} y={0} angle={-0.5}>
                  <div style={{ writing: "vertical-rl" } as React.CSSProperties}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: 0.6 }}>
                      <div style={{ width: 1, flex: 1, background: RED, minHeight: 40 }} />
                      <span style={{ fontSize: 9, color: RED, writingMode: "vertical-rl" }}>360px</span>
                      <div style={{ width: 1, flex: 1, background: RED, minHeight: 40 }} />
                    </div>
                  </div>
                </AnnotationBox>

                {/* Video placeholder */}
                <div style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden" }}>
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                    <rect width="100%" height="100%" fill="rgba(240,244,248,0.8)" />
                    <line x1="0" y1="0" x2="100%" y2="100%" stroke={PENCIL_LIGHT} strokeWidth="0.8" />
                    <line x1="100%" y1="0" x2="0" y2="100%" stroke={PENCIL_LIGHT} strokeWidth="0.8" />
                    {/* Play circle */}
                    <circle cx="50%" cy="50%" r="36" fill="rgba(255,255,255,0.8)" stroke={PENCIL} strokeWidth="1" />
                    <polygon points="46%,42% 46%,58% 62%,50%" fill={PENCIL} />
                    {/* Corner crosses */}
                    <line x1="20" y1="10" x2="20" y2="26" stroke={RED} strokeWidth="0.8" />
                    <line x1="12" y1="18" x2="28" y2="18" stroke={RED} strokeWidth="0.8" />
                  </svg>
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(240,244,248,0.9))",
                    padding: "20px 14px 10px",
                  }}>
                    <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 10, color: PENCIL_LIGHT, letterSpacing: "0.15em" }}>
                      CZAS TRWANIA: 18:42 MIN
                    </div>
                  </div>
                </div>

                {/* Info section below video */}
                <div style={{ padding: "16px" }}>
                  {/* Title */}
                  <h1 style={{
                    fontFamily: "var(--font-outfit)", fontSize: 24, fontWeight: 700,
                    color: PENCIL, lineHeight: 1.25, margin: "0 0 10px",
                    letterSpacing: "-0.02em",
                  }}>
                    Jak to działa #12 — dziwne prawa polskiego systemu
                  </h1>

                  {/* Meta grid */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    border: `1px solid ${PENCIL_LIGHT}44`,
                    marginBottom: 14,
                  }}>
                    {[
                      { label: "WYŚWIETLEŃ", value: "12 tys." },
                      { label: "DATA", value: "27 cze 2026" },
                      { label: "POZIOM", value: "PUBLICZNE" },
                    ].map((item, i) => (
                      <div key={item.label} style={{
                        padding: "8px 10px",
                        borderRight: i < 2 ? `1px solid ${PENCIL_LIGHT}44` : "none",
                      }}>
                        <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 8, letterSpacing: "0.2em", color: PENCIL_LIGHT, marginBottom: 3 }}>
                          {item.label}
                        </div>
                        <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 13, fontWeight: 700, color: PENCIL }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontFamily: "var(--font-outfit)", fontSize: 14, lineHeight: 1.7, color: PENCIL_LIGHT, margin: "0 0 14px" }}>
                    Przez kilka tygodni zbierałem przykłady absurdalnych przepisów. Rozmowy z prawnikami, sędziami i obywatelami.
                  </p>

                  {/* Action row */}
                  <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${PENCIL_LIGHT}44`, paddingTop: 14 }}>
                    {["👍  1847", "👎  23", "↗  Udostępnij", "⋯"].map((item, i) => (
                      <motion.button
                        key={item}
                        whileHover={{ background: "rgba(26,86,160,0.08)" }}
                        style={{
                          fontFamily: "var(--font-space-grotesk)", fontSize: 11,
                          padding: "8px 14px",
                          background: "transparent",
                          border: `1px solid ${PENCIL_LIGHT}55`,
                          borderRight: i < 3 ? "none" : `1px solid ${PENCIL_LIGHT}55`,
                          color: PENCIL, cursor: "pointer",
                        }}
                      >{item}</motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Handwritten annotation */}
              <div style={{
                position: "absolute", top: -20, right: -10,
                fontFamily: "var(--font-patrick)", fontSize: 12, color: RED,
                transform: "rotate(3deg)",
              }}>
                ← główny odcinek tygodnia!
              </div>
            </div>
          </DrawIn>

          {/* RIGHT: SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            {/* Patron frame */}
            <DrawIn delay={0.1}>
              <div style={{
                border: `1px solid ${PENCIL}`,
                padding: "14px",
                marginBottom: 28,
                position: "relative",
                background: "rgba(255,255,255,0.5)",
              }}>
                {/* Corner marks */}
                {[[-3,-3,"top","left"],[-3,"right-3","top","right"],["bottom-3",-3,"bottom","left"],["bottom-3","right-3","bottom","right"]].map((_, i) => (
                  <div key={i} style={{
                    position: "absolute",
                    ...(i === 0 ? { top: -3, left: -3 } : i === 1 ? { top: -3, right: -3 } : i === 2 ? { bottom: -3, left: -3 } : { bottom: -3, right: -3 }),
                    width: 8, height: 8,
                    borderTop: i < 2 ? `1.5px solid ${BLUE_MARK}` : undefined,
                    borderBottom: i >= 2 ? `1.5px solid ${BLUE_MARK}` : undefined,
                    borderLeft: i % 2 === 0 ? `1.5px solid ${BLUE_MARK}` : undefined,
                    borderRight: i % 2 === 1 ? `1.5px solid ${BLUE_MARK}` : undefined,
                  }} />
                ))}
                <div style={{
                  fontFamily: "var(--font-space-grotesk)", fontSize: 10, letterSpacing: "0.25em",
                  color: BLUE_MARK, marginBottom: 10,
                }}>PATRONAT / DOSTĘP VIP</div>
                <p style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: PENCIL_LIGHT, margin: "0 0 12px", lineHeight: 1.6 }}>
                  Jednorazowe wsparcie → dożywotni dostęp do bonusów.
                </p>
                <motion.button
                  whileHover={{ background: PENCIL, color: PAPER }}
                  style={{
                    width: "100%", padding: "10px",
                    fontFamily: "var(--font-space-grotesk)", fontSize: 11, letterSpacing: "0.2em",
                    border: `1.5px solid ${PENCIL}`,
                    background: "transparent", color: PENCIL, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >WEJDŹ TERAZ →</motion.button>
              </div>
            </DrawIn>

            {/* Section divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 8, letterSpacing: "0.3em", color: PENCIL_LIGHT, whiteSpace: "nowrap" }}>
                INNE MATERIAŁY
              </span>
              <div style={{ flex: 1, height: 1, background: PENCIL_LIGHT, opacity: 0.4 }} />
            </div>

            {/* Video list */}
            {videos.map((v, i) => (
              <TechnicalCard key={v.id} video={v} delay={0.08 + i * 0.07} />
            ))}
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ textAlign: "center", padding: "20px 0 32px", borderTop: `1px solid ${PENCIL_LIGHT}44` }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 11, letterSpacing: "0.2em", color: PENCIL_LIGHT, textDecoration: "none" }}>
          ← WSZYSTKIE LAYOUTY
        </Link>
      </div>
    </main>
  );
}
