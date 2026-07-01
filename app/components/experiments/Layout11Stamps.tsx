"use client";

/**
 * Layout 11 — "Znaczki Pocztowe"
 *
 * Techniki:
 * - CSS border perforowana (postage stamp serrated edge) przez radial-gradient
 * - Każdy odcinek = znaczek pocztowy z perforowaną ramką
 * - SVG cancel marks (stempel kasownika pocztowego — ukośne linie)
 * - framer-motion flip animation przy kliknięciu znaczka
 * - CSS rotations, różne formaty znaczków
 * - Stary papier kopert w tle (diagonal striping airmail)
 * - Fonts: Space Grotesk (techniczny tekst znaczka) + Caveat (odręczny adres)
 * - Paleta: kremowy papier, czerwone i niebieskie stemple, sepia
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const PAPER = "#f5eedc";
const INK = "#1a1209";
const RED_INK = "#8b2014";
const BLUE_INK = "#1a3a6b";
const SEPIA = "#6b4c22";
const CANCEL_RED = "rgba(140,32,20,0.6)";

const videos = [
  { id: "1", title: "Jak to działa #12", subtitle: "Dziwne prawa systemu", time: "18:42", views: "12 tys.", angle: -1.5, size: "lg", cancelColor: RED_INK  },
  { id: "2", title: "Patroni pytają",    subtitle: "Q&A seria #5",         time: "11:08", views: "8 tys.",  angle: 2.3,  size: "sm", cancelColor: BLUE_INK },
  { id: "3", title: "Notatnik #7",       subtitle: "Szkic tygodnia",       time: "7:31",  views: "5 tys.",  angle: -0.8, size: "sm", cancelColor: RED_INK  },
  { id: "4", title: "Manifest twórcy",   subtitle: "Dlaczego mówię",       time: "22:15", views: "21 tys.", angle: 1.2,  size: "md", cancelColor: BLUE_INK },
  { id: "5", title: "Za kulisami",       subtitle: "Jak nagrywam odcinki", time: "9:44",  views: "6 tys.",  angle: -2.1, size: "sm", cancelColor: RED_INK  },
  { id: "6", title: "Absurdy #1",        subtitle: "Infografika w liczbach",time: "5:12",  views: "3 tys.",  angle: 0.9,  size: "sm", cancelColor: BLUE_INK },
];

function StampEdge({ width, height }: { width: number; height: number }) {
  const holeR = 5;
  const hGap = 16;
  const vGap = 16;
  const margin = 6;

  const holes: React.ReactNode[] = [];

  // Top edge
  const hCount = Math.floor((width - margin * 2) / hGap);
  for (let i = 0; i <= hCount; i++) {
    const x = margin + i * ((width - margin * 2) / hCount);
    holes.push(<circle key={`t${i}`} cx={x} cy={margin} r={holeR} />);
    holes.push(<circle key={`b${i}`} cx={x} cy={height - margin} r={holeR} />);
  }

  // Side edges
  const vCount = Math.floor((height - margin * 2) / vGap);
  for (let i = 1; i < vCount; i++) {
    const y = margin + i * ((height - margin * 2) / vCount);
    holes.push(<circle key={`l${i}`} cx={margin} cy={y} r={holeR} />);
    holes.push(<circle key={`r${i}`} cx={width - margin} cy={y} r={holeR} />);
  }

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}
      width={width} height={height}
    >
      <defs>
        <mask id={`stamp-mask-${width}`}>
          <rect width={width} height={height} fill="white" />
          {holes.map((h, i) => React.cloneElement(h as React.ReactElement, { key: i, fill: "black" }))}
        </mask>
      </defs>
      {/* White circles cut out */}
      <g fill="#e8e0d0">
        {holes}
      </g>
    </svg>
  );
}

