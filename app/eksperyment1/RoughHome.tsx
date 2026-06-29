"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import Link from "next/link";
import Image from "next/image";
import { PublicVideoDTO } from "@/app/types/video";

const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

function RoughBorder({ roughness = 1, strokeWidth = 1.2, color = "#1a1a1a", seed = 42, className = "" }: {
  roughness?: number; strokeWidth?: number; color?: string; seed?: number; className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const { width: w, height: h } = parent.getBoundingClientRect();
    if (w === 0 || h === 0) return;

    setDims({ w, h });
    const rc = rough.svg(el);
    el.innerHTML = "";
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
    const rect = rc.rectangle(3, 3, w - 6, h - 6, { roughness, strokeWidth, stroke: color, seed });
    el.appendChild(rect);
  }, [roughness, strokeWidth, color, seed]);

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      width={dims.w || "100%"}
      height={dims.h || "100%"}
    />
  );
}

function RoughSeparator({ color = "#d1d5db" }: { color?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const w = el.parentElement?.getBoundingClientRect().width || 600;
    const rc = rough.svg(el);
    el.innerHTML = "";
    el.setAttribute("width", String(w));
    const line = rc.line(0, 10, w, 10, { roughness: 1, strokeWidth: 0.8, stroke: color, seed: 77 });
    el.appendChild(line);
  }, [color]);

  return <svg ref={svgRef} className="w-full" height={20} />;
}

function RoughBadge({ text, variant = "public" }: { text: string; variant?: "public" | "unlocked" }) {
  const fill = variant === "unlocked" ? "#2563EB" : "#1a1a1a";
  return (
    <span className="relative inline-block text-[10px] font-black uppercase tracking-widest px-2 py-1 text-white">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 22" preserveAspectRatio="none">
        <path d="M 3 3 L 77 4 L 76 19 L 4 18 Z" fill={fill} stroke={fill} strokeWidth="0.5" />
      </svg>
      <span className="relative">{text}</span>
    </span>
  );
}

function RoughButton({ children, href, filled = false, blue = false, className = "" }: {
  children: React.ReactNode; href?: string; filled?: boolean; blue?: boolean; className?: string;
}) {
  const fillColor = blue ? "#2563EB" : filled ? "#1a1a1a" : "none";
  const textColor = filled || blue ? "white" : "#1a1a1a";

  const inner = (
    <span className={`relative inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${className}`} style={{ color: textColor }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 130 40" preserveAspectRatio="none">
        <path
          d="M 5 5 L 125 7 L 123 35 L 7 33 Z"
          fill={fillColor}
          stroke={blue ? "#1d4ed8" : "#1a1a1a"}
          strokeWidth="1.3"
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return <button>{inner}</button>;
}

function VideoThumbnailCard({ video, isSelected = false }: { video: PublicVideoDTO; isSelected?: boolean }) {
  const isPublic = video.tier === "PUBLIC";
  const displayTitle = video.title;

  return (
    <div className={`group cursor-pointer flex gap-3 p-2 rounded relative transition-colors ${isSelected ? "bg-neutral-900/5" : "hover:bg-neutral-900/3"}`}>
      {isSelected && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5">
          <svg width="2" height="100%" className="h-full">
            <path d="M 1 0 L 1 100" stroke="#1a1a1a" strokeWidth="2" strokeDasharray="3 3" />
          </svg>
        </div>
      )}
      <div className="relative w-28 aspect-video shrink-0">
        <div className="absolute inset-0">
          <RoughBorder roughness={0.8} strokeWidth={1} color="#9ca3af" seed={video.id.charCodeAt(0)} />
        </div>
        {video.thumbnailUrl ? (
          <Image src={video.thumbnailUrl} alt={displayTitle} fill className="object-cover absolute inset-[3px]" sizes="112px" />
        ) : (
          <div className="absolute inset-[3px] bg-neutral-200 flex items-center justify-center text-[9px] text-neutral-400">Video</div>
        )}
        <div className="absolute bottom-1 left-0 right-0 flex justify-between px-1 z-10">
          <RoughBadge text={isPublic ? "PUBL." : "ODBL."} variant={isPublic ? "public" : "unlocked"} />
        </div>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-xs font-bold text-neutral-900 leading-tight line-clamp-2 uppercase tracking-tight">{displayTitle}</p>
        <p className="text-[10px] text-neutral-400 mt-1">{video.views} wyświetleń</p>
      </div>
    </div>
  );
}

function AnnotatedHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, { type: "underline", color: "#2563eb", strokeWidth: 2, animate: true, padding: 2 });
    ann.show();
    return () => ann.remove();
  }, []);
  return <span ref={ref}>{children}</span>;
}

