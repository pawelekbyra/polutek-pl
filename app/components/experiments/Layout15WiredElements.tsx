"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";

// Wired-elements web components — must be imported client-side
// Uses actual <wired-card>, <wired-button>, <wired-input>, <wired-progress> etc.

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "wired-card": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { elevation?: number }, HTMLElement>;
      "wired-button": React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-input": React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLElement> & { placeholder?: string }, HTMLElement>;
      "wired-progress": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { value?: number; min?: number; max?: number }, HTMLElement>;
      "wired-slider": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { value?: number; min?: number; max?: number }, HTMLElement>;
      "wired-checkbox": React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLElement> & { checked?: boolean }, HTMLElement>;
      "wired-radio": React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-radio-group": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { selected?: string }, HTMLElement>;
      "wired-item": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { value?: string }, HTMLElement>;
      "wired-listbox": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-textarea": React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLElement> & { placeholder?: string }, HTMLElement>;
      "wired-divider": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-spinner": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { active?: boolean }, HTMLElement>;
      "wired-icon-button": React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-tabs": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { selected?: string }, HTMLElement>;
      "wired-tab": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { name?: string; label?: string }, HTMLElement>;
      "wired-video": React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLElement> & { src?: string }, HTMLElement>;
      "wired-toggle": React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLElement> & { checked?: boolean }, HTMLElement>;
      "wired-link": React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-image": React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-combo": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-search-input": React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLElement> & { placeholder?: string }, HTMLElement>;
      "wired-fab": React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLElement>, HTMLElement>;
      "wired-badge": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { value?: number }, HTMLElement>;
      "wired-dialog": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { open?: boolean }, HTMLElement>;
    }
  }
}

const VIDEOS = [
  { id: 1, title: "Jak ugotować wodę — poradnik dla zaawansowanych", duration: "12:34", views: "142k", emoji: "🍳", progress: 72, tags: ["gotowanie", "humor"] },
  { id: 2, title: "Recenzja powietrza — czy jest warte ceny?", duration: "8:21", views: "89k", emoji: "💨", progress: 45, tags: ["recenzja", "filozofia"] },
  { id: 3, title: "Nauka chodzenia od podstaw — kurs online", duration: "22:15", views: "203k", emoji: "🚶", progress: 100, tags: ["sport", "tutorial"] },
  { id: 4, title: "5 sposobów na siedzenie na krześle", duration: "6:47", views: "67k", emoji: "🪑", progress: 0, tags: ["lifestyle", "top5"] },
  { id: 5, title: "Historia słomki — od starożytności do dziś", duration: "18:03", views: "445k", emoji: "🥤", progress: 30, tags: ["historia", "nauka"] },
  { id: 6, title: "Gram w grę którą sam wymyśliłem", duration: "31:12", views: "521k", emoji: "🎮", progress: 88, tags: ["gaming", "kreatywność"] },
];

const BG = "#faf7f0";
const INK = "#1a1510";

