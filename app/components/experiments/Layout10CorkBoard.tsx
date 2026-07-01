"use client";

/**
 * Layout 10 — "Tablica Korkowa"
 *
 * Techniki:
 * - CSS background-image z radial-gradient symulującym korek
 * - perfect-freehand dla pinezek (organiczne kształty)
 * - Karteczki post-it z losowymi rotacjami, dropShadow
 * - framer-motion: hover podnosi karteczkę + delikatny cień
 * - CSS ::before trick dla cienia karteczki (fold shadow)
 * - Tape strips ze SVG
 * - Fonts: Caveat (karteczki) + Patrick Hand (napisy) + Bebas Neue (label sekcji)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const CORK = "#c8a878";
const CORK_DARK = "#a08858";
const INK = "#1a1209";
const POST_YELLOW = "#fef08a";
const POST_PINK = "#fda4af";
const POST_BLUE = "#93c5fd";
const POST_GREEN = "#86efac";
const POST_ORANGE = "#fdba74";
const POST_PURPLE = "#c4b5fd";
const TAPE = "rgba(255,235,150,0.72)";
const PIN_RED = "#dc2626";
const PIN_BLUE = "#2563eb";

const videos = [
  { id: "1", title: "Jak to działa #12 — dziwne prawa polskiego systemu",    time: "18:42", views: "12 tys.", badge: "NOWY", color: POST_YELLOW, angle: -2.3, pinColor: PIN_RED  },
  { id: "2", title: "Patroni pytają — Q&A seria numer 5",                    time: "11:08", views: "8 tys.",  badge: "PATRON", color: POST_BLUE,   angle: 1.8,  pinColor: PIN_BLUE },
  { id: "3", title: "Notatnik Polutka #7 — szkic tygodnia",                  time: "7:31",  views: "5 tys.",  badge: "SZKIC", color: POST_GREEN,  angle: -1.2, pinColor: PIN_RED  },
  { id: "4", title: "Dlaczego mówię to co mówię — manifest twórcy",          time: "22:15", views: "21 tys.", badge: "ESEJ",  color: POST_PINK,   angle: 2.4,  pinColor: PIN_BLUE },
  { id: "5", title: "Za kulisami — jak powstaje każdy odcinek",              time: "9:44",  views: "6 tys.",  badge: "BONUS", color: POST_ORANGE, angle: -0.8, pinColor: PIN_RED  },
  { id: "6", title: "Absurdy polskiego prawa w liczbach — infografika",       time: "5:12",  views: "3 tys.",  badge: "INFO",  color: POST_PURPLE, angle: 1.5,  pinColor: PIN_BLUE },
];

function Pin({ color = PIN_RED }: { color?: string }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" style={{
      position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
      filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.4))",
      zIndex: 10,
      pointerEvents: "none",
    }}>
      <circle cx="11" cy="9" r="8" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.8"/>
      <circle cx="11" cy="9" r="4" fill="rgba(255,255,255,0.3)"/>
      <line x1="11" y1="17" x2="11" y2="26" stroke="#5a3a1a" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function TapeStrip({ angle = 0, width = 60, top = -8, left = "50%" }: { angle?: number; width?: number; top?: number; left?: string }) {
  return (
    <div style={{
      position: "absolute", top, left, transform: `translateX(-50%) rotate(${angle}deg)`,
      width, height: 18,
      background: TAPE,
      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      borderRadius: 1,
      zIndex: 5,
    }} />
  );
}

function PostItCard({ video, isActive, onClick }: { video: typeof videos[0]; isActive: boolean; onClick: () => void }) {
  return (
    <motion.div
      onClick={onClick}
      animate={{ rotate: isActive ? 0 : video.angle, scale: 1 }}
      whileHover={{ scale: 1.06, rotate: 0, zIndex: 30 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      style={{
        position: "relative",
        background: video.color,
        padding: "18px 14px 14px",
        boxShadow: isActive
          ? `4px 6px 20px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15)`
          : `3px 4px 10px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.1)`,
        cursor: "pointer",
        minHeight: 120,
        zIndex: isActive ? 20 : "auto",
      }}
    >
      <Pin color={video.pinColor} />

      {/* Post-it fold shadow */}
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: 0, height: 0,
        borderStyle: "solid",
        borderWidth: "0 0 18px 18px",
        borderColor: `transparent transparent rgba(0,0,0,0.12) transparent`,
        zIndex: 2,
      }} />

      {/* Badge */}
      <div style={{
        fontFamily: "var(--font-brand)", fontSize: 10, letterSpacing: "0.2em",
        color: `${INK}88`, marginBottom: 6,
      }}>{video.badge}</div>

      {/* Title */}
      <h3 style={{
        fontFamily: "var(--font-caveat)", fontSize: 15, fontWeight: 700,
        color: INK, lineHeight: 1.4, margin: "0 0 8px",
      }}>{video.title}</h3>

      {/* Meta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <span style={{ fontFamily: "var(--font-patrick)", fontSize: 10, color: `${INK}77` }}>{video.time}</span>
        <span style={{ fontFamily: "var(--font-patrick)", fontSize: 10, color: `${INK}77` }}>{video.views}</span>
      </div>

      {/* Active indicator */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: "absolute", top: -4, right: -4,
            width: 16, height: 16, borderRadius: "50%",
            background: PIN_RED, border: "2px solid white",
            zIndex: 11,
          }}
        />
      )}
    </motion.div>
  );
}