interface RoughHomeProps {
  mainVideo: PublicVideoDTO;
  allVideos: PublicVideoDTO[];
  currentVideoId?: string;
}

export default function RoughHome({ mainVideo, allVideos, currentVideoId }: RoughHomeProps) {
  const selectedVideo = allVideos.find(v => v.id === currentVideoId) || mainVideo;
  const [countdown, setCountdown] = useState("105 dni 00:00:00");

  useEffect(() => {
    const target = new Date("2026-10-13T00:00:00+02:00");
    const update = () => {
      const ms = target.getTime() - Date.now();
      if (ms <= 0) { setCountdown("Premiera dostępna"); return; }
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      const pad = (v: number) => v.toString().padStart(2, "0");
      setCountdown(`${d} dni ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const sortedVideos = [...allVideos].slice(0, 8);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#fdfbf7" }}>
      {/* Paper noise */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: PAPER_NOISE, opacity: 0.055 }} />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200/80 bg-[#fdfbf7]/90 backdrop-blur-md px-4 lg:px-6 h-[58px] flex items-center justify-between gap-4">
        <div className="font-black text-xl uppercase tracking-tighter text-neutral-900">
          POLUTEK<span className="relative text-neutral-900">.PL</span>
        </div>

        <div className="flex-1 max-w-lg mx-4 relative hidden md:block">
          <input
            readOnly
            placeholder="Szukaj..."
            className="w-full pl-3 pr-10 py-2 text-sm bg-transparent"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cpath d='M3,3 L97%25,4 L96%25,96%25 L4,97%25 Z' fill='none' stroke='%23d1d5db' stroke-width='1.3'/%3E%3C/svg%3E")`,
              backgroundSize: "100% 100%",
              outline: "none",
            }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">⌕</span>
        </div>

        <div className="flex items-center gap-2">
          <RoughButton>PL</RoughButton>
          <RoughButton>EN</RoughButton>
          <RoughButton href="/" filled>→ WEJŚCIE</RoughButton>
        </div>
      </nav>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-12 gap-6">

          {/* Left: video player area */}
          <div className="col-span-12 lg:col-span-8">
            {/* Player */}
            <div className="relative aspect-video mb-4">
              <RoughBorder roughness={1.2} strokeWidth={1.5} color="#374151" seed={99} />
              <div className="absolute inset-[4px] bg-neutral-900 overflow-hidden rounded-sm">
                {selectedVideo.thumbnailUrl ? (
                  <Image src={selectedVideo.thumbnailUrl} alt={selectedVideo.title} fill className="object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl">▶</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 relative">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
                      <path d="M 4 4 L 60 5 L 59 59 L 5 58 Z" fill="rgba(255,255,255,0.9)" stroke="white" strokeWidth="1.5" />
                      <path d="M 24 20 L 24 44 L 44 32 Z" fill="#1a1a1a" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black uppercase tracking-tighter text-neutral-900 mb-2">
              <AnnotatedHeading>{selectedVideo.title}</AnnotatedHeading>
            </h1>

            <RoughSeparator color="#e5e7eb" />

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 relative rounded-full overflow-hidden bg-neutral-200">
                  {selectedVideo.creator?.imageUrl && (
                    <Image src={selectedVideo.creator.imageUrl} alt="avatar" fill className="object-cover" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900">{selectedVideo.creator?.name || "Paweł Polutek"}</p>
                  <p className="text-xs text-neutral-400">{selectedVideo.creator?.subscribersCount || 0} subskrybentów</p>
                </div>
              </div>

              <RoughButton filled className="ml-1">🔔 Subskrybuj</RoughButton>

              <div className="flex items-center gap-1 ml-auto">
                <RoughButton>👍 {selectedVideo.likes ?? 0}</RoughButton>
                <RoughButton>👎 {selectedVideo.dislikes ?? 0}</RoughButton>
                <RoughButton>→ Szeruj</RoughButton>
                <RoughButton>•••</RoughButton>
              </div>
            </div>

            <RoughSeparator color="#e5e7eb" />

            {/* Description */}
            {selectedVideo.description && (
              <div className="mt-3 relative p-4" style={{ backgroundColor: "rgba(255,255,255,0.6)" }}>
                <RoughBorder roughness={0.7} strokeWidth={0.8} color="#e5e7eb" seed={123} />
                <p className="relative text-sm text-neutral-600 leading-relaxed line-clamp-3">{selectedVideo.description}</p>
              </div>
            )}
          </div>

          {/* Right: sidebar */}
          <aside className="hidden lg:flex lg:col-span-4 flex-col gap-3">
            {/* Section: public */}
            <div className="mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-2">Publiczne</p>
              <RoughSeparator color="#e5e7eb" />
            </div>

            {sortedVideos.filter(v => v.tier === "PUBLIC").map(v => (
              <VideoThumbnailCard key={v.id} video={v} isSelected={v.id === selectedVideo.id} />
            ))}

            {sortedVideos.filter(v => v.tier !== "PUBLIC").length > 0 && (
              <>
                <div className="mt-2 mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-2">Dla zalogowanych</p>
                  <RoughSeparator color="#e5e7eb" />
                </div>
                {sortedVideos.filter(v => v.tier !== "PUBLIC").map(v => (
                  <VideoThumbnailCard key={v.id} video={v} isSelected={v.id === selectedVideo.id} />
                ))}
              </>
            )}

            {/* Support panel */}
            <div className="relative mt-4 p-5" style={{ backgroundColor: "rgba(255,255,255,0.7)" }}>
              <RoughBorder roughness={1} strokeWidth={1.2} color="#9ca3af" seed={33} />
              <div className="relative z-10">
                <h3 className="font-bold text-neutral-900 mb-1 text-sm">Wspieraj rozwój <span className="text-blue-600">POLUTEK.PL</span></h3>
                <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
                  Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze. Bez subskrypcji.
                </p>
                <div className="relative p-3 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.8)" }}>
                  <RoughBorder roughness={0.6} strokeWidth={0.8} color="#d1d5db" seed={11} />
                  <div className="relative text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">DO PREMIERY</p>
                    <p className="text-2xl font-black text-blue-600 my-1">{countdown.split(" ")[0]}</p>
                    <p className="text-xs text-neutral-500">dni {countdown.split(" ").slice(1).join(" ")}</p>
                  </div>
                </div>
                <button className="w-full py-2.5 font-bold text-sm text-white relative">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 44" preserveAspectRatio="none">
                    <path d="M 4 5 L 276 7 L 274 39 L 6 37 Z" fill="#2563EB" stroke="#1d4ed8" strokeWidth="1" />
                  </svg>
                  <span className="relative">Wesprzyj POLUTEK.PL</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Experiment note */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="relative px-3 py-2 text-[10px] font-mono text-neutral-500 bg-white/90 backdrop-blur-sm">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 32" preserveAspectRatio="none">
            <path d="M 3 3 L 157 4 L 156 29 L 4 28 Z" fill="white" stroke="#d1d5db" strokeWidth="1" />
          </svg>
          <span className="relative">eksperyment1 — rough UI</span>
        </div>
      </div>
    </div>
  );
}
