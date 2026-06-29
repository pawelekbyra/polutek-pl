"use client";

import React, { useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { annotate } from "rough-notation";
import Link from "next/link";
import Image from "next/image";
import { PublicVideoDTO } from "@/app/types/video";

const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

type StrokePoint = [number, number, number];

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

function seededJitter(seed: number, index: number, amplitude = 2) {
  const raw = Math.sin(seed * 999 + index * 12.9898) * 43758.5453;
  return (raw - Math.floor(raw) - 0.5) * amplitude;
}

function organicStrokePath(points: StrokePoint[], size = 4, thinning = 0.55) {
  return getSvgPathFromStroke(
    getStroke(points, {
      size,
      thinning,
      smoothing: 0.52,
      streamline: 0.38,
      start: { taper: size * 1.8 },
      end: { taper: size * 1.8 },
    })
  );
}

function InkBorder({ strokeWidth = 4, color = "#1a1a1a", seed = 42, className = "", loose = false }: {
  strokeWidth?: number; color?: string; seed?: number; className?: string; loose?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = svgRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const draw = () => {
      const { width: w, height: h } = parent.getBoundingClientRect();
      if (w === 0 || h === 0) return;
      setDims({ w, h });
      el.setAttribute("width", String(w));
      el.setAttribute("height", String(h));
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const { w, h } = dims;
  const offset = 4;
  const wobble = loose ? 5 : 2.4;
  const top = organicStrokePath([
    [offset, offset + seededJitter(seed, 1, wobble), 0.45],
    [w * 0.36, offset + seededJitter(seed, 2, wobble), 0.72],
    [w - offset, offset + seededJitter(seed, 3, wobble), 0.42],
  ], strokeWidth, 0.5);
  const right = organicStrokePath([
    [w - offset + seededJitter(seed, 4, wobble), offset, 0.5],
    [w - offset + seededJitter(seed, 5, wobble), h * 0.54, 0.76],
    [w - offset + seededJitter(seed, 6, wobble), h - offset, 0.42],
  ], strokeWidth, 0.55);
  const bottom = organicStrokePath([
    [w - offset, h - offset + seededJitter(seed, 7, wobble), 0.46],
    [w * 0.56, h - offset + seededJitter(seed, 8, wobble), 0.8],
    [offset, h - offset + seededJitter(seed, 9, wobble), 0.4],
  ], strokeWidth, 0.52);
  const left = organicStrokePath([
    [offset + seededJitter(seed, 10, wobble), h - offset, 0.48],
    [offset + seededJitter(seed, 11, wobble), h * 0.48, 0.74],
    [offset + seededJitter(seed, 12, wobble), offset, 0.42],
  ], strokeWidth, 0.56);

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      width={w || "100%"}
      height={h || "100%"}
      aria-hidden="true"
    >
      {w > 0 && h > 0 && (
        <>
          <path d={`M ${offset} ${offset + 1} Q ${w / 2} ${offset - 1} ${w - offset} ${offset + 1} L ${w - offset - 1} ${h - offset} Q ${w / 2} ${h - offset + 2} ${offset} ${h - offset} L ${offset + 1} ${offset + 1}`} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.36" />
          {[top, right, bottom, left].map((d, index) => <path key={index} d={d} fill={color} opacity="0.92" />)}
        </>
      )}
    </svg>
  );
}

function InkSeparator({ color = "#d1d5db", strong = false }: { color?: string; strong?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = svgRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const draw = () => setWidth(parent.getBoundingClientRect().width || 600);
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const path = organicStrokePath([
    [1, 10, 0.36],
    [width * 0.32, 11.5, 0.7],
    [width * 0.66, 8.5, 0.62],
    [width - 1, 10.5, 0.34],
  ], strong ? 7 : 3.5, strong ? 0.7 : 0.48);

  return (
    <svg ref={svgRef} className="w-full" height={22} aria-hidden="true">
      <path d={`M 0 13 Q ${width / 2} 9 ${width} 12`} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      <path d={path} fill={color} opacity={strong ? 0.82 : 0.72} />
    </svg>
  );
}

function InkBadge({ text, variant = "public" }: { text: string; variant?: "public" | "unlocked" }) {
  const fill = variant === "unlocked" ? "#2563EB" : "#1a1a1a";
  return (
    <span className="relative inline-block text-[10px] font-black uppercase tracking-widest px-2 py-1 text-white">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 22" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 4 4 Q 40 1 76 4 L 75 18 Q 40 21 5 18 Z" fill={fill} opacity="0.96" />
        <path d="M 4 5 Q 39 2 76 4 M 75 18 Q 38 20 5 18" fill="none" stroke="white" strokeWidth="0.45" opacity="0.45" />
      </svg>
      <span className="relative">{text}</span>
    </span>
  );
}

function InkButton({ children, href, filled = false, blue = false, className = "" }: {
  children: React.ReactNode; href?: string; filled?: boolean; blue?: boolean; className?: string;
}) {
  const fillColor = blue ? "#2563EB" : filled ? "#1a1a1a" : "rgba(253,251,247,0.92)";
  const strokeColor = blue ? "#1d4ed8" : "#1a1a1a";
  const textColor = filled || blue ? "white" : "#1a1a1a";

  const inner = (
    <span className={`group relative inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${className}`} style={{ color: textColor }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 130 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 7 7 Q 66 2 124 7 L 121 34 Q 66 38 8 33 Z" fill={fillColor} />
        <path d="M 7 8 Q 66 3 124 7 M 122 34 Q 66 38 8 33 M 8 33 Q 5 20 7 8" fill="none" stroke={strokeColor} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 12 31 Q 64 35 118 31" fill="none" stroke={strokeColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.24" />
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
  const selectedPath = organicStrokePath([[1, 2, 0.35], [3, 36, 0.8], [1, 72, 0.35]], 5, 0.7);

  return (
    <div className={`group cursor-pointer flex gap-3 p-2 relative transition-colors ${isSelected ? "bg-neutral-900/5" : "hover:bg-neutral-900/3"}`}>
      {isSelected && (
        <div className="absolute left-0 top-2 bottom-2 w-2">
          <svg width="8" height="100%" className="h-full" viewBox="0 0 8 74" preserveAspectRatio="none" aria-hidden="true">
            <path d={selectedPath} fill="#1a1a1a" />
          </svg>
        </div>
      )}
      <div className="relative w-28 aspect-video shrink-0">
        <div className="absolute inset-0">
          <InkBorder strokeWidth={2.5} color="#9ca3af" seed={video.id.charCodeAt(0)} />
        </div>
        {video.thumbnailUrl ? (
          <Image src={video.thumbnailUrl} alt={displayTitle} fill className="object-cover absolute inset-[4px]" sizes="112px" />
        ) : (
          <div className="absolute inset-[4px] bg-neutral-200 flex items-center justify-center text-[9px] text-neutral-400">Video</div>
        )}
        <div className="absolute bottom-1 left-0 right-0 flex justify-between px-1 z-10">
          <InkBadge text={isPublic ? "PUBL." : "ODBL."} variant={isPublic ? "public" : "unlocked"} />
        </div>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-xs font-black text-neutral-900 leading-tight line-clamp-2 uppercase tracking-tight">{displayTitle}</p>
        <p className="text-[10px] text-neutral-400 mt-1">{video.views} wyświetleń</p>
      </div>
    </div>
  );
}

function AnnotatedHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, { type: "underline", color: "#2563eb", strokeWidth: 4, animate: true, padding: 3 });
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
    <div className="min-h-screen relative text-neutral-900" style={{ backgroundColor: "#fdfbf7" }}>
      {/* Paper noise */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: PAPER_NOISE, opacity: 0.055 }} />
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(#111 0.7px, transparent 0.7px)", backgroundSize: "18px 18px" }} />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#fdfbf7]/92 backdrop-blur-md px-4 lg:px-6 h-[62px] flex items-center justify-between gap-4 relative">
        <div className="absolute inset-x-0 bottom-0"><InkSeparator color="#d1d5db" /></div>
        <div className="font-black text-xl uppercase tracking-tighter text-neutral-900 relative">
          POLUTEK<span className="text-blue-600">.PL</span>
          <svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 2 7 Q 58 2 118 7" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
          </svg>
        </div>

        <div className="flex-1 max-w-lg mx-4 relative hidden md:block">
          <input
            readOnly
            placeholder="Szukaj..."
            className="w-full pl-3 pr-10 py-2 text-sm bg-transparent font-medium placeholder:text-neutral-400"
            style={{ outline: "none" }}
          />
          <InkBorder strokeWidth={2.2} color="#d1d5db" seed={8} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">⌕</span>
        </div>

        <div className="flex items-center gap-2">
          <InkButton>PL</InkButton>
          <InkButton>EN</InkButton>
          <InkButton href="/" filled>→ WEJŚCIE</InkButton>
        </div>
      </nav>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-7">
        <div className="grid grid-cols-12 gap-6">

          {/* Left: video player area */}
          <div className="col-span-12 lg:col-span-8">
            {/* Player */}
            <div className="relative aspect-video mb-4 rotate-[-0.15deg]">
              <InkBorder strokeWidth={4.2} color="#374151" seed={99} loose />
              <div className="absolute inset-[6px] bg-neutral-900 overflow-hidden">
                {selectedVideo.thumbnailUrl ? (
                  <Image src={selectedVideo.thumbnailUrl} alt={selectedVideo.title} fill className="object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl">▶</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 relative transition-transform hover:scale-105">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64" aria-hidden="true">
                      <path d="M 7 7 Q 33 2 58 8 L 56 56 Q 30 61 8 55 Z" fill="rgba(255,255,255,0.92)" />
                      <path d="M 8 8 Q 32 3 58 8 M 56 56 Q 31 60 8 55 M 8 55 Q 4 30 8 8" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M 24 20 Q 35 27 45 32 Q 35 38 24 44 Z" fill="#1a1a1a" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-neutral-900 mb-2 leading-tight">
              <AnnotatedHeading>{selectedVideo.title}</AnnotatedHeading>
            </h1>

            <InkSeparator color="#e5e7eb" strong />

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 relative rounded-full overflow-hidden bg-neutral-200 ring-2 ring-neutral-900/10">
                  {selectedVideo.creator?.imageUrl && (
                    <Image src={selectedVideo.creator.imageUrl} alt="avatar" fill className="object-cover" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-black text-neutral-900">{selectedVideo.creator?.name || "Paweł Polutek"}</p>
                  <p className="text-xs text-neutral-400">{selectedVideo.creator?.subscribersCount || 0} subskrybentów</p>
                </div>
              </div>

              <InkButton filled className="ml-1">🔔 Subskrybuj</InkButton>

              <div className="flex items-center gap-1 ml-auto">
                <InkButton>👍</InkButton>
                <InkButton>👎</InkButton>
                <InkButton>→ Szeruj</InkButton>
                <InkButton>•••</InkButton>
              </div>
            </div>

            <InkSeparator color="#e5e7eb" />

            {/* Description */}
            {selectedVideo.description && (
              <div className="mt-3 relative p-4" style={{ backgroundColor: "rgba(255,255,255,0.58)" }}>
                <InkBorder strokeWidth={2.2} color="#e5e7eb" seed={123} />
                <p className="relative text-sm text-neutral-600 leading-relaxed line-clamp-3">{selectedVideo.description}</p>
              </div>
            )}
          </div>

          {/* Right: sidebar */}
          <aside className="hidden lg:flex lg:col-span-4 flex-col gap-3">
            {/* Section: public */}
            <div className="mb-1">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-2">Publiczne</p>
              <InkSeparator color="#e5e7eb" />
            </div>

            {sortedVideos.filter(v => v.tier === "PUBLIC").map(v => (
              <VideoThumbnailCard key={v.id} video={v} isSelected={v.id === selectedVideo.id} />
            ))}

            {sortedVideos.filter(v => v.tier !== "PUBLIC").length > 0 && (
              <>
                <div className="mt-2 mb-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-2">Dla zalogowanych</p>
                  <InkSeparator color="#e5e7eb" />
                </div>
                {sortedVideos.filter(v => v.tier !== "PUBLIC").map(v => (
                  <VideoThumbnailCard key={v.id} video={v} isSelected={v.id === selectedVideo.id} />
                ))}
              </>
            )}

            {/* Support panel */}
            <div className="relative mt-4 p-5 rotate-[0.2deg]" style={{ backgroundColor: "rgba(255,255,255,0.68)" }}>
              <InkBorder strokeWidth={3.2} color="#9ca3af" seed={33} loose />
              <div className="relative z-10">
                <h3 className="font-black text-neutral-900 mb-1 text-sm">Wspieraj rozwój <span className="text-blue-600">POLUTEK.PL</span></h3>
                <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
                  Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze. Bez subskrypcji.
                </p>
                <div className="relative p-3 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.8)" }}>
                  <InkBorder strokeWidth={2.2} color="#d1d5db" seed={11} />
                  <div className="relative text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">DO PREMIERY</p>
                    <p className="text-2xl font-black text-blue-600 my-1">{countdown.split(" ")[0]}</p>
                    <p className="text-xs text-neutral-500">dni {countdown.split(" ").slice(1).join(" ")}</p>
                  </div>
                </div>
                <button className="w-full py-2.5 font-black text-sm text-white relative transition-transform hover:-translate-y-0.5">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 44" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M 6 7 Q 138 1 274 7 L 272 38 Q 138 43 7 37 Z" fill="#2563EB" />
                    <path d="M 6 8 Q 140 2 274 7 M 272 38 Q 138 43 7 37" fill="none" stroke="#1d4ed8" strokeWidth="1.2" strokeLinecap="round" />
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
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 175 32" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 4 5 Q 87 1 171 5 L 169 28 Q 86 31 5 27 Z" fill="white" stroke="#d1d5db" strokeWidth="1" />
          </svg>
          <span className="relative">eksperyment1 — kreski L6–L9</span>
        </div>
      </div>
    </div>
  );
}