function MainVideoArea({ video }: { video: typeof videos[0] }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={video.id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        style={{ position: "relative" }}
      >
        <TapeStrip angle={-2} width={80} top={-10} left="20%" />
        <TapeStrip angle={3} width={70} top={-8} left="75%" />
        <div style={{
          background: "rgba(255,255,255,0.9)",
          padding: "12px 12px 16px",
          boxShadow: "4px 6px 20px rgba(0,0,0,0.25)",
        }}>
          {/* Thumbnail */}
          <div style={{
            aspectRatio: "16/9",
            background: `linear-gradient(135deg, ${video.color}44 0%, ${video.color}22 100%)`,
            position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
            overflow: "hidden",
          }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }}>
              <line x1="0" y1="0" x2="100%" y2="100%" stroke={INK} strokeWidth="1"/>
              <line x1="100%" y1="0" x2="0" y2="100%" stroke={INK} strokeWidth="1"/>
            </svg>
            <motion.div
              whileHover={{ scale: 1.1 }}
              style={{
                width: 60, height: 60, borderRadius: "50%",
                background: "rgba(255,255,255,0.9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                cursor: "pointer", zIndex: 1,
              }}
            >
              <span style={{ fontSize: 22, marginLeft: 4 }}>▶</span>
            </motion.div>
            <div style={{
              position: "absolute", bottom: 8, right: 10,
              background: "rgba(0,0,0,0.65)", color: "#fff",
              fontFamily: "var(--font-patrick)", fontSize: 11,
              padding: "2px 7px", borderRadius: 2,
            }}>{video.time}</div>
            <div style={{
              position: "absolute", top: 8, left: 10,
              background: video.color, color: INK,
              fontFamily: "var(--font-brand)", fontSize: 10, letterSpacing: "0.15em",
              padding: "2px 7px",
            }}>{video.badge}</div>
          </div>
          <h2 style={{
            fontFamily: "var(--font-caveat)", fontSize: 20, fontWeight: 700,
            color: INK, lineHeight: 1.3, margin: "0 0 8px",
          }}>{video.title}</h2>
          <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: `${INK}77`, marginBottom: 12 }}>
            {video.views} wyświetleń
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["👍 Polub", "👎", "↗ Udostępnij", "⋯"].map(btn => (
              <motion.button
                key={btn}
                whileHover={{ scale: 1.04 }}
                style={{
                  fontFamily: "var(--font-caveat)", fontSize: 13,
                  padding: "6px 12px",
                  background: "transparent",
                  border: `1.5px solid ${INK}33`,
                  color: INK, cursor: "pointer",
                  borderRadius: 3,
                }}
              >{btn}</motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Layout10CorkBoard() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: CORK,
      backgroundImage: `
        radial-gradient(ellipse 2px 3px at 4px 6px, ${CORK_DARK}50 0%, transparent 100%),
        radial-gradient(ellipse 3px 2px at 14px 10px, rgba(160,136,88,0.3) 0%, transparent 100%),
        radial-gradient(ellipse 2px 4px at 24px 2px, ${CORK_DARK}40 0%, transparent 100%),
        radial-gradient(ellipse 4px 2px at 30px 18px, rgba(180,148,96,0.35) 0%, transparent 100%)
      `,
      backgroundSize: "32px 22px",
      fontFamily: "var(--font-caveat)",
      color: INK,
    }}>
      {/* HEADER STRIP */}
      <div style={{
        background: "rgba(255,255,255,0.92)",
        padding: "14px 24px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontFamily: "var(--font-brand)", fontSize: 38, letterSpacing: "0.04em", color: INK, lineHeight: 1 }}>POLUTEK</div>
          <nav style={{ display: "flex", gap: 6 }}>
            {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
              <motion.div
                key={item}
                whileHover={{ y: -2 }}
                style={{
                  fontFamily: "var(--font-caveat)", fontSize: 15, fontWeight: i === 0 ? 700 : 400,
                  color: INK, cursor: "pointer", padding: "5px 12px",
                  background: i === 0 ? INK : "transparent",
                  color2: i === 0 ? "white" : INK,
                  ...(i === 0 ? { color: "white", borderRadius: 4 } : {}),
                } as React.CSSProperties}
              >{item}</motion.div>
            ))}
          </nav>
          <motion.div
            whileHover={{ scale: 1.04 }}
            style={{
              fontFamily: "var(--font-caveat)", fontSize: 15, fontWeight: 700,
              background: POST_PINK, color: INK,
              padding: "7px 18px",
              boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
              cursor: "pointer",
              borderRadius: 3,
            }}
          >❤️ Wspieram</motion.div>
        </div>
      </div>

      {/* MAIN BOARD */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: 40 }}>

          {/* LEFT: MAIN VIDEO */}
          <div>
            {/* Label */}
            <div style={{
              fontFamily: "var(--font-brand)", fontSize: 13, letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.7)", marginBottom: 24, transform: "rotate(-1deg)",
            }}>TERAZ OGLĄDASZ</div>
            <MainVideoArea video={active} />

            {/* Creator post-it */}
            <motion.div
              whileHover={{ scale: 1.02, rotate: 0 }}
              style={{
                background: POST_YELLOW,
                padding: "14px 16px",
                marginTop: 24,
                transform: "rotate(1.2deg)",
                boxShadow: "3px 4px 12px rgba(0,0,0,0.2)",
                position: "relative",
              }}
            >
              <Pin color={PIN_BLUE} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: `linear-gradient(135deg, #f59e0b, #d97706)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-brand)", fontSize: 20, color: "white", flexShrink: 0,
                }}>P</div>
                <div>
                  <div style={{ fontFamily: "var(--font-caveat)", fontSize: 16, fontWeight: 700 }}>Paweł Polutek</div>
                  <div style={{ fontFamily: "var(--font-patrick)", fontSize: 10, color: `${INK}77` }}>4 823 subskrybentów</div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                style={{
                  marginTop: 10, width: "100%", padding: "8px",
                  fontFamily: "var(--font-caveat)", fontSize: 14, fontWeight: 700,
                  background: INK, color: "white",
                  border: "none", cursor: "pointer", borderRadius: 3,
                }}
              >🔔 Subskrybuj</motion.button>
            </motion.div>
          </div>

          {/* RIGHT: POST-IT GRID */}
          <div>
            <div style={{
              fontFamily: "var(--font-brand)", fontSize: 13, letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.7)", marginBottom: 24, transform: "rotate(0.5deg)",
            }}>WSZYSTKIE ODCINKI</div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 28,
              paddingTop: 16,
            }}>
              {videos.map(v => (
                <PostItCard
                  key={v.id}
                  video={v}
                  isActive={v.id === activeId}
                  onClick={() => setActiveId(v.id)}
                />
              ))}

              {/* Patron post-it */}
              <motion.div
                whileHover={{ scale: 1.05, rotate: 0 }}
                style={{
                  position: "relative",
                  background: POST_PURPLE,
                  padding: "18px 14px 14px",
                  transform: "rotate(-1.5deg)",
                  boxShadow: "3px 4px 12px rgba(0,0,0,0.2)",
                  cursor: "pointer",
                  minHeight: 120,
                  border: "2px dashed rgba(0,0,0,0.15)",
                }}
              >
                <Pin color="#7c3aed" />
                <div style={{ fontFamily: "var(--font-brand)", fontSize: 10, letterSpacing: "0.2em", color: `${INK}77`, marginBottom: 6 }}>
                  PATRONAT
                </div>
                <h3 style={{ fontFamily: "var(--font-caveat)", fontSize: 15, fontWeight: 700, color: INK, margin: "0 0 8px" }}>
                  🎁 Zostań Patronem
                </h3>
                <p style={{ fontFamily: "var(--font-caveat)", fontSize: 12, color: `${INK}88`, margin: 0, lineHeight: 1.5 }}>
                  Jednorazowe wsparcie = stały dostęp do wszystkich bonusów!
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ textAlign: "center", padding: "20px 0 32px" }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-caveat)", fontSize: 15, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
          ← wszystkie layouty
        </Link>
      </div>
    </main>
  );
}
