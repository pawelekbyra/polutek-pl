"use client";

/**
 * Layout 14 — "Japońskie Pismo / Sumi-e"
 *
 * Techniki:
 * - perfect-freehand dla kaligraficznych pociągnięć pędzlem
 * - SVG brush strokes jako dekoracje i separatory
 * - Minimalistyczna typografia w stylu azjatyckim
 * - Asymetryczny grid (złoty podział)
 * - CSS text-orientation i writing-mode dla pionowego tekstu jako akcent
 * - framer-motion: ink "wylewa się" na scroll (stroke animation)
 * - Kolory: biała/kremowa kartka + głęboka czerń tuszu + czerwony pieczęć
 * - Fonts: Outfit (body) + Bebas Neue (display) + Caveat (notatki)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStroke } from "perfect-freehand";
import Link from "next/link";

const PAPER = "#f8f4ec";
const INK = "#0d0a07";
const INK_DIM = "#4a3a28";
const RED_SEAL = "#c0201a";
const GOLD = "#b8862a";

function getSvgPath(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"] as (string | number)[]
  );
  d.push("Z");
  return d.join(" ");
}

function BrushStroke({ points, opacity = 1, size = 8, thinning = 0.7 }: {
  points: [number, number][]; opacity?: number; size?: number; thinning?: number;
}) {
  const stroke = getStroke(points, { size, thinning, smoothing: 0.5, streamline: 0.6 });
  return <path d={getSvgPath(stroke)} fill={INK} opacity={opacity} />;
}

function HorizontalBrush({ width = 400, y = 10, thickness = 6, opacity = 0.8 }: { width?: number; y?: number; thickness?: number; opacity?: number }) {
  const pts: [number, number][] = [
    [0, y + 1],
    [width * 0.3, y - 1],
    [width * 0.6, y + 0.5],
    [width, y],
  ];
  const stroke = getStroke(pts, { size: thickness, thinning: 0.4, smoothing: 0.4, streamline: 0.5 });
  return <path d={getSvgPath(stroke)} fill={INK} opacity={opacity} />;
}

function RedSeal({ text = "P", x = 0, y = 0, size = 48, angle = 3 }: { text?: string; x?: number; y?: number; size?: number; angle?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${angle})`}>
      <rect x={0} y={0} width={size} height={size} fill={RED_SEAL} />
      <rect x={3} y={3} width={size - 6} height={size - 6} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <text
        x={size / 2} y={size * 0.68}
        textAnchor="middle"
        fontFamily="var(--font-brand)"
        fontSize={size * 0.55}
        fill={PAPER}
        letterSpacing="0"
      >{text}</text>
    </g>
  );
}

const videos = [
  { id: "1", title: "Jak to działa #12",    sub: "Dziwne prawa polskiego systemu",     time: "18:42", views: "12 tys." },
  { id: "2", title: "Patroni pytają Q&A",   sub: "Seria numer pięć — wasze pytania",   time: "11:08", views: "8 tys."  },
  { id: "3", title: "Notatnik Polutka #7",  sub: "Szkic tygodnia — krótki materiał",   time: "7:31",  views: "5 tys."  },
  { id: "4", title: "Manifest twórcy",      sub: "Dlaczego mówię to co mówię",         time: "22:15", views: "21 tys." },
  { id: "5", title: "Za kulisami kanału",   sub: "Jak nagrywam każdy odcinek",         time: "9:44",  views: "6 tys."  },
];

function VideoRow({ video, isActive, onClick, index }: {
  video: typeof videos[0]; isActive: boolean; onClick: () => void; index: number;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ x: 4 }}
      style={{
        cursor: "pointer", display: "flex", gap: 16, alignItems: "flex-start",
        padding: "14px 0",
        borderBottom: `1px solid ${INK}18`,
        background: isActive ? `${INK}05` : "transparent",
      }}
    >
      {/* Index brushstroke */}
      <div style={{
        width: 28, flexShrink: 0, paddingTop: 2,
        fontFamily: "var(--font-brand)", fontSize: 22,
        color: isActive ? RED_SEAL : INK_DIM,
        lineHeight: 1,
      }}>
        {(index + 1).toString().padStart(2, "0")}
      </div>

      {/* Thumbnail */}
      <div style={{
        width: 90, aspectRatio: "16/9", flexShrink: 0,
        border: `1px solid ${INK}33`,
        position: "relative", overflow: "hidden",
        background: isActive ? `${INK}08` : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isActive && (
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <HorizontalBrush width={100} y={50} thickness={4} opacity={0.15} />
          </svg>
        )}
        <span style={{ fontSize: 14, color: INK, opacity: 0.4 }}>▶</span>
        <div style={{
          position: "absolute", bottom: 3, right: 4,
          fontFamily: "var(--font-outfit)", fontSize: 9,
          color: INK, opacity: 0.5,
        }}>{video.time}</div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "var(--font-outfit)", fontSize: 14, fontWeight: 600,
          color: INK, lineHeight: 1.35, marginBottom: 3,
        }}>{video.title}</div>
        <div style={{
          fontFamily: "var(--font-outfit)", fontSize: 12, color: INK_DIM,
          lineHeight: 1.4,
        }}>{video.sub}</div>
        <div style={{ fontFamily: "var(--font-outfit)", fontSize: 10, color: INK_DIM, marginTop: 4, opacity: 0.7 }}>
          {video.views} wyświetleń
        </div>
      </div>
    </motion.div>
  );
}

