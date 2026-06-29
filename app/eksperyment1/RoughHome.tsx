"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { annotate } from "rough-notation";
import Link from "next/link";
import Image from "next/image";
import { PublicVideoDTO } from "@/app/types/video";

const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const HAND_FONT = '"Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive';
const INK = "#151515";
const PAPER = "#f8f3e7";
const BLUE = "#2563eb";

type StrokePoint = [number, number, number];
type IconName = "search" | "login" | "bell" | "like" | "dislike" | "send" | "more" | "pause" | "lock";

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

function jitter(seed: number, index: number, amplitude = 1.5) {
  const raw = Math.sin(seed * 92821 + index * 1367.31) * 43758.5453;
  return (raw - Math.floor(raw) - 0.5) * amplitude;
}

function organicStrokePath(points: StrokePoint[], size = 3, thinning = 0.48) {
  return getSvgPathFromStroke(
    getStroke(points, {
      size,
      thinning,
      smoothing: 0.62,
      streamline: 0.42,
      start: { taper: size * 1.5 },
      end: { taper: size * 1.5 },
    })
  );
}

function useElementSize<T extends SVGSVGElement>() {
  const ref = useRef<T>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const update = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (!width || !height) return;
      setDims({ w: width, h: height });
      el.setAttribute("width", String(width));
      el.setAttribute("height", String(height));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return { ref, dims };
}

function roundedSketchPath(w: number, h: number, radius: number, seed: number, inset = 2, wobble = 1.8) {
  const l = inset + jitter(seed, 1, wobble);
  const t = inset + jitter(seed, 2, wobble);
  const r = Math.max(l + radius * 2, w - inset + jitter(seed, 3, wobble));
  const b = Math.max(t + radius * 2, h - inset + jitter(seed, 4, wobble));
  const rad = Math.min(radius, (r - l) / 2 - 1, (b - t) / 2 - 1);

  return [
    `M ${l + rad + jitter(seed, 5, wobble)} ${t + jitter(seed, 6, wobble)}`,
    `Q ${l + jitter(seed, 7, wobble)} ${t + jitter(seed, 8, wobble)} ${l + jitter(seed, 9, wobble)} ${t + rad + jitter(seed, 10, wobble)}`,
    `L ${l + jitter(seed, 11, wobble)} ${b - rad + jitter(seed, 12, wobble)}`,
    `Q ${l + jitter(seed, 13, wobble)} ${b + jitter(seed, 14, wobble)} ${l + rad + jitter(seed, 15, wobble)} ${b + jitter(seed, 16, wobble)}`,
    `L ${r - rad + jitter(seed, 17, wobble)} ${b + jitter(seed, 18, wobble)}`,
    `Q ${r + jitter(seed, 19, wobble)} ${b + jitter(seed, 20, wobble)} ${r + jitter(seed, 21, wobble)} ${b - rad + jitter(seed, 22, wobble)}`,
    `L ${r + jitter(seed, 23, wobble)} ${t + rad + jitter(seed, 24, wobble)}`,
    `Q ${r + jitter(seed, 25, wobble)} ${t + jitter(seed, 26, wobble)} ${r - rad + jitter(seed, 27, wobble)} ${t + jitter(seed, 28, wobble)}`,
    "Z",
  ].join(" ");
}

function SketchFrame({
  radius = 20,
  seed = 1,
  stroke = INK,
  strokeWidth = 1.45,
  fill = "transparent",
  children,
  className = "",
  shade = false,
}: {
  radius?: number;
  seed?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  children?: React.ReactNode;
  className?: string;
  shade?: boolean;
}) {
  const { ref, dims } = useElementSize<SVGSVGElement>();
  const path = dims.w && dims.h ? roundedSketchPath(dims.w, dims.h, radius, seed, 3, 1.25) : "";
  const echoPath = dims.w && dims.h ? roundedSketchPath(dims.w, dims.h, radius + 1, seed + 42, 4, 0.8) : "";

  return (
    <>
      <svg ref={ref} className={`absolute inset-0 h-full w-full pointer-events-none ${className}`} aria-hidden="true">
        {path && (
          <>
            <path d={path} fill={fill} stroke="none" />
            {shade && (
              <g opacity="0.12" stroke={stroke} strokeWidth="0.8" strokeLinecap="round">
                {Array.from({ length: 12 }).map((_, index) => (
                  <path key={index} d={`M ${8 + index * 14} ${dims.h - 9} L ${28 + index * 14} ${dims.h - 23}`} />
                ))}
              </g>
            )}
            <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d={echoPath} fill="none" stroke={stroke} strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.34" />
          </>
        )}
      </svg>
      {children}
    </>
  );
}