export function Layout15WiredElements() {
  const [wiredLoaded, setWiredLoaded] = useState(false);
  const [activeVideo, setActiveVideo] = useState(VIDEOS[0]);
  const [activeTab, setActiveTab] = useState("playlist");
  const [searchVal, setSearchVal] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const { scrollYProgress } = useScroll();
  const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0.9]);

  useEffect(() => {
    import("wired-elements").then(() => {
      setWiredLoaded(true);
    }).catch(() => {
      // wired-elements might not be available in SSR context
      setWiredLoaded(true);
    });
  }, []);

  const bg = darkMode ? "#1a1510" : BG;
  const ink = darkMode ? "#f0e8d8" : INK;
  const cardBg = darkMode ? "#2a2018" : "#ffffff";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: bg,
        color: ink,
        fontFamily: "var(--font-patrick), 'Patrick Hand', cursive",
        transition: "background-color 0.4s ease, color 0.4s ease",
      }}
    >
      {/* Animated background doodles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden", opacity: 0.04 }}>
        {["★", "✦", "◆", "▲", "●", "■", "❋", "✿"].map((sym, i) => (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              fontSize: `${20 + (i % 4) * 15}px`,
              left: `${(i * 13) % 100}%`,
              top: `${(i * 17) % 100}%`,
              color: ink,
            }}
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ duration: 10 + i * 3, repeat: Infinity, ease: "linear" }}
          >
            {sym}
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <motion.header
        style={{
          opacity: headerOpacity,
          position: "sticky",
          top: 0,
          zIndex: 100,
          backgroundColor: darkMode ? "#12100e" : "#f5efe0",
          borderBottom: `2px solid ${ink}`,
          padding: "12px 24px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "var(--font-brand), 'Bebas Neue', cursive", fontSize: 32, letterSpacing: 2, color: ink }}>
              POLUTEK
            </span>
            <span style={{ fontFamily: "var(--font-caveat), 'Caveat', cursive", fontSize: 13, color: ink, opacity: 0.6, marginLeft: 8 }}>
              — wired edition
            </span>
          </div>

          {wiredLoaded && (
            <wired-search-input
              placeholder="szukaj filmów..."
              style={{
                "--wired-input-font-family": "var(--font-patrick), cursive",
                fontFamily: "var(--font-patrick), cursive",
                fontSize: 14,
                flex: 1,
                maxWidth: 300,
              } as React.CSSProperties}
            />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13 }}>jasny</span>
            {wiredLoaded && (
              <wired-toggle
                checked={darkMode}
                onClick={() => setDarkMode(d => !d)}
              />
            )}
            <span style={{ fontSize: 13 }}>ciemny</span>
          </div>

          {wiredLoaded && (
            <wired-button style={{ "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
              Zaloguj się
            </wired-button>
          )}
        </div>
      </motion.header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", position: "relative", zIndex: 1 }}>
        {/* Hero section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, marginBottom: 48 }}>
          {/* Main video card */}
          <div>
            {wiredLoaded && (
              <wired-card elevation={3} style={{ display: "block", padding: 24, backgroundColor: cardBg } as React.CSSProperties}>
                {/* Fake video player */}
                <div
                  style={{
                    aspectRatio: "16/9",
                    backgroundColor: darkMode ? "#0d0b09" : "#e8e0d0",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeVideo.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 64 }}>{activeVideo.emoji}</span>
                      <span style={{ fontFamily: "var(--font-caveat)", fontSize: 18, opacity: 0.7 }}>
                        {activeVideo.title}
                      </span>
                    </motion.div>
                  </AnimatePresence>

                  {/* Play button overlay */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      position: "absolute",
                      bottom: 12,
                      right: 12,
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      backgroundColor: ink,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ color: bg, fontSize: 16, marginLeft: 3 }}>▶</span>
                  </motion.div>
                </div>

                {/* Video info */}
                <h2 style={{
                  fontFamily: "var(--font-brand)",
                  fontSize: 22,
                  letterSpacing: 1,
                  marginBottom: 8,
                  color: ink,
                }}>
                  {activeVideo.title}
                </h2>

                <div style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 13, opacity: 0.7 }}>
                  <span>⏱ {activeVideo.duration}</span>
                  <span>👁 {activeVideo.views} wyświetleń</span>
                  {activeVideo.tags.map(t => (
                    <span key={t} style={{
                      padding: "1px 8px",
                      border: `1px solid ${ink}`,
                      borderRadius: 2,
                      fontFamily: "var(--font-caveat)",
                    }}>#{t}</span>
                  ))}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, opacity: 0.6 }}>
                    <span>postęp oglądania</span>
                    <span>{activeVideo.progress}%</span>
                  </div>
                  {wiredLoaded && (
                    <wired-progress
                      value={activeVideo.progress}
                      min={0}
                      max={100}
                      style={{ width: "100%", display: "block" } as React.CSSProperties}
                    />
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {wiredLoaded && (
                    <>
                      <wired-button style={{ "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
                        ▶ Odtwórz
                      </wired-button>
                      <wired-button style={{ "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
                        👍 Lubię
                      </wired-button>
                      <wired-button style={{ "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
                        🔖 Zapisz
                      </wired-button>
                      <wired-button style={{ "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
                        📤 Udostępnij
                      </wired-button>
                    </>
                  )}
                </div>
              </wired-card>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Creator card */}
            {wiredLoaded && (
              <wired-card elevation={2} style={{ display: "block", padding: 20, backgroundColor: cardBg } as React.CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    backgroundColor: darkMode ? "#3a2f1e" : "#e8dcc8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    border: `2px solid ${ink}`,
                  }}>
                    🎬
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-brand)", fontSize: 18, letterSpacing: 1 }}>Polutek</div>
                    <div style={{ fontSize: 12, opacity: 0.6, fontFamily: "var(--font-caveat)" }}>Creator & Filmmaker</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12, fontFamily: "var(--font-caveat)", opacity: 0.8 }}>
                  Tworzę filmy o absurdach życia codziennego. Oglądalność rośnie o 12% tygodniowo (podobno).
                </div>
                {wiredLoaded && (
                  <wired-button style={{ width: "100%", "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
                    ❤️ Wesprzyj twórcę
                  </wired-button>
                )}
              </wired-card>
            )}

            {/* Stats */}
            {wiredLoaded && (
              <wired-card elevation={1} style={{ display: "block", padding: 16, backgroundColor: cardBg } as React.CSSProperties}>
                <div style={{ fontFamily: "var(--font-brand)", fontSize: 14, letterSpacing: 1, marginBottom: 12, opacity: 0.6 }}>STATYSTYKI KANAŁU</div>
                {[
                  { label: "Filmy", value: "47", icon: "🎥" },
                  { label: "Patroni", value: "312", icon: "⭐" },
                  { label: "Wyświetleń", value: "2.4M", icon: "👁" },
                ].map(stat => (
                  <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px dashed ${ink}20` }}>
                    <span style={{ opacity: 0.7 }}>{stat.icon} {stat.label}</span>
                    <strong style={{ fontFamily: "var(--font-brand)", letterSpacing: 1 }}>{stat.value}</strong>
                  </div>
                ))}
              </wired-card>
            )}

            {/* Newsletter signup */}
            {wiredLoaded && (
              <wired-card elevation={1} style={{ display: "block", padding: 16, backgroundColor: cardBg } as React.CSSProperties}>
                <div style={{ fontFamily: "var(--font-caveat)", fontSize: 18, marginBottom: 8 }}>
                  📨 Bądź na bieżąco!
                </div>
                <wired-input
                  placeholder="twój@email.pl"
                  style={{ width: "100%", display: "block", marginBottom: 8, fontFamily: "var(--font-patrick)" } as React.CSSProperties}
                />
                <wired-button style={{ width: "100%", "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
                  Zapisz się
                </wired-button>
              </wired-card>
            )}
          </div>
        </div>

        {/* Video list with tabs */}
        {wiredLoaded && (
          <wired-card elevation={2} style={{ display: "block", padding: 0, backgroundColor: cardBg, overflow: "hidden" } as React.CSSProperties}>
            <div style={{ padding: "16px 24px 0", borderBottom: `2px solid ${ink}20` }}>
              <div style={{ fontFamily: "var(--font-brand)", fontSize: 20, letterSpacing: 2, marginBottom: 12 }}>
                WSZYSTKIE FILMY
              </div>
              <div style={{ display: "flex", gap: 0 }}>
                {["playlist", "popularne", "nowe"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "8px 20px",
                      fontFamily: "var(--font-patrick)",
                      fontSize: 14,
                      border: "none",
                      borderBottom: activeTab === tab ? `3px solid ${ink}` : "3px solid transparent",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: ink,
                      opacity: activeTab === tab ? 1 : 0.5,
                      transition: "all 0.2s",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {VIDEOS.map((video, i) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setActiveVideo(video)}
                    style={{ cursor: "pointer" }}
                    whileHover={{ y: -4 }}
                  >
                    <wired-card
                      elevation={video.id === activeVideo.id ? 3 : 1}
                      style={{
                        display: "block",
                        padding: 16,
                        backgroundColor: video.id === activeVideo.id
                          ? (darkMode ? "#3a2f1e" : "#fff8e8")
                          : cardBg,
                        outline: video.id === activeVideo.id ? `2px solid ${ink}` : "none",
                      } as React.CSSProperties}
                    >
                      {/* Thumbnail area */}
                      <div style={{
                        aspectRatio: "16/9",
                        backgroundColor: darkMode ? "#1a1510" : "#e8e0d0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                        fontSize: 40,
                        position: "relative",
                      }}>
                        {video.emoji}
                        <span style={{
                          position: "absolute",
                          bottom: 6,
                          right: 8,
                          fontSize: 11,
                          backgroundColor: `${ink}cc`,
                          color: bg,
                          padding: "2px 6px",
                          fontFamily: "var(--font-patrick)",
                        }}>
                          {video.duration}
                        </span>
                        {video.progress > 0 && video.progress < 100 && (
                          <div style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            backgroundColor: `${ink}20`,
                          }}>
                            <div style={{ width: `${video.progress}%`, height: "100%", backgroundColor: ink }} />
                          </div>
                        )}
                      </div>

                      <div style={{ fontFamily: "var(--font-caveat)", fontSize: 16, lineHeight: 1.3, marginBottom: 8, color: ink }}>
                        {video.title}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.6 }}>
                        <span>👁 {video.views}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {video.tags.map(t => (
                            <span key={t} style={{ color: ink, opacity: 0.5 }}>#{t}</span>
                          ))}
                        </div>
                      </div>
                    </wired-card>
                  </motion.div>
                ))}
              </div>
            </div>
          </wired-card>
        )}

        {/* Footer area with wired elements demo */}
        <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
          {wiredLoaded && (
            <>
              <wired-card elevation={1} style={{ display: "block", padding: 20, backgroundColor: cardBg } as React.CSSProperties}>
                <div style={{ fontFamily: "var(--font-brand)", fontSize: 14, letterSpacing: 1, marginBottom: 12, opacity: 0.6 }}>JAKOŚĆ VIDEO</div>
                {wiredLoaded && (
                  <wired-radio-group selected="hd">
                    <wired-radio value="4k" name="quality" style={{ fontFamily: "var(--font-patrick)" } as React.CSSProperties}>4K Ultra HD</wired-radio>
                    <wired-radio value="hd" name="quality" style={{ fontFamily: "var(--font-patrick)" } as React.CSSProperties}>1080p HD</wired-radio>
                    <wired-radio value="sd" name="quality" style={{ fontFamily: "var(--font-patrick)" } as React.CSSProperties}>720p</wired-radio>
                    <wired-radio value="low" name="quality" style={{ fontFamily: "var(--font-patrick)" } as React.CSSProperties}>480p (oszczędność)</wired-radio>
                  </wired-radio-group>
                )}
              </wired-card>

              <wired-card elevation={1} style={{ display: "block", padding: 20, backgroundColor: cardBg } as React.CSSProperties}>
                <div style={{ fontFamily: "var(--font-brand)", fontSize: 14, letterSpacing: 1, marginBottom: 12, opacity: 0.6 }}>USTAWIENIA</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Powiadomienia", "Napisy", "Autoplay", "Ciemny motyw"].map(label => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontFamily: "var(--font-patrick)" }}>{label}</span>
                      <wired-toggle />
                    </div>
                  ))}
                </div>
              </wired-card>

              <wired-card elevation={1} style={{ display: "block", padding: 20, backgroundColor: cardBg } as React.CSSProperties}>
                <div style={{ fontFamily: "var(--font-brand)", fontSize: 14, letterSpacing: 1, marginBottom: 12, opacity: 0.6 }}>NAPISZ DO NAS</div>
                <wired-textarea
                  placeholder="Twoja wiadomość..."
                  style={{ width: "100%", display: "block", marginBottom: 12, minHeight: 80, fontFamily: "var(--font-patrick)" } as React.CSSProperties}
                />
                <wired-button style={{ width: "100%", "--wired-button-font-family": "var(--font-patrick)" } as React.CSSProperties}>
                  Wyślij ✉️
                </wired-button>
              </wired-card>
            </>
          )}
        </div>

        {!wiredLoaded && (
          <div style={{ textAlign: "center", padding: 80, fontFamily: "var(--font-caveat)", fontSize: 24, opacity: 0.5 }}>
            Ładowanie komponentów wired-elements...
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: 64,
        padding: "24px",
        borderTop: `2px solid ${ink}20`,
        textAlign: "center",
        fontFamily: "var(--font-caveat)",
        fontSize: 14,
        opacity: 0.5,
      }}>
        Polutek.pl — interfejs rysowany ołówkiem przez wired-elements ✏️
      </footer>
    </div>
  );
}
