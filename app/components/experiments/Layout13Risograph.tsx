"use client";

/**
 * Layout 13 — "Riso Druk"
 *
 * Techniki:
 * - SVG feTurbulence grain texture jako overlay na całą stronę
 * - mix-blend-mode: multiply dla efektu nakładania dwóch kolorów risographu
 * - Tylko DWA KOLORY druku + paper (jak prawdziwy risograph): czarny + jeden kolor
 * - Lekkie "misregistration" (przesunięcie warstwy kolorowej względem czarnej)
 * - CSS halftone pattern dla wypełnień (SVG pattern z kółkami)
 * - Odręczne czcionki jako "ręcznie złożone" typografii
 * - Fonts: Bebas Neue (display) + Patrick Hand (body)
 * - Paleta zmienia się wg numeru wariantu: tutaj risograph coral/salmon
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const PAPER = "#f5f0e5";
const INK_BLACK = "#1a1510";
const RISO_COLOR = "#e8643c"; // risograph coral/salmon
const RISO_LIGHT = "#f5b098";
const RISO_DARK = "#c04020";

const videos = [
  { id: "1", title: "Jak to działa #12", sub: "Dziwne prawa",     time: "18:42", col: true  },
  { id: "2", title: "Q&A Patroni #5",    sub: "Wasze pytania",     time: "11:08", col: false },
  { id: "3", title: "Notatnik Polutka",  sub: "Szkic tygodnia #7", time: "7:31",  col: true  },
  { id: "4", title: "Manifest twórcy",   sub: "Dlaczego mówię",    time: "22:15", col: false },
  { id: "5", title: "Za kulisami",       sub: "Jak nagrywam",      time: "9:44",  col: true  },
  { id: "6", title: "Absurdy #1",        sub: "Infografika",       time: "5:12",  col: false },
];

function HalftonePattern({ id, color, density = 0.4 }: { id: string; color: string; density?: number }) {
  const r = 2.5 * density;
  return (
    <pattern id={id} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r={r} fill={color} />
    </pattern>
  );
}

function GrainFilter({ id = "grain" }: { id?: string }) {
  return (
    <filter id={id} x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" seed="15" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended"/>
      <feComponentTransfer in="blended">
        <feFuncR type="linear" slope="0.95" intercept="0.03"/>
        <feFuncG type="linear" slope="0.95" intercept="0.03"/>
        <feFuncB type="linear" slope="0.95" intercept="0.03"/>
      </feComponentTransfer>
    </filter>
  );
}

function RisoCard({ video, isActive, onClick, delay = 0 }: {
  video: typeof videos[0]; isActive: boolean; onClick: () => void; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      whileHover={{ y: -3 }}
      style={{
        cursor: "pointer", position: "relative",
        padding: "14px",
        border: `2px solid ${isActive ? RISO_COLOR : INK_BLACK}`,
        background: isActive ? RISO_COLOR : PAPER,
        transition: "all 0.2s",
      }}
    >
      {video.col && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: isActive ? 0 : 0.06 }}>
          <defs><HalftonePattern id={`ht-${video.id}`} color={RISO_COLOR} density={0.6} /></defs>
          <rect width="100%" height="100%" fill={`url(#ht-${video.id})`} />
        </svg>
      )}
      {/* Misregistration shadow */}
      <div style={{
        position: "absolute", inset: 0,
        border: `2px solid ${RISO_COLOR}`,
        transform: "translate(2px, 2px)",
        opacity: 0.3,
        pointerEvents: "none",
        zIndex: 0,
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Video placeholder */}
        <div style={{
          aspectRatio: "16/9", marginBottom: 8,
          background: isActive ? INK_BLACK : "transparent",
          border: `2px solid ${isActive ? "transparent" : INK_BLACK}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {!isActive && (
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <line x1="0" y1="0" x2="100%" y2="100%" stroke={INK_BLACK} strokeWidth="1.5"/>
              <line x1="100%" y1="0" x2="0" y2="100%" stroke={INK_BLACK} strokeWidth="1.5"/>
            </svg>
          )}
          <span style={{ fontSize: 18, color: isActive ? RISO_LIGHT : INK_BLACK, position: "relative" }}>▶</span>
        </div>
        <div style={{
          fontFamily: "var(--font-brand)", fontSize: 16, letterSpacing: "0.05em",
          color: isActive ? PAPER : INK_BLACK, lineHeight: 1.1, marginBottom: 2,
        }}>{video.title}</div>
        <div style={{
          fontFamily: "var(--font-patrick)", fontSize: 10,
          color: isActive ? RISO_LIGHT : INK_BLACK,
          opacity: isActive ? 0.85 : 0.6,
        }}>{video.sub} · {video.time}</div>
      </div>
    </motion.div>
  );
}

export default function Layout13Risograph() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: PAPER,
      fontFamily: "var(--font-patrick)",
      color: INK_BLACK,
      position: "relative",
    }}>

      {/* SVG FILTERS + PATTERNS */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <GrainFilter id="riso-grain" />
          <HalftonePattern id="halftone-bg" color={RISO_COLOR} density={0.25} />
          <HalftonePattern id="halftone-dark" color={RISO_DARK} density={0.45} />
        </defs>
      </svg>

      {/* GRAIN OVERLAY */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        opacity: 0.04,
        mixBlendMode: "multiply",
      }} />

      {/* HEADER — big typography, riso style */}
      <header style={{
        borderBottom: `3px solid ${INK_BLACK}`,
        padding: "0",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Riso color block behind logo */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: "320px",
          background: RISO_COLOR,
          transform: "translateX(-2px)", // misregistration
        }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }}>
            <defs><HalftonePattern id="ht-header" color={INK_BLACK} density={0.7} /></defs>
            <rect width="100%" height="100%" fill="url(#ht-header)" />
          </svg>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              fontFamily: "var(--font-brand)", fontSize: 56, lineHeight: 0.9, letterSpacing: "0.04em",
              color: PAPER,
              textShadow: `2px 2px 0 ${RISO_DARK}`, // fake misregistration
            }}>POLUTEK</div>
            <div style={{
              fontFamily: "var(--font-patrick)", fontSize: 11, color: PAPER, opacity: 0.9,
              letterSpacing: "0.2em", marginTop: 4,
            }}>NIEZALEŻNY KANAŁ WIDEO</div>
          </div>
          <nav style={{ display: "flex", gap: 6 }}>
            {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
              <motion.div
                key={item}
                whileHover={{ background: INK_BLACK, color: PAPER }}
                style={{
                  fontFamily: "var(--font-patrick)", fontSize: 12, fontWeight: i === 0 ? 700 : 400,
                  color: INK_BLACK, cursor: "pointer", padding: "6px 12px",
                  border: `2px solid ${INK_BLACK}`,
                  background: i === 0 ? INK_BLACK : PAPER,
                  ...(i === 0 ? { color: PAPER } : {}),
                  transition: "all 0.15s",
                  userSelect: "none",
                } as React.CSSProperties}
              >{item}</motion.div>
            ))}
          </nav>
          <motion.div
            whileHover={{ scale: 1.04 }}
            style={{
              fontFamily: "var(--font-brand)", fontSize: 18, letterSpacing: "0.1em",
              color: PAPER, cursor: "pointer",
              padding: "8px 20px",
              background: INK_BLACK,
              border: `2px solid ${INK_BLACK}`,
              position: "relative",
            }}
          >
            {/* Misregistration effect on button */}
            <div style={{
              position: "absolute", inset: 0,
              border: `2px solid ${RISO_COLOR}`,
              transform: "translate(3px, 3px)",
              zIndex: -1,
            }} />
            WSPIERAM
          </motion.div>
        </div>
      </header>

      {/* MAIN */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr", gap: 36 }}>

          {/* LEFT: HERO */}
          <div>
            {/* Section label */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: RISO_COLOR, padding: "4px 12px",
              fontFamily: "var(--font-brand)", fontSize: 11, letterSpacing: "0.25em",
              color: PAPER, marginBottom: 16,
              position: "relative",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                border: `2px solid ${RISO_DARK}`,
                transform: "translate(2px, 2px)",
                zIndex: -1,
              }} />
              TERAZ OGLĄDASZ
            </div>

            {/* Video */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "relative", marginBottom: 20 }}
              >
                <div style={{
                  aspectRatio: "16/9",
                  border: `3px solid ${INK_BLACK}`,
                  background: INK_BLACK,
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Halftone fill */}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }}>
                    <defs><HalftonePattern id="ht-video" color={RISO_COLOR} density={0.6} /></defs>
                    <rect width="100%" height="100%" fill="url(#ht-video)" />
                  </svg>
                  {/* Misreg shadow */}
                  <div style={{
                    position: "absolute", inset: 0,
                    border: `2px solid ${RISO_COLOR}`,
                    transform: "translate(3px, 3px)",
                    opacity: 0.5,
                    pointerEvents: "none",
                  }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      style={{
                        width: 72, height: 72,
                        border: `3px solid ${RISO_COLOR}`,
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: RISO_COLOR, fontSize: 28, cursor: "pointer",
                      }}
                    >▶</motion.div>
                  </div>
                  <div style={{
                    position: "absolute", bottom: 10, right: 12,
                    fontFamily: "var(--font-brand)", fontSize: 13, color: RISO_COLOR,
                    letterSpacing: "0.1em",
                  }}>{active.time}</div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Title */}
            <AnimatePresence mode="wait">
              <motion.div key={activeId + "-t"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h1 style={{
                  fontFamily: "var(--font-brand)", fontSize: 36, letterSpacing: "0.03em",
                  lineHeight: 1.05, color: INK_BLACK, margin: "0 0 6px",
                  position: "relative",
                }}>
                  {/* Riso color underlay misreg */}
                  <span style={{
                    position: "absolute", top: 2, left: 2,
                    color: RISO_COLOR, opacity: 0.35, userSelect: "none",
                    fontFamily: "var(--font-brand)", fontSize: 36,
                  }}>{active.title}</span>
                  {active.title}
                </h1>
                <div style={{ fontFamily: "var(--font-patrick)", fontSize: 12, color: RISO_COLOR, marginBottom: 14 }}>
                  {active.sub}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Riso divider */}
            <div style={{
              height: 4, background: INK_BLACK,
              position: "relative", marginBottom: 16,
            }}>
              <div style={{ position: "absolute", top: 4, left: 0, right: 0, height: 4, background: RISO_COLOR, opacity: 0.5 }} />
            </div>

            {/* Description */}
            <p style={{
              fontFamily: "var(--font-patrick)", fontSize: 14, lineHeight: 1.75,
              color: INK_BLACK, margin: "0 0 18px", opacity: 0.85,
            }}>
              Przez kilka tygodni zbierałem przykłady absurdalnych przepisów. Rozmowy z prawnikami i obywatelami — materiał, który warto zobaczyć.
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { label: "👍 1847", bg: RISO_COLOR, col: PAPER },
                { label: "👎 23",   bg: PAPER,      col: INK_BLACK },
                { label: "↗ Udostępnij", bg: PAPER, col: INK_BLACK },
                { label: "⋯",       bg: PAPER,      col: INK_BLACK },
              ].map(btn => (
                <motion.button
                  key={btn.label}
                  whileHover={{ scale: 1.04 }}
                  style={{
                    fontFamily: "var(--font-patrick)", fontSize: 12,
                    padding: "7px 14px",
                    background: btn.bg, color: btn.col,
                    border: `2px solid ${INK_BLACK}`,
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  <div style={{
                    position: "absolute", inset: 0,
                    border: `2px solid ${RISO_COLOR}`,
                    transform: "translate(2px, 2px)",
                    opacity: 0.4,
                    pointerEvents: "none", zIndex: -1,
                  }} />
                  {btn.label}
                </motion.button>
              ))}
            </div>

            {/* Creator */}
            <div style={{
              marginTop: 20, paddingTop: 16,
              borderTop: `2px solid ${INK_BLACK}`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                border: `2.5px solid ${INK_BLACK}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-brand)", fontSize: 22, color: INK_BLACK,
                background: RISO_LIGHT, flexShrink: 0,
              }}>P</div>
              <div>
                <div style={{ fontFamily: "var(--font-brand)", fontSize: 18, letterSpacing: "0.05em" }}>PAWEŁ POLUTEK</div>
                <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, opacity: 0.65 }}>4 823 subskrybentów</div>
              </div>
              <motion.button
                whileHover={{ background: INK_BLACK, color: PAPER }}
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-brand)", fontSize: 13, letterSpacing: "0.1em",
                  padding: "8px 16px",
                  background: PAPER, color: INK_BLACK,
                  border: `2.5px solid ${INK_BLACK}`,
                  cursor: "pointer", transition: "all 0.15s",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", inset: 0, border: `2px solid ${RISO_COLOR}`, transform: "translate(2px, 2px)", opacity: 0.5, zIndex: -1, pointerEvents: "none" }} />
                🔔 SUBSKRYBUJ
              </motion.button>
            </div>
          </div>

          {/* RIGHT: SIDEBAR */}
          <div>
            {/* Patron block — riso styled */}
            <div style={{
              border: `3px solid ${INK_BLACK}`,
              padding: "16px",
              marginBottom: 24,
              background: RISO_COLOR,
              position: "relative",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                border: `2px solid ${RISO_DARK}`,
                transform: "translate(3px, 3px)",
                zIndex: -1,
              }} />
              <div style={{ fontFamily: "var(--font-brand)", fontSize: 18, letterSpacing: "0.08em", color: PAPER, marginBottom: 8 }}>
                ★ ZOSTAŃ PATRONEM
              </div>
              <p style={{ fontFamily: "var(--font-patrick)", fontSize: 13, color: PAPER, opacity: 0.9, margin: "0 0 14px", lineHeight: 1.6 }}>
                Jednorazowe wsparcie → stały dostęp do bonusów na zawsze!
              </p>
              <motion.button
                whileHover={{ background: PAPER, color: INK_BLACK }}
                style={{
                  width: "100%", padding: "10px",
                  fontFamily: "var(--font-brand)", fontSize: 14, letterSpacing: "0.12em",
                  background: INK_BLACK, color: PAPER,
                  border: `2px solid ${PAPER}`,
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >WEJDŹ TERAZ →</motion.button>
            </div>

            {/* Label */}
            <div style={{
              fontFamily: "var(--font-brand)", fontSize: 11, letterSpacing: "0.25em",
              color: INK_BLACK, marginBottom: 12, opacity: 0.65,
            }}>WSZYSTKIE ODCINKI</div>

            {/* Video grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {videos.map((v, i) => (
                <RisoCard
                  key={v.id}
                  video={v}
                  isActive={v.id === activeId}
                  onClick={() => setActiveId(v.id)}
                  delay={i * 0.06}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ textAlign: "center", padding: "20px 0 32px", borderTop: `2px solid ${INK_BLACK}` }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-patrick)", fontSize: 13, color: INK_BLACK, textDecoration: "none", opacity: 0.6 }}>
          ← wszystkie layouty
        </Link>
      </div>
    </main>
  );
}