function InkSeparator({ color = INK, strong = false, label }: { color?: string; strong?: boolean; label?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = svgRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const update = () => setWidth(parent.getBoundingClientRect().width || 600);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const leftEnd = label ? width * 0.36 : width - 2;
  const rightStart = label ? width * 0.64 : width - 2;
  const left = organicStrokePath([[2, 11, 0.38], [leftEnd * 0.55, 9.4, 0.74], [leftEnd, 11.2, 0.42]], strong ? 3.8 : 2.4, 0.45);
  const right = organicStrokePath([[rightStart, 11, 0.38], [width * 0.82, 10, 0.7], [width - 2, 11.2, 0.38]], strong ? 3.8 : 2.4, 0.45);

  return (
    <div className="relative h-7 w-full">
      <svg ref={svgRef} className="absolute inset-0 h-full w-full" height={28} aria-hidden="true">
        <path d={left} fill={color} opacity={strong ? 0.9 : 0.72} />
        {label && <path d={right} fill={color} opacity={strong ? 0.9 : 0.72} />}
      </svg>
      {label && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] bg-[#f8f3e7] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-800">
          {label}
        </span>
      )}
    </div>
  );
}

function SketchIcon({ name, className = "h-5 w-5", stroke = "currentColor" }: { name: IconName; className?: string; stroke?: string }) {
  const common = { fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {name === "search" && <><circle cx="10" cy="10" r="6.4" {...common} /><path d="M15 15.5 L21 21" {...common} /></>}
      {name === "login" && <><path d="M4 5 h8 M4 19 h8 M12 5 v4 M12 15 v4" {...common} /><path d="M10 12 h10 M16 8 l4 4 -4 4" {...common} /></>}
      {name === "bell" && <><path d="M7 10 c0 -4 2 -6 5 -6 s5 2 5 6 v4 l2 3 H5 l2 -3 Z" {...common} /><path d="M10 20 c1.3 1 2.7 1 4 0" {...common} /></>}
      {name === "like" && <><path d="M7 20 H4 V10 h3 Z" {...common} /><path d="M7 10 l4 -6 c1 -1 2 0.2 1.6 1.6 L12 9 h6 c1.4 0 2.2 1.1 1.8 2.4 l-1.2 5.2 C18.3 18.3 17.3 20 15 20 H7" {...common} /></>}
      {name === "dislike" && <><path d="M7 4 H4 v10 h3 Z" {...common} /><path d="M7 14 l4 6 c1 1 2 -0.2 1.6 -1.6 L12 15 h6 c1.4 0 2.2 -1.1 1.8 -2.4 L18.6 7.4 C18.3 5.7 17.3 4 15 4 H7" {...common} /></>}
      {name === "send" && <><path d="M3 12 L21 4 L16 21 L11 14 Z" {...common} /><path d="M11 14 L21 4" {...common} /></>}
      {name === "more" && <><circle cx="6" cy="12" r="1.2" fill={stroke} /><circle cx="12" cy="12" r="1.2" fill={stroke} /><circle cx="18" cy="12" r="1.2" fill={stroke} /></>}
      {name === "pause" && <><path d="M8 6 v12" {...common} strokeWidth={4} /><path d="M16 6 v12" {...common} strokeWidth={4} /></>}
      {name === "lock" && <><path d="M7 11 V8 c0 -3 2 -5 5 -5 s5 2 5 5 v3" {...common} /><path d="M6 11 h12 v9 H6 Z" {...common} /><path d="M12 15 v2" {...common} /></>}
    </svg>
  );
}

function InkButton({ children, href, filled = false, blue = false, icon, compact = false, className = "" }: {
  children?: React.ReactNode;
  href?: string;
  filled?: boolean;
  blue?: boolean;
  icon?: IconName;
  compact?: boolean;
  className?: string;
}) {
  const fill = blue ? BLUE : filled ? INK : "rgba(248,243,231,0.9)";
  const stroke = blue ? "#1748b8" : INK;
  const text = filled || blue ? "#fff" : INK;
  const body = (
    <span
      className={`relative inline-flex min-h-[38px] items-center justify-center gap-2 px-4 text-[15px] font-black leading-none tracking-wide transition-transform hover:-translate-y-0.5 active:translate-y-0 ${compact ? "min-w-[42px] px-3" : ""} ${className}`}
      style={{ color: text }}
    >
      <SketchFrame radius={19} seed={filled ? 41 : blue ? 44 : 39} stroke={stroke} strokeWidth={1.35} fill={fill} shade={filled || blue} />
      {icon && <SketchIcon name={icon} className="relative h-5 w-5" />}
      {children && <span className="relative">{children}</span>}
    </span>
  );

  if (href) return <Link href={href}>{body}</Link>;
  return <button type="button">{body}</button>;
}

