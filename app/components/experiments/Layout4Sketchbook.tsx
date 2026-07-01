"use client";

/**
 * Layout 4 — "Sketchbook Koloru"
 *
 * Klimat: otwarty notatnik rozłożony na dwie strony.
 * Lewa strona = gracz wideo + opis.
 * Prawa strona = lista odcinków pisana ręcznie.
 * Spiralna bindownica w środku.
 * Caveat + Patrick Hand, pastelowe kolory.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const MINT   = "#a8e6cf";
const YELLOW = "#ffd93d";
const PINK   = "#ffb3c6";
const PEACH  = "#ffcba4";
const LAVEND = "#c3aed6";
const INK    = "#2d2417";
const PAPER  = "#fdf8ee";
const PAPER2 = "#f5f0e8";
const LINE   = "rgba(45,36,23,0.10)";

const videos = [
  { id: "1", title: "Jak to działa #12 — dziwne prawa",    time: "18:42", color: MINT,   views: "12 tys.", emoji: "⚖️", new: true  },
  { id: "2", title: "Patroni pytają — Q&A odcinek 5",       time: "11:08", color: YELLOW, views: "8 tys.",  emoji: "🎤", new: false },
  { id: "3", title: "Notatnik Polutka #7 — szkic tygodnia", time: "7:31",  color: PINK,   views: "5 tys.",  emoji: "📓", new: false },
  { id: "4", title: "Dlaczego to ważne — mój manifest",     time: "22:15", color: PEACH,  views: "21 tys.", emoji: "💡", new: false },
  { id: "5", title: "Za kulisami — jak nagrywam odcinki",   time: "9:44",  color: LAVEND, views: "6 tys.",  emoji: "🎬", new: false },
  { id: "6", title: "Absurdy w liczbach — infografika",     time: "5:12",  color: MINT,   views: "3 tys.",  emoji: "📊", new: false },
];

function Spiral() {
  const rings = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div style={{
      position: "absolute", left: "50%", top: 0, bottom: 0,
      transform: "translateX(-50%)",
      width: 28, zIndex: 10,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-evenly", padding: "20px 0",
      pointerEvents: "none",
    }}>
      {rings.map(i => (
        <div key={i} style={{
          width: 22, height: 22, borderRadius: "50%",
          border: "2.5px solid #c0a87a",
          background: "rgba(240,230,200,0.7)",
          flexShrink: 0,
          boxShadow: "1px 1px 3px rgba(0,0,0,0.15)",
        }} />
      ))}
    </div>
  );
}

function NotebookLines({ n = 18 }: { n?: number }) {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      display: "flex", flexDirection: "column", justifyContent: "flex-start",
      paddingTop: 68, paddingBottom: 20,
    }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{
          height: 1, background: LINE,
          marginBottom: 29, flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

function VideoRow({ video, index, isActive, onSelect }: {
  video: typeof videos[0];
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ x: 4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 0", cursor: "pointer",
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      {/* Color dot */}
      <div style={{
        width: 12, height: 12, borderRadius: "50%",
        background: video.color, flexShrink: 0,
        border: "1.5px solid rgba(0,0,0,0.15)",
        boxShadow: isActive ? `0 0 0 3px ${video.color}66` : "none",
        transition: "box-shadow 0.2s",
      }} />
      {/* Number */}
      <span style={{
        fontFamily: "var(--font-caveat)", fontSize: 14, color: "#a08060",
        minWidth: 18, textAlign: "right",
      }}>{index + 1}.</span>
      {/* Emoji */}
      <span style={{ fontSize: 15 }}>{video.emoji}</span>
      {/* Title */}
      <span style={{
        fontFamily: "var(--font-caveat)", fontSize: 15.5, lineHeight: 1.3,
        color: isActive ? INK : "#4a3a28",
        fontWeight: isActive ? 700 : 400,
        flex: 1,
      }}>{video.title}</span>
      {/* Time */}
      <span style={{
        fontFamily: "var(--font-patrick)", fontSize: 11, color: "#a08060",
        flexShrink: 0,
      }}>{video.time}</span>
      {video.new && (
        <span style={{
          fontFamily: "var(--font-patrick)", fontSize: 9, fontWeight: 700,
          background: "#ff6b6b", color: "#fff",
          padding: "1px 5px", borderRadius: 3, flexShrink: 0,
        }}>NOWY</span>
      )}
    </motion.div>
  );
}

