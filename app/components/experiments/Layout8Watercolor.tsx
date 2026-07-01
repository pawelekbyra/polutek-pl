"use client";

/**
 * Layout 8 — "Tusz i Akwarela"
 *
 * Techniki:
 * - SVG feTurbulence + feDisplacementMap dla efektu krawędzi akwarelowej (rozmyte brzegi)
 * - SVG feGaussianBlur + feComposite dla plam akwarelowych
 * - perfect-freehand dla organicznych kształtów tuszowych
 * - CSS mix-blend-mode: multiply dla nakładania akwarel
 * - Każdy element ma "bleed" (rozlanie) jak prawdziwa akwarela
 * - Fonts: Caveat (główny) + Kalam (akcenty)
 * - Paleta: aquamarine, coral, lavender, warm cream
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStroke } from "perfect-freehand";
import Link from "next/link";

const PAPER = "#faf6ee";
const INK = "#1a1209";
const AQUA = "#6ecdc8";
const CORAL = "#f08070";
const LAVEND = "#b8a0d8";
const GOLD = "#e8c860";
const SAGE = "#88c0a0";

const videos = [
  { id: "1", title: "Jak to działa #12",    time: "18:42", color: AQUA,   views: "12 tys." },
  { id: "2", title: "Patroni pytają Q&A",   time: "11:08", color: CORAL,  views: "8 tys."  },
  { id: "3", title: "Notatnik Polutka #7",  time: "7:31",  color: LAVEND, views: "5 tys."  },
  { id: "4", title: "Manifest twórcy",      time: "22:15", color: GOLD,   views: "21 tys." },
  { id: "5", title: "Za kulisami",          time: "9:44",  color: SAGE,   views: "6 tys."  },
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

function WatercolorBlob({ cx, cy, rx, ry, color, opacity = 0.18, seed = 1 }: {
  cx: number; cy: number; rx: number; ry: number; color: string; opacity?: number; seed?: number;
}) {
  const pts = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const r1 = rx * (0.7 + 0.35 * Math.sin(seed * 7 + i * 2.3));
    const r2 = ry * (0.7 + 0.35 * Math.sin(seed * 11 + i * 1.7));
    return [cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r2] as [number, number];
  });
  const stroke = getStroke(pts, { size: 32, thinning: -0.5, smoothing: 0.8, streamline: 0.7 });
  const path = getSvgPathFromStroke(stroke);
  return (
    <path
      d={path}
      fill={color}
      opacity={opacity}
      style={{ mixBlendMode: "multiply" }}
    />
  );
}

function InkLine({ x1 = 0, y1 = 10, x2 = 200, y2 = 10, color = INK, opacity = 0.6 }: {
  x1?: number; y1?: number; x2?: number; y2?: number; color?: string; opacity?: number;
}) {
  const pts: [number, number][] = [
    [x1, y1 + 1],
    [x1 + (x2 - x1) * 0.3, y1 + 0.5],
    [x1 + (x2 - x1) * 0.6, y1 - 0.5],
    [x2, y2 + 0.8],
  ];
  const stroke = getStroke(pts, { size: 1.2, thinning: 0.6, smoothing: 0.5, streamline: 0.4 });
  const path = getSvgPathFromStroke(stroke);
  return <path d={path} fill={color} opacity={opacity} />;
}

function WatercolorCard({ video, isActive, onClick, delay = 0 }: {
  video: typeof videos[0]; isActive: boolean; onClick: () => void; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      whileHover={{ x: -3, scale: 1.02 }}
      style={{
        cursor: "pointer", position: "relative",
        padding: "10px 12px",
        marginBottom: 4,
      }}
    >
      {/* Watercolor bg on active */}
      {isActive && (
        <svg style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", overflow: "visible", pointerEvents: "none" }}
          viewBox="0 0 240 60">
          <WatercolorBlob cx={120} cy={30} rx={115} ry={30} color={video.color} opacity={0.22} seed={parseInt(video.id) * 7} />
        </svg>
      )}
      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: video.color,
          opacity: 0.9,
          flexShrink: 0,
          boxShadow: isActive ? `0 0 0 3px ${video.color}44` : "none",
        }} />
        <span style={{
          fontFamily: "var(--font-caveat)", fontSize: 15, color: INK,
          fontWeight: isActive ? 700 : 400,
          flex: 1, lineHeight: 1.3,
        }}>{video.title}</span>
        <span style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: `${INK}66`, flexShrink: 0 }}>{video.time}</span>
      </div>
    </motion.div>
  );
}

