"use client";

/**
 * Layout 9 — "Skrawki Papieru"
 *
 * Techniki:
 * - CSS clip-path z wielokątem "poszarpanym" — symulacja podartego papieru
 * - SVG feTurbulence + feDisplacementMap dla organicznych krawędzi
 * - Każda sekcja to osobny skrawek, nakładające się warstwy
 * - CSS drop-shadow dla głębi nakładanych warstw
 * - mix-blend-mode: multiply dla naturalnego nakładania papierów
 * - Różne faktury papieru (ciepłe, chłodne, kremowe) na każdym skrawku
 * - Fonts: Outfit (body) + Bebas Neue (nagłówki) + Caveat (notatki)
 * - Paleta: warm cream, sage, coral, dusty blue
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const papers = {
  cream:  "#f8f3e8",
  sage:   "#eaf3ed",
  coral:  "#fdf0ed",
  blue:   "#edf0f8",
  yellow: "#fdf8e8",
  white:  "#fefefe",
};
const INK = "#1a1209";
const INK_LIGHT = "#7a6a4a";

const videos = [
  { id: "1", title: "Jak to działa #12 — dziwne prawa",    time: "18:42", views: "12 tys.", paper: papers.cream  },
  { id: "2", title: "Patroni pytają — Q&A seria #5",       time: "11:08", views: "8 tys.",  paper: papers.sage   },
  { id: "3", title: "Notatnik Polutka — szkic tygodnia #7",time: "7:31",  views: "5 tys.",  paper: papers.coral  },
  { id: "4", title: "Dlaczego mówię to co mówię",          time: "22:15", views: "21 tys.", paper: papers.blue   },
  { id: "5", title: "Za kulisami — jak nagrywam odcinki",  time: "9:44",  views: "6 tys.",  paper: papers.yellow },
];

// Generates a "torn edge" polygon as CSS clip-path string
function tornEdge(side: "top" | "bottom" | "left" | "right", seed = 1) {
  const n = 22;
  if (side === "bottom") {
    const pts = ["0 85%"];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * 100;
      const noise = Math.sin(seed * 17 + i * 3.7) * 3.5 + Math.sin(seed * 7 + i * 7.3) * 2;
      pts.push(`${x}% ${(100 + noise).toFixed(1)}%`);
    }
    pts.push("100% 85%", "100% 0", "0 0");
    return `polygon(${pts.join(", ")})`;
  }
  if (side === "top") {
    const pts = ["0 100%", "100% 100%", "100% 15%"];
    for (let i = n; i >= 0; i--) {
      const x = (i / n) * 100;
      const noise = Math.sin(seed * 13 + i * 4.1) * 3 + Math.sin(seed * 5 + i * 6.9) * 2;
      pts.push(`${x}% ${(noise + 1).toFixed(1)}%`);
    }
    pts.push("0 15%");
    return `polygon(${pts.join(", ")})`;
  }
  return "none";
}

function TornSheet({
  children, bg = papers.cream, tornBottom = false, tornTop = false,
  seed = 1, zIndex = 1, style = {},
}: {
  children: React.ReactNode;
  bg?: string;
  tornBottom?: boolean;
  tornTop?: boolean;
  seed?: number;
  zIndex?: number;
  style?: React.CSSProperties;
}) {
  const clip = tornBottom ? tornEdge("bottom", seed) : tornTop ? tornEdge("top", seed) : undefined;

  return (
    <div style={{
      position: "relative",
      background: bg,
      clipPath: clip,
      zIndex,
      boxShadow: "0 2px 12px rgba(0,0,0,0.12), 0 6px 24px rgba(0,0,0,0.08)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function VideoCard({ video, isActive, onClick, delay = 0 }: {
  video: typeof videos[0]; isActive: boolean; onClick: () => void; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      whileHover={{ x: 4 }}
      style={{
        cursor: "pointer",
        display: "flex", gap: 12, alignItems: "flex-start",
        padding: "10px 0",
        borderBottom: `1px solid ${INK}15`,
        background: isActive ? `${INK}06` : "transparent",
        paddingLeft: isActive ? 8 : 0,
        transition: "all 0.2s",
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 80, aspectRatio: "16/9", flexShrink: 0,
        background: video.paper,
        border: `1px solid ${INK}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line x1="0" y1="0" x2="100%" y2="100%" stroke={`${INK}22`} strokeWidth="0.7" />
          <line x1="100%" y1="0" x2="0" y2="100%" stroke={`${INK}22`} strokeWidth="0.7" />
        </svg>
        <span style={{ fontSize: 12, position: "relative", zIndex: 1, opacity: 0.5 }}>▶</span>
        <div style={{
          position: "absolute", bottom: 2, right: 3,
          fontFamily: "var(--font-space-grotesk)", fontSize: 8, color: INK, opacity: 0.6,
        }}>{video.time}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 600,
          color: INK, lineHeight: 1.4, marginBottom: 3,
        }}>{video.title}</div>
        <div style={{ fontFamily: "var(--font-patrick)", fontSize: 10, color: INK_LIGHT }}>{video.views}</div>
      </div>
    </motion.div>
  );
}

export default function Layout9TornPaper() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: "#e8e0d0",
      backgroundImage: `
        radial-gradient(circle at 1px 1px, rgba(26,18,9,0.06) 1px, transparent 0)
      `,
      backgroundSize: "20px 20px",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* SVG FILTER for torn edges */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="torn-soft">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" seed="8"/>
            <feDisplacementMap in="SourceGraphic" scale="3" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <filter id="paper-shadow" x="-5%" y="-5%" width="115%" height="120%">
            <feDropShadow dx="2" dy="4" stdDeviation="6" floodColor="#1a1209" floodOpacity="0.15"/>
          </filter>
        </defs>
      </svg>

      {/* HEADER SHEET — torn bottom */}
      <TornSheet bg={papers.cream} tornBottom seed={3} zIndex={3} style={{ paddingBottom: 60 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div style={{
              fontFamily: "var(--font-brand)", fontSize: 48, lineHeight: 1,
              letterSpacing: "0.04em", color: INK,
            }}>POLUTEK</div>
            <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
                <motion.div
                  key={item}
                  whileHover={{ y: -2 }}
                  style={{
                    fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: i === 0 ? 700 : 400,
                    color: INK, cursor: "pointer", padding: "6px 14px",
                    background: i === 0 ? INK : "transparent",
                    color2: i === 0 ? papers.cream : INK,
                    border: `1px solid ${INK}44`,
                    borderRadius: 2,
                    ...(i === 0 ? { color: papers.cream, border: `1px solid ${INK}` } : {}),
                  } as React.CSSProperties}
                >{item}</motion.div>
              ))}
            </nav>
            <motion.div
              whileHover={{ scale: 1.03 }}
              style={{
                fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 700,
                color: papers.cream, cursor: "pointer", padding: "8px 18px",
                background: "#c0392b",
                border: `1px solid ${INK}`,
                borderRadius: 2,
              }}
            >❤️ Wspieram</motion.div>
          </div>
          <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: INK_LIGHT, marginTop: 6 }}>
            niezależny kanał wideo
          </div>
        </div>
      </TornSheet>

      {/* HERO SHEET — offset, torn top + bottom */}
      <div style={{ position: "relative", zIndex: 2, marginTop: -40 }}>
        <TornSheet bg={papers.blue} tornTop tornBottom seed={7} style={{ padding: "60px 0 70px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 32 }}>

              {/* VIDEO */}
              <div>
                <div style={{ fontFamily: "var(--font-caveat)", fontSize: 13, color: INK_LIGHT, marginBottom: 10, letterSpacing: "0.1em" }}>
                  ✦ główny materiał tygodnia
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      aspectRatio: "16/9",
                      background: `linear-gradient(135deg, ${INK}22 0%, ${INK}08 100%)`,
                      border: `1px solid ${INK}33`,
                      position: "relative",
                      overflow: "hidden",
                      marginBottom: 18,
                      filter: "url(#torn-soft)",
                    }}
                  >
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        style={{
                          width: 70, height: 70,
                          border: `2px solid ${INK}`,
                          borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(255,255,255,0.8)",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 26, marginLeft: 5 }}>▶</span>
                      </motion.div>
                    </div>
                    <div style={{
                      position: "absolute", bottom: 10, right: 14,
                      background: "rgba(0,0,0,0.6)", color: "#fff",
                      fontFamily: "var(--font-space-grotesk)", fontSize: 11,
                      padding: "2px 7px",
                    }}>{active.time}</div>
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  <motion.div key={activeId + "-t"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <h1 style={{
                      fontFamily: "var(--font-outfit)", fontSize: 26, fontWeight: 700,
                      color: INK, lineHeight: 1.25, margin: "0 0 10px",
                      letterSpacing: "-0.02em",
                    }}>{active.title}</h1>
                    <div style={{ fontFamily: "var(--font-patrick)", fontSize: 12, color: INK_LIGHT, marginBottom: 16 }}>
                      {active.views} wyświetleń · 3 dni temu
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["👍 1847", "👎 23", "↗ Udostępnij", "⋯"].map(btn => (
                        <motion.button
                          key={btn}
                          whileHover={{ y: -1 }}
                          style={{
                            fontFamily: "var(--font-outfit)", fontSize: 12,
                            padding: "7px 13px", background: "rgba(255,255,255,0.7)",
                            border: `1px solid ${INK}33`, borderRadius: 2,
                            color: INK, cursor: "pointer",
                          }}
                        >{btn}</motion.button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* PATRON SCRAP */}
              <div>
                <div style={{
                  background: papers.yellow,
                  padding: "18px",
                  border: `1px solid ${INK}22`,
                  marginBottom: 20,
                  transform: "rotate(-0.8deg)",
                  boxShadow: "2px 4px 12px rgba(0,0,0,0.12)",
                }}>
                  <div style={{ fontFamily: "var(--font-caveat)", fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>
                    🎁 Zostań Patronem
                  </div>
                  <p style={{ fontFamily: "var(--font-caveat)", fontSize: 14, lineHeight: 1.6, color: INK_LIGHT, margin: "0 0 14px" }}>
                    Jednorazowe wsparcie → stały dostęp do bonusów na zawsze.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    style={{
                      width: "100%", padding: "10px",
                      fontFamily: "var(--font-caveat)", fontSize: 15, fontWeight: 700,
                      background: INK, color: papers.cream,
                      border: "none", cursor: "pointer",
                      borderRadius: 2,
                    }}
                  >Wejście →</motion.button>
                </div>
              </div>
            </div>
          </div>
        </TornSheet>
      </div>

      {/* VIDEO LIST SHEET — torn top */}
      <div style={{ position: "relative", zIndex: 1, marginTop: -40 }}>
        <TornSheet bg={papers.white} tornTop seed={11} style={{ paddingTop: 70, paddingBottom: 60 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <h2 style={{
                fontFamily: "var(--font-brand)", fontSize: 24, letterSpacing: "0.08em",
                color: INK, margin: 0,
              }}>LISTA ODCINKÓW</h2>
              <div style={{ flex: 1, height: 1, background: `${INK}22` }} />
              <span style={{ fontFamily: "var(--font-caveat)", fontSize: 13, color: INK_LIGHT, transform: "rotate(-1deg)" }}>
                5 materiałów
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
              {videos.map((v, i) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  isActive={v.id === activeId}
                  onClick={() => setActiveId(v.id)}
                  delay={i * 0.07}
                />
              ))}
            </div>
          </div>
        </TornSheet>
      </div>

      {/* NAV */}
      <div style={{ position: "relative", zIndex: 4, textAlign: "center", padding: "24px 0 32px", background: "#e8e0d0" }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: INK_LIGHT, textDecoration: "none" }}>
          ← wszystkie layouty
        </Link>
      </div>
    </main>
  );
}