function HandDrawnArrow() {
  return (
    <svg width="52" height="28" viewBox="0 0 52 28" fill="none" style={{ opacity: 0.45 }}>
      <path d="M2 14 Q12 6 36 14 Q42 16 48 11" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
      <path d="M42 7 L48 11 L43 16" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Sticker({ text, color, angle = 0, top = 0, right = 0 }: { text: string; color: string; angle?: number; top?: number; right?: number }) {
  return (
    <motion.div
      whileHover={{ scale: 1.1, rotate: 0 }}
      style={{
        position: "absolute", top, right,
        background: color, color: INK,
        fontFamily: "var(--font-caveat)", fontSize: 13, fontWeight: 700,
        padding: "4px 10px", borderRadius: 6,
        transform: `rotate(${angle}deg)`,
        boxShadow: "2px 3px 8px rgba(0,0,0,0.18)",
        cursor: "default", userSelect: "none",
        border: "1.5px solid rgba(0,0,0,0.12)",
        zIndex: 20,
      }}
    >{text}</motion.div>
  );
}

export default function Layout4Sketchbook() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: `
        radial-gradient(ellipse at 15% 25%, ${MINT}55 0%, transparent 45%),
        radial-gradient(ellipse at 85% 60%, ${YELLOW}44 0%, transparent 40%),
        radial-gradient(ellipse at 50% 90%, ${PINK}33 0%, transparent 45%),
        #f0ead6
      `,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: "28px 16px 60px",
      fontFamily: "var(--font-caveat)",
    }}>

      {/* TOP NAV */}
      <nav style={{
        width: "100%", maxWidth: 1100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{
          fontFamily: "var(--font-brand)", fontSize: 42, lineHeight: 1,
          color: INK, letterSpacing: "0.04em",
        }}>POLUTEK</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
            <motion.div
              key={item}
              whileHover={{ y: -2, scale: 1.05 }}
              style={{
                fontFamily: "var(--font-caveat)", fontSize: 16, fontWeight: 700,
                background: i === 0 ? INK : "rgba(255,255,255,0.6)",
                color: i === 0 ? PAPER : INK,
                padding: "6px 16px", borderRadius: 8,
                border: `2px solid ${INK}`,
                cursor: "pointer",
                boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
              }}
            >{item}</motion.div>
          ))}
        </div>
        <motion.div
          whileHover={{ scale: 1.05, rotate: 1 }}
          style={{
            fontFamily: "var(--font-caveat)", fontSize: 16, fontWeight: 700,
            background: "#ff6b6b", color: "#fff",
            padding: "8px 20px", borderRadius: 10,
            border: `2px solid ${INK}`,
            boxShadow: "3px 3px 0 rgba(0,0,0,0.2)",
            cursor: "pointer",
          }}
        >❤️ Wspieram</motion.div>
      </nav>

      {/* NOTEBOOK */}
      <div style={{
        width: "100%", maxWidth: 1100,
        background: PAPER,
        borderRadius: 12,
        boxShadow: "0 8px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1)",
        display: "grid",
        gridTemplateColumns: "1fr 28px 1fr",
        position: "relative",
        overflow: "hidden",
        minHeight: 600,
      }}>

        {/* LEFT PAGE */}
        <div style={{ position: "relative", padding: "32px 32px 32px 28px", background: PAPER }}>
          <NotebookLines n={20} />
          {/* Page label */}
          <div style={{
            position: "absolute", top: 14, left: 28,
            fontFamily: "var(--font-caveat)", fontSize: 12, color: "#c0a060",
            letterSpacing: "0.15em",
          }}>Strona główna</div>
          <Sticker text="🎬 nowy!" color={YELLOW} angle={-8} top={14} right={20} />

          {/* VIDEO PLAYER */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              style={{ position: "relative", marginTop: 14 }}
            >
              {/* Frame in active color */}
              <div style={{
                position: "absolute", inset: -4,
                borderRadius: 10,
                border: `3px solid ${active.color}`,
                opacity: 0.7,
                pointerEvents: "none",
              }} />
              <div style={{
                aspectRatio: "16/9",
                background: `linear-gradient(135deg, ${active.color}55 0%, ${active.color}22 100%)`,
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", position: "relative",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3) 0%, transparent 65%)`,
                }} />
                <motion.div
                  whileHover={{ scale: 1.12 }}
                  style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "rgba(255,255,255,0.92)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    cursor: "pointer", zIndex: 2,
                  }}
                >
                  <span style={{ fontSize: 24, marginLeft: 5 }}>▶</span>
                </motion.div>
                <div style={{
                  position: "absolute", bottom: 8, left: 10,
                  fontFamily: "var(--font-caveat)", fontSize: 22,
                  color: INK, opacity: 0.85,
                }}>{active.emoji}</div>
                <div style={{
                  position: "absolute", bottom: 8, right: 10,
                  background: "rgba(0,0,0,0.6)", color: "#fff",
                  fontFamily: "var(--font-patrick)", fontSize: 11,
                  padding: "2px 7px", borderRadius: 4,
                }}>{active.time}</div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Title & info */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id + "-info"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <h1 style={{
                fontFamily: "var(--font-caveat)", fontSize: 24, fontWeight: 700,
                color: INK, margin: "16px 0 8px", lineHeight: 1.3,
              }}>{active.title}</h1>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{
                  background: active.color, color: INK,
                  fontFamily: "var(--font-caveat)", fontSize: 12, fontWeight: 700,
                  padding: "2px 9px", borderRadius: 5, border: "1.5px solid rgba(0,0,0,0.1)",
                }}>{active.views} wyświetleń</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <HandDrawnArrow />
                  <span style={{ fontFamily: "var(--font-caveat)", fontSize: 12, color: "#a08060" }}>
                    wybierz z listy →
                  </span>
                </div>
              </div>

              {/* Creator */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 12, borderTop: `1.5px dashed ${LINE}` }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${MINT}, ${YELLOW})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-brand)", fontSize: 18, color: INK, flexShrink: 0,
                }}>P</div>
                <div>
                  <div style={{ fontFamily: "var(--font-caveat)", fontSize: 16, fontWeight: 700, color: INK }}>Polutek</div>
                  <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: "#a08060" }}>4 823 patronów</div>
                </div>
                <motion.div
                  whileHover={{ scale: 1.05, rotate: -1 }}
                  style={{
                    marginLeft: "auto",
                    background: YELLOW, color: INK,
                    fontFamily: "var(--font-caveat)", fontSize: 14, fontWeight: 700,
                    padding: "6px 14px", borderRadius: 8,
                    border: `2px solid ${INK}`,
                    boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
                    cursor: "pointer",
                  }}
                >+ Subskrybuj</motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* SPIRAL BINDING */}
        <Spiral />

        {/* RIGHT PAGE */}
        <div style={{ position: "relative", padding: "32px 28px 32px 32px", background: PAPER2 }}>
          <NotebookLines n={20} />
          <div style={{
            position: "absolute", top: 14, right: 28,
            fontFamily: "var(--font-caveat)", fontSize: 12, color: "#c0a060",
            letterSpacing: "0.15em",
          }}>Lista odcinków</div>

          {/* Corner stickers */}
          <Sticker text="⭐ top!" color={PINK} angle={6} top={10} right={80} />

          <div style={{ marginTop: 18, position: "relative", zIndex: 1 }}>
            {/* Header */}
            <div style={{
              fontFamily: "var(--font-caveat)", fontSize: 18, fontWeight: 700,
              color: INK, marginBottom: 14, paddingBottom: 6,
              borderBottom: `2px solid ${INK}22`,
            }}>
              Wszystkie odcinki ({videos.length})
            </div>
            {/* Video list */}
            {videos.map((v, i) => (
              <VideoRow
                key={v.id}
                video={v}
                index={i}
                isActive={v.id === activeId}
                onSelect={() => setActiveId(v.id)}
              />
            ))}

            {/* Doodle note at bottom */}
            <div style={{
              marginTop: 20,
              fontFamily: "var(--font-caveat)", fontSize: 14, color: "#a08060",
              transform: "rotate(-1deg)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>więcej odcinków wkrótce</span>
              <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
                <path d="M2 8 Q8 3 16 8 Q19 10 22 6" stroke="#a08060" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M18 3 L22 6 L18 9" stroke="#a08060" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* PATRON BOX — sticky note style */}
          <motion.div
            whileHover={{ scale: 1.02, rotate: 0 }}
            style={{
              position: "absolute", bottom: 24, right: 20,
              background: LAVEND, color: INK,
              padding: "12px 14px", borderRadius: 4,
              transform: "rotate(-2.5deg)",
              boxShadow: "3px 4px 12px rgba(0,0,0,0.18)",
              maxWidth: 160,
              border: `1.5px solid rgba(0,0,0,0.1)`,
              zIndex: 20,
            }}
          >
            <div style={{ fontFamily: "var(--font-caveat)", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              🎁 Zostań Patronem
            </div>
            <div style={{ fontFamily: "var(--font-caveat)", fontSize: 11, lineHeight: 1.5, opacity: 0.8 }}>
              Jednorazowe wsparcie → stały dostęp do bonusów!
            </div>
          </motion.div>
        </div>
      </div>

      {/* BACK LINK */}
      <div style={{ marginTop: 32 }}>
        <Link href="/pokaz" style={{
          fontFamily: "var(--font-caveat)", fontSize: 16,
          color: INK, opacity: 0.65,
          textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
        }}>← wróć do wszystkich layoutów</Link>
      </div>
    </main>
  );
}