export default function Layout8Watercolor() {
  const [activeId, setActiveId] = useState("1");
  const active = videos.find(v => v.id === activeId) ?? videos[0];

  return (
    <main style={{
      minHeight: "100vh",
      background: PAPER,
      position: "relative",
      overflow: "hidden",
      fontFamily: "var(--font-caveat)",
      color: INK,
    }}>

      {/* SVG FILTERS */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="watercolor-edge" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="turbulence" baseFrequency="0.02 0.06" numOctaves="4" seed="3" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
            <feGaussianBlur in="displaced" stdDeviation="1.5" result="blurred"/>
            <feComposite in="blurred" in2="SourceGraphic" operator="over"/>
          </filter>
          <filter id="ink-blur" x="-5%" y="-5%" width="110%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="7"/>
            <feDisplacementMap in="SourceGraphic" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <filter id="paper-texture">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply"/>
          </filter>
        </defs>
      </svg>

      {/* BACKGROUND WATERCOLOR WASHES */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <WatercolorBlob cx={200} cy={180} rx={280} ry={200} color={AQUA} opacity={0.1} seed={3} />
        <WatercolorBlob cx={950} cy={150} rx={220} ry={160} color={CORAL} opacity={0.09} seed={7} />
        <WatercolorBlob cx={600} cy={600} rx={300} ry={220} color={LAVEND} opacity={0.08} seed={11} />
        <WatercolorBlob cx={100} cy={650} rx={180} ry={140} color={GOLD} opacity={0.07} seed={5} />
        <WatercolorBlob cx={1050} cy={500} rx={200} ry={180} color={SAGE} opacity={0.09} seed={9} />
      </svg>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* HEADER */}
        <header style={{ paddingTop: 28, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>

            <div>
              {/* Logo with watercolor splat behind */}
              <div style={{ position: "relative", display: "inline-block" }}>
                <svg style={{ position: "absolute", top: -20, left: -20, width: 200, height: 80, overflow: "visible", pointerEvents: "none" }}
                  viewBox="0 0 200 80">
                  <WatercolorBlob cx={100} cy={40} rx={100} ry={42} color={AQUA} opacity={0.28} seed={13} />
                </svg>
                <h1 style={{
                  position: "relative", fontFamily: "var(--font-caveat)", fontSize: 52, fontWeight: 700,
                  lineHeight: 1, margin: 0,
                  filter: "url(#ink-blur)",
                }}>Polutek</h1>
              </div>
              <div style={{ fontFamily: "var(--font-patrick)", fontSize: 12, color: `${INK}77`, marginTop: 2 }}>
                kanał wideo · tusz & akwarela
              </div>
            </div>

            <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
                <motion.div
                  key={item}
                  whileHover={{ y: -2 }}
                  style={{
                    position: "relative",
                    fontFamily: "var(--font-caveat)", fontSize: 16, fontWeight: i === 0 ? 700 : 400,
                    color: INK, cursor: "pointer", padding: "6px 2px",
                  }}
                >
                  {item}
                  {i === 0 && (
                    <svg style={{ position: "absolute", bottom: 0, left: -4, width: "calc(100% + 8px)", height: 10, overflow: "visible" }} viewBox="0 0 100 10">
                      <WatercolorBlob cx={50} cy={8} rx={55} ry={7} color={AQUA} opacity={0.6} seed={i + 1} />
                    </svg>
                  )}
                </motion.div>
              ))}
            </nav>

            <motion.div
              whileHover={{ scale: 1.04 }}
              style={{
                position: "relative",
                fontFamily: "var(--font-caveat)", fontSize: 16, fontWeight: 700,
                color: INK, cursor: "pointer", padding: "10px 20px",
              }}
            >
              <svg style={{ position: "absolute", inset: -6, width: "calc(100% + 12px)", height: "calc(100% + 12px)", overflow: "visible", pointerEvents: "none" }}
                viewBox="0 0 140 50">
                <WatercolorBlob cx={70} cy={25} rx={70} ry={28} color={CORAL} opacity={0.55} seed={17} />
              </svg>
              <span style={{ position: "relative", zIndex: 1 }}>❤️ Wspieram</span>
            </motion.div>
          </div>

          {/* Ink divider */}
          <svg width="100%" height="12" style={{ marginTop: 8, overflow: "visible" }} viewBox="0 0 1000 12">
            <InkLine x1={0} y1={6} x2={1000} y2={6} opacity={0.25} />
          </svg>
        </header>

        {/* MAIN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 36, marginTop: 16 }}>

          {/* LEFT: FEATURE VIDEO */}
          <div>
            {/* Video */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "relative", marginBottom: 22 }}
              >
                {/* Watercolor frame */}
                <svg style={{
                  position: "absolute", inset: -12,
                  width: "calc(100% + 24px)", height: "calc(100% + 24px)",
                  overflow: "visible", pointerEvents: "none",
                }} viewBox="0 0 680 420">
                  <WatercolorBlob cx={340} cy={210} rx={345} ry={215} color={active.color} opacity={0.2} seed={parseInt(active.id) * 3} />
                </svg>

                <div style={{
                  position: "relative",
                  aspectRatio: "16/9",
                  overflow: "hidden",
                  filter: "url(#watercolor-edge)",
                }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `linear-gradient(135deg, ${active.color}33 0%, ${active.color}11 100%)`,
                  }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      style={{
                        width: 72, height: 72, cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      <svg width="72" height="72" viewBox="0 0 72 72" style={{ overflow: "visible" }}>
                        <WatercolorBlob cx={36} cy={36} rx={38} ry={38} color={active.color} opacity={0.7} seed={42} />
                      </svg>
                      <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--font-najs)", fontSize: 26, color: PAPER,
                      }}>▶</div>
                    </motion.div>
                  </div>
                  <div style={{
                    position: "absolute", bottom: 10, right: 12,
                    fontFamily: "var(--font-caveat)", fontSize: 14, color: INK,
                    background: "rgba(250,246,238,0.85)",
                    padding: "2px 8px",
                  }}>{active.time}</div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Title */}
            <AnimatePresence mode="wait">
              <motion.div key={activeId + "-title"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h1 style={{
                  fontFamily: "var(--font-caveat)", fontSize: 30, fontWeight: 700,
                  color: INK, lineHeight: 1.25, margin: "0 0 10px",
                  filter: "url(#ink-blur)",
                }}>
                  {active.title}
                </h1>
              </motion.div>
            </AnimatePresence>

            {/* Watercolor underline */}
            <svg width="100%" height="14" style={{ marginBottom: 14 }} viewBox="0 0 600 14">
              <WatercolorBlob cx={300} cy={10} rx={305} ry={8} color={active.color} opacity={0.45} seed={6} />
            </svg>

            {/* Meta */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontFamily: "var(--font-patrick)", fontSize: 12, color: `${INK}88` }}>{active.views} wyświetleń · 3 dni temu</span>
            </div>

            {/* Description */}
            <div style={{ position: "relative", padding: "16px 18px", marginBottom: 20 }}>
              <svg style={{ position: "absolute", inset: -8, width: "calc(100% + 16px)", height: "calc(100% + 16px)", overflow: "visible", pointerEvents: "none" }}
                viewBox="0 0 600 100">
                <WatercolorBlob cx={300} cy={50} rx={305} ry={58} color={SAGE} opacity={0.14} seed={8} />
              </svg>
              <p style={{
                fontFamily: "var(--font-caveat)", fontSize: 17, lineHeight: 1.7,
                color: INK, margin: 0, position: "relative", zIndex: 1,
              }}>
                Przez kilka tygodni zbierałem przykłady absurdalnych przepisów. Ten materiał to owoc tej pracy — rozmowy, dokumenty i sporo śmiechu.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "👍 Polub (1847)", color: AQUA },
                { label: "👎 Nie lubię (23)", color: CORAL },
                { label: "↗ Udostępnij", color: LAVEND },
                { label: "⋯ Więcej", color: GOLD },
              ].map(btn => (
                <motion.div
                  key={btn.label}
                  whileHover={{ scale: 1.05 }}
                  style={{
                    position: "relative", cursor: "pointer",
                    fontFamily: "var(--font-caveat)", fontSize: 14, color: INK,
                    padding: "8px 14px",
                  }}
                >
                  <svg style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", overflow: "visible", pointerEvents: "none" }}
                    viewBox="0 0 100 40">
                    <WatercolorBlob cx={50} cy={20} rx={52} ry={22} color={btn.color} opacity={0.35} seed={btn.label.length} />
                  </svg>
                  <span style={{ position: "relative", zIndex: 1 }}>{btn.label}</span>
                </motion.div>
              ))}
            </div>

            {/* Creator */}
            <div style={{
              marginTop: 20, paddingTop: 16,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <svg style={{ overflow: "visible", flexShrink: 0, width: 48, height: 48 }} viewBox="0 0 48 48">
                <WatercolorBlob cx={24} cy={24} rx={25} ry={25} color={AQUA} opacity={0.5} seed={21} />
                <text x="24" y="30" textAnchor="middle" fontFamily="var(--font-caveat)" fontSize="20" fontWeight="700" fill={INK}>P</text>
              </svg>
              <div>
                <div style={{ fontFamily: "var(--font-caveat)", fontSize: 17, fontWeight: 700, filter: "url(#ink-blur)" }}>Paweł Polutek</div>
                <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: `${INK}77` }}>4 823 subskrybentów</div>
              </div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                style={{ marginLeft: "auto", position: "relative", cursor: "pointer", padding: "10px 18px" }}
              >
                <svg style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", overflow: "visible", pointerEvents: "none" }}
                  viewBox="0 0 130 50">
                  <WatercolorBlob cx={65} cy={25} rx={68} ry={28} color={GOLD} opacity={0.6} seed={33} />
                </svg>
                <span style={{ position: "relative", zIndex: 1, fontFamily: "var(--font-caveat)", fontSize: 15, fontWeight: 700, color: INK }}>
                  🔔 Subskrybuj
                </span>
              </motion.div>
            </div>
          </div>

          {/* RIGHT: SIDEBAR */}
          <div>
            {/* Patron card */}
            <div style={{ position: "relative", padding: "18px", marginBottom: 28 }}>
              <svg style={{ position: "absolute", inset: -8, width: "calc(100% + 16px)", height: "calc(100% + 16px)", overflow: "visible", pointerEvents: "none" }}
                viewBox="0 0 280 170">
                <WatercolorBlob cx={140} cy={85} rx={145} ry={90} color={LAVEND} opacity={0.25} seed={55} />
              </svg>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontFamily: "var(--font-caveat)", fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>
                  🎁 Zostań Patronem
                </div>
                <p style={{ fontFamily: "var(--font-caveat)", fontSize: 14, lineHeight: 1.6, color: `${INK}bb`, margin: "0 0 14px" }}>
                  Jednorazowe wsparcie → stały dostęp do bonusów na zawsze!
                </p>
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  style={{ position: "relative", cursor: "pointer", padding: "10px 16px", textAlign: "center" }}
                >
                  <svg style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", overflow: "visible", pointerEvents: "none" }}
                    viewBox="0 0 200 50">
                    <WatercolorBlob cx={100} cy={25} rx={105} ry={30} color={CORAL} opacity={0.7} seed={77} />
                  </svg>
                  <span style={{ position: "relative", zIndex: 1, fontFamily: "var(--font-caveat)", fontSize: 15, fontWeight: 700, color: PAPER }}>
                    Wesprzyj →
                  </span>
                </motion.div>
              </div>
            </div>

            {/* Section label */}
            <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: `${INK}66`, marginBottom: 12, letterSpacing: "0.15em" }}>
              LISTA ODCINKÓW
            </div>

            {/* Video list */}
            {videos.map((v, i) => (
              <WatercolorCard
                key={v.id}
                video={v}
                isActive={v.id === activeId}
                onClick={() => setActiveId(v.id)}
                delay={i * 0.07}
              />
            ))}
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "20px 0 32px" }}>
        <Link href="/pokaz" style={{ fontFamily: "var(--font-caveat)", fontSize: 15, color: `${INK}66`, textDecoration: "none" }}>
          ← wróć do wszystkich layoutów
        </Link>
      </div>
    </main>
  );
}