export default function Layout14InkCalligraphy() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];
  const activeIndex = videos.findIndex(v => v.id === activeId);

  return (
    <main style={{
      minHeight: "100vh",
      background: PAPER,
      backgroundImage: `
        radial-gradient(ellipse at 5% 15%, rgba(184,134,42,0.06) 0%, transparent 40%),
        radial-gradient(ellipse at 95% 80%, rgba(192,32,26,0.04) 0%, transparent 35%)
      `,
      fontFamily: "var(--font-outfit)",
      color: INK,
    }}>

      {/* HEADER */}
      <header style={{
        maxWidth: 1100, margin: "0 auto", padding: "24px 32px 16px",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        {/* Logo area */}
        <div style={{ position: "relative" }}>
          {/* Brush decoration above logo */}
          <svg width="240" height="20" style={{ display: "block", marginBottom: -4 }}>
            <HorizontalBrush width={230} y={10} thickness={3} opacity={0.12} />
          </svg>
          <div style={{
            fontFamily: "var(--font-brand)", fontSize: 54, lineHeight: 0.9, letterSpacing: "0.06em",
            color: INK,
          }}>POLUTEK</div>
          <svg width="240" height="16" style={{ display: "block", marginTop: 2 }}>
            <HorizontalBrush width={230} y={8} thickness={2} opacity={0.2} />
          </svg>
          <div style={{
            fontFamily: "var(--font-outfit)", fontSize: 10, letterSpacing: "0.3em",
            color: INK_DIM, marginTop: 4, opacity: 0.7,
          }}>KANAŁ WIDEO · 2026</div>
        </div>

        {/* Vertical accent + seal */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Vertical nav */}
          <div style={{ display: "flex", gap: 8 }}>
            {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
              <motion.div
                key={item}
                whileHover={{ opacity: 0.7 }}
                style={{
                  fontFamily: "var(--font-outfit)", fontSize: 13,
                  color: i === 0 ? INK : INK_DIM,
                  cursor: "pointer", padding: "4px 0",
                  borderBottom: i === 0 ? `1.5px solid ${INK}` : "none",
                  fontWeight: i === 0 ? 600 : 400,
                }}
              >{item}</motion.div>
            ))}
          </div>
          <svg width="52" height="52">
            <RedSeal text="P" size={48} x={2} y={2} angle={-3} />
          </svg>
        </div>
      </header>

      {/* SEPARATOR */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px" }}>
        <svg width="100%" height="20">
          <HorizontalBrush width={1100} y={10} thickness={5} opacity={0.85} />
        </svg>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: 0 }}>

          {/* LEFT: VIDEO INFO (narrow column) */}
          <div style={{ paddingRight: 40, paddingTop: 8, position: "relative" }}>

            {/* Vertical accent line */}
            <div style={{
              position: "absolute", right: 20, top: 0, bottom: 0, width: 1,
              background: INK,
              opacity: 0.1,
            }} />

            {/* Category */}
            <div style={{
              fontFamily: "var(--font-outfit)", fontSize: 10, letterSpacing: "0.3em",
              color: RED_SEAL, marginBottom: 16, opacity: 0.85,
            }}>
              GŁÓWNY MATERIAŁ
            </div>

            {/* Large title */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId + "-h"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 style={{
                  fontFamily: "var(--font-brand)", fontSize: 34, lineHeight: 1.0,
                  letterSpacing: "0.04em", color: INK, margin: "0 0 12px",
                }}>
                  {active.title.toUpperCase()}
                </h1>
                <p style={{
                  fontFamily: "var(--font-outfit)", fontSize: 14, lineHeight: 1.7,
                  color: INK_DIM, margin: "0 0 16px",
                }}>
                  {active.sub}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Stats */}
            <AnimatePresence mode="wait">
              <motion.div key={activeId + "-s"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {[
                    { k: "Wyświetleń", v: active.views },
                    { k: "Czas trwania", v: active.time + " min" },
                    { k: "Odcinek", v: "#" + (activeIndex + 1) + " / " + videos.length },
                  ].map(item => (
                    <div key={item.k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-outfit)", fontSize: 11, color: INK_DIM, opacity: 0.7 }}>{item.k}</span>
                      <span style={{ fontFamily: "var(--font-outfit)", fontSize: 11, fontWeight: 600, color: INK }}>{item.v}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Brush divider */}
            <svg width="100%" height="14" style={{ marginBottom: 16 }}>
              <HorizontalBrush width={300} y={7} thickness={2} opacity={0.2} />
            </svg>

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["👍  Polub (1 847)", "↗  Udostępnij", "💬  Komentarze (234)"].map(btn => (
                <motion.button
                  key={btn}
                  whileHover={{ paddingLeft: 16 }}
                  style={{
                    fontFamily: "var(--font-outfit)", fontSize: 12,
                    padding: "8px 12px",
                    background: "transparent",
                    border: `1px solid ${INK}22`,
                    color: INK, cursor: "pointer", textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >{btn}</motion.button>
              ))}
            </div>

            {/* Creator */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${INK}15` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <svg width="40" height="40">
                  <circle cx="20" cy="20" r="18" fill={INK} opacity="0.9" />
                  <text x="20" y="27" textAnchor="middle" fontFamily="var(--font-brand)" fontSize="18" fill={PAPER}>P</text>
                  <RedSeal text="✓" x={26} y={26} size={14} angle={5} />
                </svg>
                <div>
                  <div style={{ fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 700 }}>Paweł Polutek</div>
                  <div style={{ fontFamily: "var(--font-outfit)", fontSize: 10, color: INK_DIM }}>4 823 subskrybentów</div>
                </div>
              </div>
              <motion.button
                whileHover={{ background: INK, color: PAPER }}
                style={{
                  width: "100%", padding: "9px",
                  fontFamily: "var(--font-outfit)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                  background: PAPER, color: INK,
                  border: `1.5px solid ${INK}`,
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >🔔 SUBSKRYBUJ</motion.button>
            </div>

            {/* Patron box */}
            <div style={{
              marginTop: 16, padding: "14px",
              border: `1px solid ${GOLD}66`,
              background: `${GOLD}08`,
            }}>
              <svg width="30" height="30" style={{ marginBottom: 6 }}>
                <RedSeal text="★" size={28} angle={2} />
              </svg>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>
                Zostań Patronem
              </div>
              <p style={{ fontFamily: "var(--font-outfit)", fontSize: 12, color: INK_DIM, margin: "0 0 10px", lineHeight: 1.6 }}>
                Jednorazowe wsparcie = dostęp do wszystkich bonusów.
              </p>
              <motion.button
                whileHover={{ background: INK, color: PAPER }}
                style={{
                  width: "100%", padding: "8px",
                  fontFamily: "var(--font-outfit)", fontSize: 11, fontWeight: 700,
                  background: PAPER, color: INK,
                  border: `1.5px solid ${INK}`,
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >Wesprzyj →</motion.button>
            </div>
          </div>

          {/* RIGHT: VIDEO + LIST */}
          <div style={{ paddingLeft: 40 }}>

            {/* Video */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "relative", marginBottom: 28 }}
              >
                <div style={{
                  aspectRatio: "16/9",
                  background: `linear-gradient(135deg, ${INK}18 0%, ${INK}08 100%)`,
                  border: `1px solid ${INK}33`,
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Brush texture overlay */}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07 }}>
                    <HorizontalBrush width={700} y={60} thickness={80} opacity={0.8} />
                    <HorizontalBrush width={700} y={200} thickness={60} opacity={0.5} />
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      style={{
                        width: 76, height: 76, cursor: "pointer",
                        border: `2px solid ${INK}`,
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(248,244,236,0.85)",
                        boxShadow: "2px 4px 16px rgba(13,10,7,0.15)",
                      }}
                    >
                      <span style={{ fontSize: 28, marginLeft: 6 }}>▶</span>
                    </motion.div>
                  </div>
                  <div style={{
                    position: "absolute", bottom: 10, right: 14,
                    fontFamily: "var(--font-outfit)", fontSize: 12, color: INK,
                    background: "rgba(248,244,236,0.8)", padding: "2px 8px",
                    border: `1px solid ${INK}22`,
                  }}>{active.time}</div>
                  {/* Red seal corner */}
                  <svg style={{ position: "absolute", top: 10, right: 14 }} width="36" height="36">
                    <RedSeal text="N" size={32} angle={5} />
                  </svg>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Brush separator */}
            <svg width="100%" height="14" style={{ marginBottom: 16 }}>
              <HorizontalBrush width={700} y={7} thickness={2} opacity={0.15} />
            </svg>

            {/* Video list label */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 6,
            }}>
              <span style={{
                fontFamily: "var(--font-outfit)", fontSize: 10, letterSpacing: "0.3em",
                color: INK_DIM, opacity: 0.7,
              }}>WSZYSTKIE ODCINKI</span>
              <div style={{ flex: 1, height: 1, background: INK, opacity: 0.1 }} />
              <svg width="24" height="24">
                <RedSeal text={videos.length.toString()} size={22} angle={-4} />
              </svg>
            </div>

            {/* Video list */}
            {videos.map((v, i) => (
              <VideoRow
                key={v.id}
                video={v}
                isActive={v.id === activeId}
                onClick={() => setActiveId(v.id)}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER BRUSH */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px" }}>
        <svg width="100%" height="20">
          <HorizontalBrush width={1100} y={10} thickness={4} opacity={0.6} />
        </svg>
      </div>

      {/* NAV */}
      <div style={{ textAlign: "center", padding: "20px 0 32px" }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-outfit)", fontSize: 12, letterSpacing: "0.15em", color: INK_DIM, textDecoration: "none" }}>
          ← WSZYSTKIE LAYOUTY
        </Link>
      </div>
    </main>
  );
}
