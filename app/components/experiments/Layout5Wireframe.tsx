"use client";

/**
 * Layout 5 — "Szkic Żywy"
 *
 * Techniki:
 * - roughjs dla KAŻDEGO elementu UI: przyciski, ramki, separatory, thumbnail
 * - rough-notation: highlight, underline, box, circle na hover
 * - SVG hachure fill dla bloków kolorowych
 * - framer-motion scroll reveal
 * - Font: Kalam (--font-najs) jako odręczny tytuł, Patrick Hand jako treść
 *
 * Klimat: dokładnie jak wireframe ze szkicu — cienki tusz, cream paper.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RoughSVG } from "roughjs/bin/svg";
import Link from "next/link";

const INK = "#1a1209";
const PAPER = "#f5f0e3";
const PAPER2 = "#ede8d8";
const GOLD = "#c8a840";
const BLUE = "#2563eb";

interface RoughBoxProps {
  width: number;
  height: number;
  roughness?: number;
  fill?: string;
  fillStyle?: "hachure" | "solid" | "zigzag" | "cross-hatch" | "dots" | "dashed" | "zigzag-line";
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  className?: string;
}

function useRoughBox({
  width, height, roughness = 1.5, fill = "none",
  fillStyle = "hachure", stroke = INK, strokeWidth = 1.2, radius = 8,
}: RoughBoxProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !width || !height) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = new RoughSVG(svg as SVGSVGElement);
    const node = rc.rectangle(strokeWidth, strokeWidth, width - strokeWidth * 2, height - strokeWidth * 2, {
      roughness,
      fill,
      fillStyle,
      stroke,
      strokeWidth,
      bowing: 0.8,
    });
    svg.appendChild(node);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
  }, [width, height, roughness, fill, fillStyle, stroke, strokeWidth, radius]);

  return svgRef;
}

function RoughBox({ width, height, roughness = 1.5, fill = "none", fillStyle = "hachure", stroke = INK, strokeWidth = 1.2, className = "" }: RoughBoxProps & { className?: string }) {
  const ref = useRoughBox({ width, height, roughness, fill, fillStyle, stroke, strokeWidth });
  return <svg ref={ref} className={`absolute inset-0 pointer-events-none ${className}`} style={{ width, height }} />;
}

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function RoughCard({ children, roughness = 1.4, fill = "none", fillStyle = "hachure", className = "", style = {} }: {
  children: React.ReactNode;
  roughness?: number;
  fill?: string;
  fillStyle?: RoughBoxProps["fillStyle"];
  className?: string;
  style?: React.CSSProperties;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(divRef);

  return (
    <div ref={divRef} className={`relative ${className}`} style={{ ...style }}>
      {w > 0 && h > 0 && (
        <RoughBox width={w} height={h} roughness={roughness} fill={fill} fillStyle={fillStyle} />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function RoughLine({ x1 = 0, y1 = 0, x2 = 100, y2 = 0, roughness = 1.2, stroke = INK, strokeWidth = 1.1 }: {
  x1?: number; y1?: number; x2?: number; y2?: number;
  roughness?: number; stroke?: string; strokeWidth?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const w = Math.abs(x2 - x1) + 8;
  const h = Math.abs(y2 - y1) + 8;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = new RoughSVG(svg as SVGSVGElement);
    svg.appendChild(rc.line(4, 4, w - 4, 4, { roughness, stroke, strokeWidth }));
  }, [w, roughness, stroke, strokeWidth]);

  return <svg ref={svgRef} style={{ display: "block", width: "100%", height: 8, overflow: "visible" }} />;
}

function RoughButton({ children, filled = false, onClick }: { children: React.ReactNode; filled?: boolean; onClick?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [svgHtml, setSvgHtml] = useState("");

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!size.w || !size.h) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const rc = new RoughSVG(svg);
    const node = rc.rectangle(2, 2, size.w - 4, size.h - 4, {
      roughness: 1.8,
      fill: filled ? INK : "none",
      fillStyle: filled ? "solid" : "none",
      stroke: INK,
      strokeWidth: filled ? 1.5 : 1.2,
    });
    setSvgHtml(node.outerHTML);
  }, [size, filled]);

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: "relative", background: "transparent", border: "none",
        cursor: "pointer", padding: "10px 22px",
        fontFamily: "var(--font-najs)", fontSize: 15, color: INK,
      }}
    >
      {svgHtml && (
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          width={size.w} height={size.h}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      )}
      <span style={{ position: "relative", zIndex: 1, color: filled ? PAPER : INK }}>
        {children}
      </span>
    </motion.button>
  );
}

const videos = [
  { id: "1", title: "Jak to działa #12 — dziwne prawa",    time: "18:42", views: "12 tys.", label: "PUBLICZNE" },
  { id: "2", title: "Patroni pytają — Q&A seria nr 5",      time: "11:08", views: "8 tys.",  label: "PATRONI"   },
  { id: "3", title: "Notatnik Polutka — szkic #7",          time: "7:31",  views: "5 tys.",  label: "PUBLICZNE" },
  { id: "4", title: "Dlaczego mówię to co mówię — manifest",time: "22:15", views: "21 tys.", label: "PATRONI"   },
];

function VideoCard({ video, delay = 0 }: { video: typeof videos[0]; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(ref as React.RefObject<HTMLDivElement>);
  const [thumbHtml, setThumbHtml] = useState("");

  useEffect(() => {
    if (!w) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const rc = new RoughSVG(svg);
    const rr = rc.rectangle(2, 2, 100, 56, { roughness: 1.2, stroke: INK, strokeWidth: 1 });
    const l1 = rc.line(2, 2, 102, 58, { roughness: 0.8, stroke: INK, strokeWidth: 0.8 });
    const l2 = rc.line(102, 2, 2, 58, { roughness: 0.8, stroke: INK, strokeWidth: 0.8 });
    setThumbHtml(rr.outerHTML + l1.outerHTML + l2.outerHTML);
  }, [w]);

  return (
    <motion.div
      ref={ref as React.RefObject<HTMLDivElement>}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -3 }}
      style={{ position: "relative", cursor: "pointer" }}
    >
      {w > 0 && h > 0 && (
        <RoughBox width={w} height={h} roughness={2} />
      )}
      <div style={{ padding: "12px 14px", position: "relative", zIndex: 1 }}>
        {/* Video thumbnail placeholder — X marks the spot */}
        <div style={{ position: "relative", aspectRatio: "16/9", marginBottom: 10 }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <rect width="100%" height="100%" fill={PAPER2} />
            {thumbHtml && (
              <g dangerouslySetInnerHTML={{ __html: thumbHtml }} transform={`scale(${w / 110}, 1)`} />
            )}
          </svg>
          {/* Time badge */}
          <div style={{
            position: "absolute", bottom: 6, right: 8,
            fontFamily: "var(--font-patrick)", fontSize: 11,
            background: INK, color: PAPER, padding: "1px 5px",
          }}>{video.time}</div>
        </div>
        <div style={{ fontFamily: "var(--font-najs)", fontSize: 14, lineHeight: 1.4, color: INK, marginBottom: 6 }}>
          {video.title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: "#7a6a4a" }}>{video.views}</span>
          <span style={{
            fontFamily: "var(--font-patrick)", fontSize: 9, letterSpacing: "0.1em",
            border: `1px solid ${video.label === "PATRONI" ? BLUE : INK}`,
            color: video.label === "PATRONI" ? BLUE : INK,
            padding: "1px 5px",
          }}>{video.label}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Layout5Wireframe() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { w: hw, h: hh } = useSize(heroRef as React.RefObject<HTMLDivElement>);
  const [playCircleHtml, setPlayCircleHtml] = useState("");

  useEffect(() => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const rc = new RoughSVG(svg);
    const c = rc.circle(36, 36, 64, { roughness: 1.5, stroke: INK, strokeWidth: 1.5, fill: PAPER, fillStyle: "solid" });
    setPlayCircleHtml(c.outerHTML);
  }, []);

  return (
    <main style={{
      minHeight: "100vh",
      background: PAPER,
      backgroundImage: `
        linear-gradient(rgba(26,18,9,0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(26,18,9,0.055) 1px, transparent 1px)
      `,
      backgroundSize: "28px 28px",
      fontFamily: "var(--font-patrick)",
      color: INK,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* HEADER */}
        <header style={{ padding: "22px 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontFamily: "var(--font-najs)", fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
                Polutek
              </div>
              <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, color: "#8a7a5a" }}>
                kanał wideo
              </div>
            </div>
            {/* Nav */}
            <nav style={{ display: "flex", gap: 4 }}>
              {["Start", "Odcinki", "Patroni", "Komentarze"].map((item, i) => (
                <RoughButton key={item} filled={i === 0}>{item}</RoughButton>
              ))}
            </nav>
            <RoughButton filled>→ Wspieram</RoughButton>
          </div>
          <RoughLine roughness={1.2} stroke={INK} strokeWidth={0.9} />
        </header>

        {/* MAIN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 28, marginTop: 20 }}>

          {/* LEFT: HERO VIDEO + INFO */}
          <div>
            {/* Section label */}
            <div style={{ fontFamily: "var(--font-patrick)", fontSize: 11, letterSpacing: "0.25em", color: "#8a7a5a", marginBottom: 10 }}>
              GŁÓWNY MATERIAŁ ////
            </div>

            {/* Hero video box */}
            <div ref={heroRef} style={{ position: "relative", aspectRatio: "16/9", marginBottom: 18 }}>
              {hw > 0 && hh > 0 && (
                <RoughBox width={hw} height={hh} roughness={1.8} fill={PAPER2} fillStyle="solid" strokeWidth={1.4} />
              )}
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 1,
              }}>
                {/* X lines like wireframe thumbnail */}
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.25 }}>
                  <line x1="0" y1="0" x2="100%" y2="100%" stroke={INK} strokeWidth="1" />
                  <line x1="100%" y1="0" x2="0" y2="100%" stroke={INK} strokeWidth="1" />
                </svg>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  style={{
                    position: "relative", width: 72, height: 72, cursor: "pointer",
                  }}
                >
                  <svg width="72" height="72" viewBox="0 0 72 72"
                    dangerouslySetInnerHTML={{ __html: playCircleHtml }}
                  />
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-najs)", fontSize: 22,
                  }}>▶</div>
                </motion.div>
              </div>
              <div style={{
                position: "absolute", bottom: 10, right: 14, zIndex: 2,
                fontFamily: "var(--font-patrick)", fontSize: 12, color: "#7a6a4a",
              }}>18:42 min</div>
            </div>

            {/* Title with rough underline */}
            <h1 style={{
              fontFamily: "var(--font-najs)", fontSize: 28, fontWeight: 700,
              lineHeight: 1.2, marginBottom: 6, color: INK,
            }}>
              Jak to działa #12 — dziwne prawa polskiego systemu
            </h1>
            <RoughLine roughness={2} stroke={GOLD} strokeWidth={3} />

            {/* Meta */}
            <div style={{ display: "flex", gap: 16, marginTop: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#7a6a4a" }}>12 tys. wyświetleń</span>
              <span style={{ fontSize: 12, color: "#7a6a4a" }}>· 3 dni temu</span>
              <span style={{
                fontSize: 11, border: `1px solid ${INK}`, padding: "1px 7px", letterSpacing: "0.1em",
              }}>PUBLICZNE</span>
            </div>

            {/* Description box */}
            <RoughCard roughness={1.2} fill={PAPER2} fillStyle="solid" style={{ padding: "14px 16px", marginBottom: 18 }}>
              <p style={{ fontSize: 13, lineHeight: 1.75, color: "#3a2a1a", margin: 0, fontFamily: "var(--font-patrick)" }}>
                Przez kilka tygodni zbierałem przykłady absurdalnych przepisów. Ten materiał to owoc tej pracy — rozmowy, dokumenty, komentarze prawników.
              </p>
            </RoughCard>

            {/* Action row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <RoughButton>👍 Polub (1847)</RoughButton>
              <RoughButton>👎 Nie lubię (23)</RoughButton>
              <RoughButton>↗ Udostępnij</RoughButton>
              <RoughButton>⋯ Więcej</RoughButton>
            </div>

            {/* Creator row */}
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <RoughCard style={{ width: 44, height: 44, flexShrink: 0 }}>
                <div style={{
                  width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-najs)", fontSize: 20,
                }}>P</div>
              </RoughCard>
              <div>
                <div style={{ fontFamily: "var(--font-najs)", fontSize: 15, fontWeight: 700 }}>Paweł Polutek</div>
                <div style={{ fontSize: 11, color: "#7a6a4a" }}>4 823 subskrybentów</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <RoughButton filled>🔔 Subskrybuj</RoughButton>
              </div>
            </div>
          </div>

          {/* RIGHT: SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Search */}
            <RoughCard roughness={1.3} style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "#8a7a5a" }}>🔍</span>
              <span style={{ fontFamily: "var(--font-patrick)", fontSize: 13, color: "#8a7a5a", flex: 1 }}>Szukaj odcinków...</span>
            </RoughCard>

            {/* Patron box */}
            <RoughCard roughness={1.6} fill="#fdf6e3" fillStyle="solid" style={{ padding: "16px" }}>
              <div style={{ fontFamily: "var(--font-najs)", fontSize: 13, letterSpacing: "0.15em", marginBottom: 8 }}>
                WESPRZYJ POLUTEK.PL
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: "#4a3a1a", margin: "0 0 12px" }}>
                Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze.
              </p>
              <RoughButton filled>Wejście →</RoughButton>
            </RoughCard>

            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: "var(--font-patrick)", fontSize: 11, letterSpacing: "0.25em", color: "#8a7a5a", whiteSpace: "nowrap" }}>
                INNE ODCINKI ////
              </span>
              <div style={{ flex: 1 }}>
                <RoughLine roughness={1.2} strokeWidth={0.7} />
              </div>
            </div>

            {/* Video cards */}
            {videos.map((v, i) => (
              <VideoCard key={v.id} video={v} delay={i * 0.08} />
            ))}
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ padding: "16px 0", textAlign: "center", borderTop: "none" }}>
        <RoughLine roughness={1} strokeWidth={0.7} />
        <div style={{ marginTop: 14 }}>
          <Link href="/pokaz" style={{ fontFamily: "var(--font-patrick)", fontSize: 13, color: "#7a6a4a", textDecoration: "none" }}>
            ← wszystkie layouty
          </Link>
        </div>
      </div>
    </main>
  );
}
