"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const BLUE = "#2563eb";
const NIGHT = "#100f0c";
const NIGHT2 = "#1a1915";
const BORDER = "rgba(248,243,231,0.08)";
const TEXT = "#f8f3e7";
const TEXT_DIM = "rgba(248,243,231,0.45)";

const MOCK_VIDEOS = [
  { id: "1", title: "Dlaczego nikt nie mówi prawdy w internecie", duration: "18:42", locked: false, views: 4821, badge: null },
  { id: "2", title: "Algorytm cię kontroluje (i wiesz o tym)", duration: "24:11", locked: true, views: 12340, badge: "PATRON" },
  { id: "3", title: "Ekranowy tłum i jego złudzenie wspólnoty", duration: "31:05", locked: true, views: 8970, badge: "PATRON" },
  { id: "4", title: "Wolne słowo kontra korporacyjne filtry", duration: "14:28", locked: false, views: 2140, badge: null },
];

function Tag({ children, blue = false }: { children: React.ReactNode; blue?: boolean }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase rounded"
      style={{
        fontFamily: "var(--font-outfit, Outfit, sans-serif)",
        background: blue ? BLUE : "rgba(248,243,231,0.08)",
        color: blue ? "white" : TEXT_DIM,
        letterSpacing: "0.12em",
      }}
    >
      {children}
    </span>
  );
}

function GlowDot() {
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE, boxShadow: `0 0 6px ${BLUE}` }} />
  );
}

export default function E2Home() {
  const [active, setActive] = useState("1");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const video = MOCK_VIDEOS.find((v) => v.id === active) || MOCK_VIDEOS[0];

  return (
    <div
      className="min-h-screen"
      style={{ background: NIGHT, color: TEXT, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
    >
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-5 h-14"
        style={{ background: `${NIGHT}ee`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <GlowDot />
          <span
            className="text-lg tracking-[0.08em] uppercase font-bold"
            style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)", color: TEXT }}
          >
            Polutek
          </span>
        </div>
        <div className="flex gap-3 text-[11px]" style={{ color: TEXT_DIM }}>
          <Link href="/eksperyment1" className="hover:text-white transition-colors">→ Rough Press</Link>
          <Link href="/eksperyment3" className="hover:text-white transition-colors">→ Editorial</Link>
          <Link href="/kreator" className="hover:text-white transition-colors">→ Kreator</Link>
          <Link href="/" className="hover:text-white transition-colors">→ Oryginał</Link>
        </div>
      </nav>

      <div className="text-center py-2.5 text-[10px] tracking-widest uppercase" style={{ color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }}>
        Eksperyment 2 — Noir
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

          {/* Player */}
          <div>
            <div
              className="aspect-video w-full flex items-center justify-center rounded-sm overflow-hidden relative"
              style={{ background: "#000", border: `1px solid ${BORDER}` }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className="text-6xl mb-2"
                    style={{ fontFamily: "var(--font-brand, Bebas Neue, sans-serif)", letterSpacing: "0.08em", color: BLUE, textShadow: `0 0 40px ${BLUE}66` }}
                  >
                    POLUTEK.PL
                  </div>
                  <p className="text-xs" style={{ color: TEXT_DIM }}>Odtwarzacz wideo</p>
                </div>
              </div>
              {/* vignette overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
            </div>

            {/* Video info */}
            <div className="mt-4 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1
                    className="text-xl font-bold leading-snug mb-2"
                    style={{ color: TEXT }}
                  >
                    {video.title}
                  </h1>
                  <div className="flex items-center gap-3 text-xs" style={{ color: TEXT_DIM }}>
                    <span>{video.views.toLocaleString("pl")} wyświetleń</span>
                    <span>·</span>
                    <span>{video.duration}</span>
                    {video.badge && <Tag>{video.badge}</Tag>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  className="h-9 px-5 rounded text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: BLUE, boxShadow: `0 0 18px ${BLUE}44`, fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
                >
                  Zaloguj się
                </button>
                <button
                  className="h-9 px-5 rounded text-sm font-medium transition-all hover:bg-white/10 active:scale-95"
                  style={{ border: `1px solid ${BORDER}`, color: TEXT, background: "transparent" }}
                >
                  Udostępnij
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="mt-4 rounded-sm p-4 text-sm leading-relaxed" style={{ background: NIGHT2, border: `1px solid ${BORDER}`, color: TEXT_DIM }}>
              Niezależny kanał wideo. Materiały publiczne, patronackie i dla zalogowanych.
              Bez algorytmów, bez reklam, bez kompromisów.
            </div>

            {/* Comments */}
            <div className="mt-6">
              <h2 className="font-semibold mb-4 text-sm tracking-wide uppercase" style={{ color: TEXT_DIM, letterSpacing: "0.1em" }}>
                Komentarze
              </h2>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full shrink-0" style={{ background: NIGHT2, border: `1px solid ${BORDER}` }} />
                    <div className="flex-1">
                      <div className="h-2.5 rounded w-20 mb-2" style={{ background: "rgba(248,243,231,0.1)" }} />
                      <div className="h-2.5 rounded w-full mb-1.5" style={{ background: "rgba(248,243,231,0.06)" }} />
                      <div className="h-2.5 rounded w-2/3" style={{ background: "rgba(248,243,231,0.06)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Playlist */}
            <div className="rounded-sm overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: NIGHT2 }}>
              <div className="px-4 py-3 text-xs font-bold tracking-widest uppercase" style={{ color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }}>
                Wszystkie materiały
              </div>
              <div>
                {MOCK_VIDEOS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setActive(v.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all"
                    style={{
                      background: v.id === active ? "rgba(37,99,235,0.12)" : "transparent",
                      borderLeft: v.id === active ? `2px solid ${BLUE}` : "2px solid transparent",
                    }}
                  >
                    <div
                      className="w-14 h-9 shrink-0 flex items-center justify-center text-[10px] rounded-sm"
                      style={{ background: "#000", color: TEXT_DIM, fontFamily: "var(--font-outfit, Outfit, sans-serif)", border: `1px solid ${BORDER}` }}
                    >
                      {v.duration}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-snug line-clamp-2" style={{ color: v.id === active ? TEXT : TEXT_DIM }}>
                        {v.title}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: "rgba(248,243,231,0.25)" }}>{v.views.toLocaleString("pl")}</span>
                        {v.badge && <Tag blue>{v.badge}</Tag>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Donation */}
            <div
              className="rounded-sm p-5"
              style={{ border: `1px solid rgba(37,99,235,0.3)`, background: "rgba(37,99,235,0.06)", boxShadow: `0 0 30px rgba(37,99,235,0.08)` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <GlowDot />
                <h3 className="font-bold text-sm" style={{ color: TEXT }}>Wesprzyj kanał</h3>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: TEXT_DIM }}>
                Jednorazowe wsparcie odblokowuje dostęp do treści patronackich na zawsze.
              </p>
              <div className="flex gap-2">
                {["20 zł", "50 zł", "100 zł"].map((amt) => (
                  <button
                    key={amt}
                    className="flex-1 h-8 text-xs font-bold rounded transition-all hover:brightness-110 active:scale-95"
                    style={{ background: "rgba(37,99,235,0.15)", border: `1px solid rgba(37,99,235,0.4)`, color: "#93c5fd" }}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