function SegmentedLanguage() {
  return (
    <div className="relative flex h-[38px] items-center gap-0 px-1 text-sm font-black">
      <SketchFrame radius={19} seed={52} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,0.8)" />
      <button type="button" className="relative rounded-full px-3 py-2 text-neutral-900">PL</button>
      <span className="relative h-5 w-px bg-neutral-900/35" />
      <button type="button" className="relative rounded-full px-3 py-2 text-neutral-700">EN</button>
    </div>
  );
}

function SketchBadge({ text, variant = "public" }: { text: string; variant?: "public" | "unlocked" }) {
  const unlocked = variant === "unlocked";
  return (
    <span className="relative inline-flex min-h-[22px] items-center gap-1 px-2.5 text-[10px] font-black uppercase tracking-widest text-white">
      <SketchFrame radius={8} seed={unlocked ? 73 : 71} stroke={unlocked ? "#1748b8" : INK} strokeWidth={1.1} fill={unlocked ? BLUE : INK} shade />
      {unlocked && <SketchIcon name="lock" className="relative h-3.5 w-3.5" stroke="white" />}
      <span className="relative">{text}</span>
    </span>
  );
}

function CounterButton({ icon, value }: { icon: IconName; value?: number }) {
  return (
    <span className="relative inline-flex h-[38px] items-center gap-2 px-3 text-sm font-black">
      <SketchFrame radius={18} seed={84 + (value || 0)} stroke={INK} strokeWidth={1.15} fill="rgba(248,243,231,0.82)" />
      <SketchIcon name={icon} className="relative h-5 w-5" />
      {typeof value === "number" && <span className="relative min-w-3">{value}</span>}
    </span>
  );
}

function VideoThumbnailCard({ video, isSelected = false }: { video: PublicVideoDTO; isSelected?: boolean }) {
  const isPublic = video.tier === "PUBLIC";
  const displayTitle = video.title;
  const href = `/eksperyment1?v=${encodeURIComponent(video.id)}`;

  return (
    <Link href={href} className="group block">
      <article className={`relative flex gap-3 p-2.5 transition-transform group-hover:-translate-y-0.5 ${isSelected ? "rotate-[-0.25deg]" : ""}`}>
        <SketchFrame radius={14} seed={video.id.charCodeAt(0) + 10} stroke={isSelected ? INK : "#4b5563"} strokeWidth={isSelected ? 1.6 : 1.15} fill="rgba(248,243,231,0.74)" />
        <div className="relative w-[128px] shrink-0 overflow-hidden rounded-[12px]">
          <div className="relative aspect-video w-full">
            <SketchFrame radius={10} seed={video.id.charCodeAt(0) + 20} stroke={INK} strokeWidth={1.05} fill="rgba(255,255,255,0.35)" />
            {video.thumbnailUrl ? (
              <Image src={video.thumbnailUrl} alt={displayTitle} fill className="absolute inset-[3px] object-cover" sizes="128px" />
            ) : (
              <div className="absolute inset-[3px] flex items-center justify-center bg-neutral-200 text-[9px] text-neutral-400">Video</div>
            )}
            <div className="absolute bottom-1 left-1 z-10">
              <SketchBadge text={isPublic ? "PUBLICZNE" : "ODBLOKOWANE"} variant={isPublic ? "public" : "unlocked"} />
            </div>
          </div>
        </div>
        <div className="relative min-w-0 flex-1 py-1 pr-1">
          <h3 className="line-clamp-2 text-[17px] font-black leading-tight tracking-wide text-neutral-950">{displayTitle}</h3>
          <p className="mt-2 text-[13px] font-bold leading-tight text-neutral-700">{video.creator?.name || "Paweł Polutek"}</p>
          <p className="mt-1 text-[13px] font-bold leading-tight text-neutral-600">{video.views ?? 0} wyświetleń</p>
        </div>
      </article>
    </Link>
  );
}

function AnnotatedHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const annotation = annotate(ref.current, {
      type: "underline",
      color: BLUE,
      strokeWidth: 3,
      animate: true,
      padding: 3,
    });
    annotation.show();
    return () => annotation.remove();
  }, []);

  return <span ref={ref}>{children}</span>;
}

interface RoughHomeProps {
  mainVideo: PublicVideoDTO;
  allVideos: PublicVideoDTO[];
  currentVideoId?: string;
}

export default function RoughHome({ mainVideo, allVideos, currentVideoId }: RoughHomeProps) {
  const selectedVideo = allVideos.find((video) => video.id === currentVideoId) || mainVideo;
  const [countdown, setCountdown] = useState("105 dni 00:00:00");

  useEffect(() => {
    const target = new Date("2026-10-13T00:00:00+02:00");
    const update = () => {
      const ms = target.getTime() - Date.now();
      if (ms <= 0) {
        setCountdown("Premiera dostępna");
        return;
      }
      const seconds = Math.floor(ms / 1000);
      const days = Math.floor(seconds / 86400);
      const pad = (value: number) => value.toString().padStart(2, "0");
      setCountdown(`${days} dni ${pad(Math.floor((seconds % 86400) / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const sortedVideos = useMemo(() => [...allVideos].slice(0, 8), [allVideos]);
  const publicVideos = sortedVideos.filter((video) => video.tier === "PUBLIC");
  const unlockedVideos = sortedVideos.filter((video) => video.tier !== "PUBLIC");
  const countdownParts = countdown.split(" ");

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-neutral-950 selection:bg-yellow-200/80"
      style={{ backgroundColor: PAPER, fontFamily: HAND_FONT }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: PAPER_NOISE, opacity: 0.07 }} />
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.035]" style={{ backgroundImage: "radial-gradient(#111 0.65px, transparent 0.65px)", backgroundSize: "22px 22px" }} />
      <div className="fixed inset-[3px] z-0 pointer-events-none">
        <SketchFrame radius={7} seed={700} stroke={INK} strokeWidth={1.15} fill="transparent" />
      </div>

      <nav className="sticky top-0 z-40 bg-[#f8f3e7]/92 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="mx-auto flex max-w-[1540px] items-center gap-4">
          <Link href="/" className="relative shrink-0 pr-4 text-[26px] font-black uppercase tracking-[-0.06em] leading-none md:text-[31px]">
            POLUTEK<span className="text-blue-600">.PL</span>
            <span className="relative -top-3 ml-1 inline-flex text-[10px] tracking-wide text-neutral-800">BETA</span>
            <svg className="absolute -bottom-2 left-0 h-3 w-[72%]" viewBox="0 0 160 12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 2 8 Q 78 2 158 7" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>

          <div className="relative mx-auto hidden h-[50px] max-w-[610px] flex-1 items-center md:flex">
            <SketchFrame radius={22} seed={18} stroke={INK} strokeWidth={1.35} fill="rgba(248,243,231,0.88)" />
            <input
              readOnly
              placeholder="Szukaj"
              className="relative h-full w-full bg-transparent px-7 pr-[72px] text-[21px] font-bold outline-none placeholder:text-neutral-700/75"
            />
            <span className="absolute right-[58px] top-2.5 h-[30px] w-px bg-neutral-900/35" />
            <SketchIcon name="search" className="absolute right-5 top-1/2 h-7 w-7 -translate-y-1/2" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <SegmentedLanguage />
            <span className="hidden h-7 w-px bg-neutral-900/45 sm:block" />
            <InkButton href="/" icon="login">WEJŚCIE</InkButton>
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-[1540px]">
          <InkSeparator color={INK} />
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-[1340px] px-4 pb-8 pt-5 md:px-6">
        <div className="grid grid-cols-12 gap-7">
          <section className="col-span-12 lg:col-span-8">
            <div className="relative aspect-video rotate-[-0.12deg] overflow-visible">
              <SketchFrame radius={18} seed={101} stroke={INK} strokeWidth={1.7} fill="rgba(255,255,255,0.12)" />
              <div className="absolute inset-[7px] overflow-hidden rounded-[15px] bg-neutral-950">
                {selectedVideo.thumbnailUrl ? (
                  <Image src={selectedVideo.thumbnailUrl} alt={selectedVideo.title} fill className="object-cover" priority />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl text-white/25">▶</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/12 via-transparent to-black/8" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative flex h-[72px] w-[92px] items-center justify-center text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                    <SketchIcon name="pause" className="h-16 w-20" stroke="white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <h1 className="text-[34px] font-black leading-none tracking-[-0.035em] text-neutral-950 md:text-[42px]">
                  <AnnotatedHeading>{selectedVideo.title}</AnnotatedHeading>
                </h1>
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-200">
                    <SketchFrame radius={24} seed={121} stroke={INK} strokeWidth={1.3} fill="transparent" />
                    {selectedVideo.creator?.imageUrl && (
                      <Image src={selectedVideo.creator.imageUrl} alt="avatar" fill className="object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="text-[22px] font-black leading-none">{selectedVideo.creator?.name || "Paweł Polutek"}</p>
                    <p className="mt-1 text-[17px] font-bold leading-none text-neutral-700">{selectedVideo.creator?.subscribersCount || 0} subskrybentów</p>
                  </div>
                  <InkButton filled icon="bell" className="ml-2">Subskrajb</InkButton>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <div className="relative inline-flex h-[38px] items-center overflow-hidden rounded-full">
                  <SketchFrame radius={18} seed={143} stroke={INK} strokeWidth={1.15} fill="rgba(248,243,231,0.88)" />
                  <CounterButton icon="like" value={1} />
                  <span className="relative h-6 w-px bg-neutral-900/35" />
                  <CounterButton icon="dislike" value={0} />
                </div>
                <InkButton icon="send">Szeruj</InkButton>
                <InkButton icon="more" compact />
              </div>
            </div>

            <div className="mt-5">
              <InkSeparator color={INK} label="OPIS" />
            </div>

            {selectedVideo.description && (
              <div className="relative mt-3 p-5 text-[19px] font-bold leading-relaxed text-neutral-800">
                <SketchFrame radius={20} seed={177} stroke="#555" strokeWidth={1.05} fill="rgba(255,255,255,0.2)" />
                <p className="relative line-clamp-3">{selectedVideo.description}</p>
              </div>
            )}
          </section>

          <aside className="col-span-12 hidden lg:block">
            <div className="space-y-5">
              <section>
                <h2 className="mb-1 text-[24px] font-black uppercase tracking-[0.08em]">Publiczne</h2>
                <InkSeparator color={INK} />
                <div className="mt-3 space-y-4">
                  {publicVideos.map((video) => (
                    <VideoThumbnailCard key={video.id} video={video} isSelected={video.id === selectedVideo.id} />
                  ))}
                </div>
              </section>

              {unlockedVideos.length > 0 && (
                <section>
                  <h2 className="mb-1 text-[24px] font-black uppercase tracking-[0.08em]">Dla zalogowanych</h2>
                  <InkSeparator color={INK} />
                  <div className="mt-3 space-y-4">
                    {unlockedVideos.map((video) => (
                      <VideoThumbnailCard key={video.id} video={video} isSelected={video.id === selectedVideo.id} />
                    ))}
                  </div>
                </section>
              )}

              <section className="relative p-5">
                <SketchFrame radius={18} seed={211} stroke={INK} strokeWidth={1.25} fill="rgba(248,243,231,0.74)" />
                <div className="relative">
                  <h2 className="text-[24px] font-black leading-none tracking-wide">Wspieraj rozwój POLUTEK.PL</h2>
                  <p className="mt-4 text-[18px] font-bold leading-relaxed text-neutral-800">
                    Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze. Bez subskrypcji.
                  </p>
                  <div className="relative mt-4 p-4 text-center">
                    <SketchFrame radius={12} seed={229} stroke={INK} strokeWidth={1.05} fill="rgba(255,255,255,0.28)" />
                    <p className="relative text-[13px] font-black uppercase tracking-[0.28em]">Do premiery</p>
                    <p className="relative mt-1 text-[36px] font-black leading-none text-blue-600">
                      {countdownParts[0]} <span className="text-[18px] text-neutral-900">dni</span>
                      <span className="ml-3 text-[24px] text-neutral-900">{countdownParts.slice(2).join(" ")}</span>
                    </p>
                  </div>
                  <div className="mt-4">
                    <InkButton blue className="h-[50px] w-full text-[22px]">Wesprzyj POLUTEK.PL</InkButton>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed bottom-4 right-4 z-50 hidden sm:block">
        <div className="relative px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-600">
          <SketchFrame radius={10} seed={301} stroke="#a3a3a3" strokeWidth={1} fill="rgba(248,243,231,0.88)" />
          <span className="relative">eksperyment1 — papier + cienkopis</span>
        </div>
      </div>
    </div>
  );
}