function CancelMark({ color = CANCEL_RED, angle = -25 }: { color?: string; angle?: number }) {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6, opacity: 0.7 }}>
      {/* Wavy cancel lines */}
      <path d={`M -10 30 Q 30 25 70 30 Q 110 35 150 30 Q 190 25 230 30`}
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" transform={`rotate(${angle}, 100, 60)`} />
      <path d={`M -10 42 Q 30 37 70 42 Q 110 47 150 42 Q 190 37 230 42`}
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" transform={`rotate(${angle}, 100, 60)`} />
      <path d={`M -10 54 Q 30 49 70 54 Q 110 59 150 54 Q 190 49 230 54`}
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" transform={`rotate(${angle}, 100, 60)`} />
    </svg>
  );
}

function StampCard({ video, isActive, onClick }: { video: typeof videos[0]; isActive: boolean; onClick: () => void }) {
  const w = video.size === "lg" ? 220 : video.size === "md" ? 180 : 150;
  const h = video.size === "lg" ? 170 : video.size === "md" ? 140 : 120;

  return (
    <motion.div
      onClick={onClick}
      animate={{ rotate: isActive ? 0 : video.angle }}
      whileHover={{ scale: 1.06, rotate: 0, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      style={{
        position: "relative",
        width: w, height: h,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {/* Stamp background */}
      <div style={{
        position: "absolute", inset: 0,
        background: PAPER,
        boxShadow: isActive
          ? `0 8px 24px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15)`
          : `2px 3px 10px rgba(0,0,0,0.25)`,
        borderRadius: 2,
      }} />

      {/* Perforated edge */}
      <StampEdge width={w} height={h} />

      {/* Content */}
      <div style={{
        position: "absolute", inset: 12, zIndex: 1,
        padding: 4,
        border: `1px solid ${INK}22`,
        display: "flex", flexDirection: "column",
      }}>
        {/* Image area */}
        <div style={{
          flex: 1, background: `linear-gradient(135deg, #e8d8b8 0%, #d4c49a 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
          marginBottom: 4,
        }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.2 }}>
            <line x1="0" y1="0" x2="100%" y2="100%" stroke={SEPIA} strokeWidth="0.7"/>
            <line x1="100%" y1="0" x2="0" y2="100%" stroke={SEPIA} strokeWidth="0.7"/>
          </svg>
          <span style={{ fontSize: video.size === "sm" ? 18 : 24, opacity: 0.5 }}>▶</span>
          <div style={{
            position: "absolute", bottom: 2, right: 4,
            fontFamily: "var(--font-space-grotesk)", fontSize: 8,
            color: SEPIA, opacity: 0.8,
          }}>{video.time}</div>
        </div>

        {/* Stamp info */}
        <div style={{ padding: "2px 0" }}>
          <div style={{
            fontFamily: "var(--font-brand)", fontSize: video.size === "sm" ? 10 : 13,
            letterSpacing: "0.05em", color: INK, lineHeight: 1.1,
          }}>{video.title}</div>
          <div style={{
            fontFamily: "var(--font-space-grotesk)", fontSize: 8,
            color: SEPIA, lineHeight: 1.2,
          }}>{video.views}</div>
        </div>
      </div>

      {/* Cancel mark */}
      {!isActive && <CancelMark color={video.cancelColor} angle={-20 + video.angle * 2} />}

      {/* Active: no cancel, but glow */}
      {isActive && (
        <div style={{
          position: "absolute", inset: -3,
          border: `2px solid ${RED_INK}`,
          pointerEvents: "none",
          zIndex: 10,
          borderRadius: 3,
        }} />
      )}
    </motion.div>
  );
}

export default function Layout11Stamps() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: "#ddd4c0",
      backgroundImage: `
        repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 18px,
          rgba(26,18,9,0.04) 18px,
          rgba(26,18,9,0.04) 36px
        ),
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 18px,
          rgba(26,18,9,0.03) 18px,
          rgba(26,18,9,0.03) 36px
        )
      `,
      fontFamily: "var(--font-caveat)",
      color: INK,
      position: "relative",
    }}>

      {/* ENVELOPE HEADER */}
      <div style={{
        background: PAPER,
        padding: "0",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      }}>
        {/* Airmail stripes */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 8,
          backgroundImage: "repeating-linear-gradient(90deg, #dc2626 0px, #dc2626 20px, #1e40af 20px, #1e40af 40px)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
          backgroundImage: "repeating-linear-gradient(90deg, #1e40af 0px, #1e40af 20px, #dc2626 20px, #dc2626 40px)",
        }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          {/* Logo as address */}
          <div>
            <div style={{ fontFamily: "var(--font-brand)", fontSize: 44, letterSpacing: "0.05em", lineHeight: 1, color: INK }}>
              POLUTEK
            </div>
            <div style={{ fontFamily: "var(--font-caveat)", fontSize: 13, color: SEPIA, transform: "rotate(-0.5deg)" }}>
              Niezależny kanał wideo · 2026
            </div>
          </div>

          {/* Handwritten "address" */}
          <div style={{ transform: "rotate(-1deg)" }}>
            <div style={{ fontFamily: "var(--font-caveat)", fontSize: 14, color: BLUE_INK }}>
              Od: Paweł Polutek
            </div>
            <div style={{ fontFamily: "var(--font-caveat)", fontSize: 12, color: SEPIA }}>
              ul. Filmowa 1, Studio A
            </div>
          </div>

          <nav style={{ display: "flex", gap: 0 }}>
            {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
              <motion.div
                key={item}
                whileHover={{ y: -1 }}
                style={{
                  fontFamily: "var(--font-space-grotesk)", fontSize: 11, letterSpacing: "0.1em",
                  color: i === 0 ? BLUE_INK : SEPIA,
                  cursor: "pointer", padding: "5px 12px",
                  borderBottom: i === 0 ? `2px solid ${BLUE_INK}` : "none",
                  fontWeight: i === 0 ? 700 : 400,
                }}
              >{item}</motion.div>
            ))}
          </nav>

          {/* Stamp for "Wspieram" */}
          <motion.div
            whileHover={{ scale: 1.05, rotate: 0 }}
            style={{
              width: 90, height: 80, position: "relative",
              cursor: "pointer",
            }}
          >
            <StampEdge width={90} height={80} />
            <div style={{
              position: "absolute", inset: 8,
              background: "#fde68a",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              border: `1px solid ${SEPIA}33`,
            }}>
              <div style={{ fontSize: 20 }}>❤️</div>
              <div style={{
                fontFamily: "var(--font-brand)", fontSize: 9, letterSpacing: "0.15em",
                color: RED_INK,
              }}>WSPIERAM</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1100, margin: "32px auto", padding: "0 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr", gap: 40 }}>

          {/* LEFT: FEATURED STAMP + INFO */}
          <div>
            <div style={{ fontFamily: "var(--font-caveat)", fontSize: 13, color: SEPIA, marginBottom: 20, transform: "rotate(-1deg)" }}>
              ✦ aktualnie na tablicy:
            </div>

            {/* Large feature stamp */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "relative", marginBottom: 24 }}
              >
                {/* Big stamp */}
                <div style={{
                  position: "relative",
                  width: "100%", paddingBottom: "62%",
                  background: PAPER,
                  boxShadow: "4px 6px 20px rgba(0,0,0,0.25)",
                }}>
                  <StampEdge width={600} height={370} />
                  <div style={{
                    position: "absolute", inset: 18,
                    border: `1px solid ${INK}22`,
                    display: "flex", flexDirection: "column",
                  }}>
                    {/* Image area */}
                    <div style={{
                      flex: 1, background: `linear-gradient(135deg, #e0d0b0 0%, #c8b890 100%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative",
                    }}>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        style={{
                          width: 64, height: 64, borderRadius: "50%",
                          background: "rgba(255,255,255,0.85)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "2px 3px 12px rgba(0,0,0,0.2)",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 24, marginLeft: 5 }}>▶</span>
                      </motion.div>
                      <div style={{
                        position: "absolute", bottom: 8, right: 12,
                        background: "rgba(0,0,0,0.6)", color: "#fff",
                        fontFamily: "var(--font-space-grotesk)", fontSize: 12,
                        padding: "2px 8px", borderRadius: 2,
                      }}>{active.time}</div>
                    </div>
                    {/* Info strip */}
                    <div style={{ padding: "8px 10px", background: "#fdf8ee" }}>
                      <div style={{
                        fontFamily: "var(--font-brand)", fontSize: 18, letterSpacing: "0.05em",
                        color: INK, lineHeight: 1.1,
                      }}>{active.title}</div>
                      <div style={{
                        fontFamily: "var(--font-space-grotesk)", fontSize: 10,
                        color: SEPIA,
                      }}>{active.subtitle} · {active.views}</div>
                    </div>
                  </div>
                </div>

                {/* Description below */}
                <div style={{ marginTop: 16, padding: "14px 16px", background: PAPER, boxShadow: "1px 2px 8px rgba(0,0,0,0.12)" }}>
                  <p style={{ fontFamily: "var(--font-caveat)", fontSize: 16, lineHeight: 1.7, color: INK, margin: "0 0 12px" }}>
                    Przez kilka tygodni zbierałem przykłady absurdalnych przepisów. Rozmowy z prawnikami i obywatelami — materiał, który warto obejrzeć.
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["👍 Polub", "↗ Udostępnij", "💬 Komentarze", "⋯"].map(btn => (
                      <motion.button
                        key={btn}
                        whileHover={{ y: -1 }}
                        style={{
                          fontFamily: "var(--font-caveat)", fontSize: 13,
                          padding: "5px 11px",
                          background: "transparent",
                          border: `1px solid ${INK}33`,
                          color: INK, cursor: "pointer", borderRadius: 2,
                        }}
                      >{btn}</motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT: STAMP COLLECTION */}
          <div>
            <div style={{ fontFamily: "var(--font-caveat)", fontSize: 13, color: SEPIA, marginBottom: 20, transform: "rotate(1deg)" }}>
              kolekcja odcinków →
            </div>

            {/* Patron stamp — special */}
            <motion.div
              whileHover={{ scale: 1.05, rotate: 0 }}
              style={{
                position: "relative", width: "100%", paddingBottom: "35%",
                marginBottom: 28, cursor: "pointer",
              }}
            >
              <div style={{
                position: "absolute", inset: 0,
                background: "#e8d8f8",
                boxShadow: "3px 4px 14px rgba(0,0,0,0.2)",
                transform: "rotate(-1deg)",
              }}>
                <StampEdge width={360} height={130} />
                <div style={{
                  position: "absolute", inset: 12,
                  border: `1px solid #7c3aed44`,
                  display: "flex", gap: 14, alignItems: "center",
                  padding: "8px 14px",
                }}>
                  <div style={{ fontSize: 36 }}>🎁</div>
                  <div>
                    <div style={{ fontFamily: "var(--font-brand)", fontSize: 14, letterSpacing: "0.08em", color: "#7c3aed" }}>ZOSTAŃ PATRONEM</div>
                    <div style={{ fontFamily: "var(--font-caveat)", fontSize: 12, color: SEPIA, lineHeight: 1.4 }}>
                      Jednorazowe wsparcie → stały dostęp do wszystkich bonusów!
                    </div>
                  </div>
                </div>
                <CancelMark color="rgba(124,58,237,0.3)" angle={-15} />
              </div>
            </motion.div>

            {/* Stamp grid */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
              {videos.map(v => (
                <StampCard
                  key={v.id}
                  video={v}
                  isActive={v.id === activeId}
                  onClick={() => setActiveId(v.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ textAlign: "center", padding: "20px 0 32px" }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-caveat)", fontSize: 14, color: SEPIA, textDecoration: "none" }}>
          ← wszystkie layouty
        </Link>
      </div>
    </main>
  );
}
