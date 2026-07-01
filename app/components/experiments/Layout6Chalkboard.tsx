"use client";

/**
 * Layout 6 — "Tablica Kredowa"
 *
 * Techniki:
 * - SVG feTurbulence + feDisplacementMap dla tekstury kredowej (chalk texture)
 * - SVG filter "roughen" na tekście — litery drżą jak napisane kredą
 * - CSS text-shadow z białą poświatą dla efektu świecenia kredy
 * - Własnoręczne SVG dekoracje: gwiazdy, strzałki, linie kredowe
 * - perfect-freehand dla organicznych kształtów w tle
 * - Kolory: ciemna zieleń tablicy + biała kreda + żółta kreda
 * - Fonts: Caveat (kredowe pismo) + Patrick Hand
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStroke } from "perfect-freehand";
import Link from "next/link";

const BOARD = "#1a3528";
const BOARD2 = "#172d22";
const CHALK = "#f0ede4";
const CHALK_YELLOW = "#f5e642";
const CHALK_PINK = "#f5a0c0";
const CHALK_BLUE = "#88d0e0";
const CHALK_DIM = "rgba(240,237,228,0.45)";

const videos = [
  { id: "1", title: "Jak to działa #12",    time: "18:42", views: "12 tys.", stars: 5 },
  { id: "2", title: "Patroni pytają Q&A",   time: "11:08", views: "8 tys.",  stars: 4 },
  { id: "3", title: "Notatnik Polutka #7",  time: "7:31",  views: "5 tys.",  stars: 4 },
  { id: "4", title: "Manifest twórcy",      time: "22:15", views: "21 tys.", stars: 5 },
  { id: "5", title: "Za kulisami odcinka",  time: "9:44",  views: "6 tys.",  stars: 3 },
];

function getSvgPathFromStroke(stroke: number[][]) {
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

function ChalkBlob({ points, color, opacity = 0.07 }: { points: [number, number][]; color: string; opacity?: number }) {
  const stroke = getStroke(points, { size: 60, thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
  const path = getSvgPathFromStroke(stroke);
  return <path d={path} fill={color} opacity={opacity} />;
}

function ChalkStar({ x, y, size = 16, color = CHALK_YELLOW }: { x: number; y: number; size?: number; color?: string }) {
  const points = Array.from({ length: 5 }).map((_, i) => {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    return `${x + Math.cos(angle) * size},${y + Math.sin(angle) * size}`;
  }).join(" ");
  return <polygon points={points} fill={color} opacity={0.8} />;
}

function ChalkDivider({ color = CHALK_DIM }: { color?: string }) {
  return (
    <svg width="100%" height="12" style={{ display: "block", margin: "8px 0" }}>
      <line x1="0" y1="6" x2="100%" y2="6"
        stroke={color} strokeWidth="2"
        strokeDasharray="14 6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChalkText({ children, size = 16, color = CHALK, angle = 0, font = "var(--font-caveat)", weight = 400 }: {
  children: React.ReactNode; size?: number; color?: string; angle?: number; font?: string; weight?: number;
}) {
  return (
    <div style={{
      fontFamily: font, fontSize: size, color, fontWeight: weight,
      transform: angle ? `rotate(${angle}deg)` : undefined,
      textShadow: `0 0 8px ${color}55, 0 0 20px ${color}22`,
      display: "inline",
    }}>
      {children}
    </div>
  );
}

function ChalkyButton({ children, color = CHALK, filled = false, onClick }: { children: React.ReactNode; color?: string; filled?: boolean; onClick?: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        background: filled ? color : "transparent",
        color: filled ? BOARD : color,
        border: `2px solid ${color}`,
        borderRadius: "6px",
        fontFamily: "var(--font-caveat)", fontSize: 16, fontWeight: 700,
        padding: "8px 18px",
        cursor: "pointer",
        textShadow: filled ? "none" : `0 0 8px ${color}66`,
        boxShadow: filled ? `0 0 12px ${color}44, inset 0 0 8px rgba(0,0,0,0.1)` : "none",
        transition: "all 0.2s",
      }}
    >{children}</motion.button>
  );
}

function VideoRow({ video, isActive, onSelect, delay = 0 }: {
  video: typeof videos[0]; isActive: boolean; onSelect: () => void; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onSelect}
      whileHover={{ x: 4 }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 0", cursor: "pointer",
        borderBottom: `1px dashed ${CHALK_DIM}`,
        opacity: isActive ? 1 : 0.7,
      }}
    >
      <span style={{ fontFamily: "var(--font-caveat)", fontSize: 13, color: CHALK_YELLOW, minWidth: 20 }}>
        {isActive ? "▶" : "·"}
      </span>
      <span style={{
        fontFamily: "var(--font-caveat)", fontSize: 15,
        color: isActive ? CHALK : CHALK_DIM,
        flex: 1, lineHeight: 1.3,
        textDecoration: isActive ? "underline" : "none",
        textDecorationColor: CHALK_YELLOW,
        textDecorationStyle: isActive ? "wavy" : undefined,
      }}>{video.title}</span>
      <span style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: CHALK_DIM, flexShrink: 0 }}>{video.time}</span>
      <div style={{ display: "flex", gap: 1 }}>
        {Array.from({ length: video.stars }).map((_, i) => (
          <span key={i} style={{ fontSize: 8, color: CHALK_YELLOW }}>★</span>
        ))}
        {Array.from({ length: 5 - video.stars }).map((_, i) => (
          <span key={i} style={{ fontSize: 8, color: CHALK_DIM }}>★</span>
        ))}
      </div>
    </motion.div>
  );
}

export default function Layout6Chalkboard() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: BOARD,
      backgroundImage: `
        radial-gradient(ellipse at 20% 30%, ${BOARD2} 0%, transparent 55%),
        radial-gradient(ellipse at 80% 70%, rgba(10,30,18,0.6) 0%, transparent 50%)
      `,
      position: "relative",
      overflow: "hidden",
      fontFamily: "var(--font-caveat)",
      color: CHALK,
    }}>

      {/* CHALK TEXTURE SVG FILTER */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="chalk-texture">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend" />
            <feComponentTransfer in="blend">
              <feFuncR type="linear" slope="1.1" intercept="0.02" />
              <feFuncG type="linear" slope="1.1" intercept="0.02" />
              <feFuncB type="linear" slope="1.1" intercept="0.02" />
            </feComponentTransfer>
          </filter>
          <filter id="chalk-text" x="-5%" y="-5%" width="110%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
      </svg>

      {/* BACKGROUND CHALK BLOBS */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <ChalkBlob points={[[100, 100], [200, 80], [300, 120], [250, 200], [150, 220]]} color={CHALK} opacity={0.04} />
        <ChalkBlob points={[[500, 300], [600, 280], [680, 340], [640, 420], [520, 410]]} color={CHALK_YELLOW} opacity={0.03} />
        <ChalkBlob points={[[800, 100], [880, 90], [920, 160], [870, 220], [790, 200]]} color={CHALK_PINK} opacity={0.04} />
        <ChalkStar x={60} y={80} size={10} color={CHALK_YELLOW} />
        <ChalkStar x={1100} y={200} size={8} color={CHALK_PINK} />
        <ChalkStar x={400} y={500} size={6} color={CHALK_BLUE} />
      </svg>

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px",
        filter: "url(#chalk-texture)",
      }}>

        {/* HEADER */}
        <header style={{ padding: "24px 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ filter: "url(#chalk-text)" }}>
                <ChalkText size={52} font="var(--font-caveat)" weight={700}>Polutek</ChalkText>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <ChalkDivider color={CHALK_YELLOW} />
                <span style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: CHALK_YELLOW, whiteSpace: "nowrap" }}>
                  kanał wideo
                </span>
              </div>
            </div>
            <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
                <ChalkyButton key={item} color={i === 0 ? CHALK_YELLOW : CHALK} filled={i === 0}>{item}</ChalkyButton>
              ))}
            </nav>
            <ChalkyButton color={CHALK_PINK} filled>❤️ Wspieram</ChalkyButton>
          </div>
          <ChalkDivider color={CHALK} />
        </header>

        {/* MAIN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 32, marginTop: 12 }}>

          {/* LEFT: FEATURE VIDEO */}
          <div>
            {/* Label */}
            <div style={{ marginBottom: 10 }}>
              <ChalkText size={11} color={CHALK_YELLOW} font="var(--font-patrick)">
                ✦ TERAZ NA TABLICY ✦
              </ChalkText>
            </div>

            {/* Video placeholder */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: "relative", aspectRatio: "16/9",
                  border: `2px solid ${CHALK_DIM}`,
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 18,
                  boxShadow: `0 0 24px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.3)`,
                }}
              >
                <div style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(135deg, ${BOARD2} 0%, #0d2018 100%)`,
                }} />
                {/* Chalk drawing of video */}
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 640 360">
                  {/* Simple chalk-style play icon */}
                  <circle cx="320" cy="180" r="50" fill="none" stroke={CHALK} strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
                  <polygon points="305,158 305,202 345,180" fill={CHALK} opacity="0.85" />
                  {/* Chalk scribble decorations */}
                  <path d="M20 340 Q 80 320 140 338 Q 200 352 260 336" fill="none" stroke={CHALK_DIM} strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M380 340 Q 440 325 500 340 Q 560 352 620 336" fill="none" stroke={CHALK_DIM} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div style={{
                  position: "absolute", bottom: 12, right: 14,
                  background: `rgba(0,0,0,0.6)`, color: CHALK,
                  fontFamily: "var(--font-caveat)", fontSize: 14,
                  padding: "3px 8px", borderRadius: 2,
                }}>{active.time}</div>
              </motion.div>
            </AnimatePresence>

            {/* Title */}
            <div style={{ filter: "url(#chalk-text)", marginBottom: 10 }}>
              <h1 style={{
                fontFamily: "var(--font-caveat)", fontSize: 32, fontWeight: 700,
                color: CHALK, lineHeight: 1.2, margin: 0,
                textShadow: `0 0 12px ${CHALK}44`,
              }}>
                {active.title}
              </h1>
            </div>
            <ChalkDivider color={CHALK_YELLOW} />

            {/* Meta info */}
            <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <ChalkText size={13} color={CHALK_DIM} font="var(--font-patrick)">{active.views} wyświetleń</ChalkText>
              <ChalkText size={13} color={CHALK_DIM} font="var(--font-patrick)">· 3 dni temu</ChalkText>
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: active.stars }).map((_, i) => (
                  <span key={i} style={{ fontSize: 14, color: CHALK_YELLOW, textShadow: `0 0 6px ${CHALK_YELLOW}` }}>★</span>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{
              marginTop: 14, padding: "14px 16px",
              border: `1.5px solid ${CHALK_DIM}`,
              borderRadius: 4,
              background: "rgba(255,255,255,0.04)",
              marginBottom: 18,
            }}>
              <p style={{
                fontFamily: "var(--font-caveat)", fontSize: 16, lineHeight: 1.7,
                color: CHALK, margin: 0, opacity: 0.9,
                textShadow: `0 0 6px ${CHALK}22`,
              }}>
                Przez kilka tygodni zbierałem ciekawe i absurdalne przykłady. Ten materiał to owoc tej pracy — rozmowy, dokumenty i sporo śmiechu.
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ChalkyButton color={CHALK_YELLOW}>👍 1847</ChalkyButton>
              <ChalkyButton>👎 23</ChalkyButton>
              <ChalkyButton color={CHALK_BLUE}>↗ Udostępnij</ChalkyButton>
              <ChalkyButton>⋯</ChalkyButton>
            </div>

            {/* Creator row */}
            <div style={{
              marginTop: 18, paddingTop: 16,
              borderTop: `1px dashed ${CHALK_DIM}`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                border: `2px solid ${CHALK}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-caveat)", fontSize: 22, color: CHALK,
                flexShrink: 0,
                textShadow: `0 0 8px ${CHALK}55`,
              }}>P</div>
              <div>
                <div style={{ fontFamily: "var(--font-caveat)", fontSize: 17, fontWeight: 700, color: CHALK }}>
                  Paweł Polutek
                </div>
                <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: CHALK_DIM }}>
                  4 823 subskrybentów
                </div>
              </div>
              <ChalkyButton color={CHALK_YELLOW} filled>🔔 Subskrybuj</ChalkyButton>
            </div>
          </div>

          {/* RIGHT: SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Patron box */}
            <div style={{
              padding: "16px",
              border: `2px solid ${CHALK_YELLOW}`,
              borderRadius: 4,
              background: "rgba(245,230,66,0.06)",
              boxShadow: `0 0 16px ${CHALK_YELLOW}22`,
            }}>
              <div style={{
                fontFamily: "var(--font-caveat)", fontSize: 18, fontWeight: 700,
                color: CHALK_YELLOW, marginBottom: 8,
                textShadow: `0 0 10px ${CHALK_YELLOW}55`,
              }}>
                ★ Zostań Patronem
              </div>
              <p style={{
                fontFamily: "var(--font-caveat)", fontSize: 14, lineHeight: 1.6,
                color: CHALK_DIM, margin: "0 0 14px",
              }}>
                Jednorazowe wsparcie = dożywotni dostęp do wszystkich bonusów!
              </p>
              <ChalkyButton color={CHALK_YELLOW} filled>Wejdź teraz →</ChalkyButton>
            </div>

            {/* Video list */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <ChalkText size={12} color={CHALK_YELLOW} font="var(--font-patrick)">LISTA ODCINKÓW:</ChalkText>
              </div>
              {videos.map((v, i) => (
                <VideoRow
                  key={v.id}
                  video={v}
                  isActive={v.id === activeId}
                  onSelect={() => setActiveId(v.id)}
                  delay={i * 0.06}
                />
              ))}
            </div>

            {/* Stats box */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
              {[
                { label: "Odcinków", value: "47", color: CHALK_BLUE },
                { label: "Patronów", value: "1.8k", color: CHALK_YELLOW },
                { label: "Wyświetleń", value: "284k", color: CHALK_PINK },
                { label: "Komentarzy", value: "3.2k", color: CHALK },
              ].map(stat => (
                <div key={stat.label} style={{
                  padding: "10px 12px",
                  border: `1px solid ${stat.color}44`,
                  borderRadius: 4,
                  textAlign: "center",
                  background: `${stat.color}08`,
                }}>
                  <div style={{
                    fontFamily: "var(--font-caveat)", fontSize: 26, fontWeight: 700,
                    color: stat.color,
                    textShadow: `0 0 10px ${stat.color}55`,
                  }}>{stat.value}</div>
                  <div style={{ fontFamily: "var(--font-patrick)", fontSize: 10, color: CHALK_DIM }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "16px 0 24px" }}>
        <ChalkDivider />
        <Link href="/pokaz" style={{ fontFamily: "var(--font-caveat)", fontSize: 15, color: CHALK_DIM, textDecoration: "none" }}>
          ← wróć do wszystkich layoutów
        </Link>
      </div>
    </main>
  );
}
