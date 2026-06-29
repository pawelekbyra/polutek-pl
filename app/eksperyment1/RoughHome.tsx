"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import Link from "next/link";
import Image from "next/image";
import { PublicVideoDTO } from "@/app/types/video";

const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const INK = "#171717";
const PAPER = "#f8f3e7";
const BLUE = "#2563eb";
const HAND_FONT = '"Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive';

type Icon = "search" | "login" | "bell" | "like" | "dislike" | "send" | "more" | "pause" | "lock";

function useParentSize<T extends SVGSVGElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const svg = ref.current;
    const parent = svg?.parentElement;
    if (!svg || !parent) return;
    const read = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (!width || !height) return;
      setSize({ w: width, h: height });
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

function wobble(seed: number, i: number, amp = 1.4) {
  const n = Math.sin(seed * 701 + i * 89.7) * 10000;
  return (n - Math.floor(n) - 0.5) * amp;
}

function roundedPath(w: number, h: number, r: number, seed: number) {
  const l = 3 + wobble(seed, 1), t = 3 + wobble(seed, 2), rr = w - 3 + wobble(seed, 3), b = h - 3 + wobble(seed, 4);
  const rad = Math.min(r, (rr - l) / 2 - 1, (b - t) / 2 - 1);
  return `M ${l + rad} ${t} Q ${l} ${t} ${l} ${t + rad} L ${l} ${b - rad} Q ${l} ${b} ${l + rad} ${b} L ${rr - rad} ${b} Q ${rr} ${b} ${rr} ${b - rad} L ${rr} ${t + rad} Q ${rr} ${t} ${rr - rad} ${t} Z`;
}

function Frame({ radius = 14, seed = 1, stroke = INK, strokeWidth = 1.2, fill = "transparent", shade = false }: { radius?: number; seed?: number; stroke?: string; strokeWidth?: number; fill?: string; shade?: boolean }) {
  const { ref, size } = useParentSize<SVGSVGElement>();
  const d = size.w && size.h ? roundedPath(size.w, size.h, radius, seed) : "";
  const d2 = size.w && size.h ? roundedPath(size.w, size.h, radius + 1, seed + 50) : "";
  return (
    <svg ref={ref} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
      {d && <><path d={d} fill={fill} />{shade && <g opacity=".12" stroke={stroke} strokeWidth=".8">{Array.from({ length: 12 }).map((_, i) => <path key={i} d={`M ${7 + i * 16} ${size.h - 7} L ${27 + i * 16} ${size.h - 21}`} />)}</g>}<path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /><path d={d2} fill="none" stroke={stroke} strokeWidth=".65" opacity=".28" /></>}
    </svg>
  );
}

function N4Highlight({ color, opacity = .7, seed = 1 }: { color: string; opacity?: number; seed?: number }) {
  const { ref, size } = useParentSize<SVGSVGElement>();
  const { w, h } = size;
  const d = w && h ? `M ${7 + wobble(seed, 1, 2)} ${8 + wobble(seed, 2, 2)} Q ${w / 2} ${2 + wobble(seed, 3, 2)} ${w - 7 + wobble(seed, 4, 2)} ${8 + wobble(seed, 5, 2)} L ${w - 8 + wobble(seed, 6, 2)} ${h - 7 + wobble(seed, 7, 2)} Q ${w / 2} ${h - 2 + wobble(seed, 8, 2)} ${7 + wobble(seed, 9, 2)} ${h - 8 + wobble(seed, 10, 2)} Z` : "";
  return <svg ref={ref} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">{d && <path d={d} fill={color} opacity={opacity} />}</svg>;
}

function HachureFill({ fill = BLUE, stroke = "#1748b8", seed = 1 }: { fill?: string; stroke?: string; seed?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current, parent = svg?.parentElement;
    if (!svg || !parent) return;
    const draw = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (!width || !height) return;
      svg.innerHTML = "";
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.appendChild(rough.svg(svg).rectangle(4, 4, width - 8, height - 8, { seed, roughness: 1.15, bowing: 1.2, stroke, strokeWidth: 1, fill, fillStyle: "hachure", fillWeight: 1.45, hachureGap: 4 }));
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [fill, seed, stroke]);
  return <svg ref={ref} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true" />;
}

function Separator({ label }: { label?: string }) {
  return <div className="relative h-5 w-full"><svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 20" preserveAspectRatio="none" aria-hidden="true"><path d={label ? "M 0 10 Q 115 8 220 10 M 380 10 Q 495 8 600 10" : "M 0 10 Q 300 8 600 10"} fill="none" stroke={INK} strokeWidth="1.25" strokeLinecap="round" opacity=".72" /></svg>{label && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#f8f3e7] px-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-700">{label}</span>}</div>;
}

function I({ name, className = "h-5 w-5", stroke = "currentColor" }: { name: Icon; className?: string; stroke?: string }) {
  const c = { fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{name === "search" && <><circle cx="10" cy="10" r="6.3" {...c} /><path d="M15 15.5 L21 21" {...c} /></>}{name === "login" && <><path d="M4 5 h8 M4 19 h8 M12 5 v4 M12 15 v4" {...c} /><path d="M10 12 h10 M16 8 l4 4 -4 4" {...c} /></>}{name === "bell" && <><path d="M7 10 c0 -4 2 -6 5 -6 s5 2 5 6 v4 l2 3 H5 l2 -3 Z" {...c} /><path d="M10 20 c1.3 1 2.7 1 4 0" {...c} /></>}{name === "like" && <><path d="M7 20 H4 V10 h3 Z" {...c} /><path d="M7 10 l4 -6 c1 -1 2 .2 1.6 1.6 L12 9 h6 c1.4 0 2.2 1.1 1.8 2.4 l-1.2 5.2 C18.3 18.3 17.3 20 15 20 H7" {...c} /></>}{name === "dislike" && <><path d="M7 4 H4 v10 h3 Z" {...c} /><path d="M7 14 l4 6 c1 1 2 -.2 1.6 -1.6 L12 15 h6 c1.4 0 2.2 -1.1 1.8 -2.4 L18.6 7.4 C18.3 5.7 17.3 4 15 4 H7" {...c} /></>}{name === "send" && <><path d="M3 12 L21 4 L16 21 L11 14 Z" {...c} /><path d="M11 14 L21 4" {...c} /></>}{name === "more" && <><circle cx="6" cy="12" r="1.2" fill={stroke} /><circle cx="12" cy="12" r="1.2" fill={stroke} /><circle cx="18" cy="12" r="1.2" fill={stroke} /></>}{name === "pause" && <><path d="M8 6 v12" {...c} strokeWidth={4} /><path d="M16 6 v12" {...c} strokeWidth={4} /></>}{name === "lock" && <><path d="M7 11 V8 c0 -3 2 -5 5 -5 s5 2 5 5 v3" {...c} /><path d="M6 11 h12 v9 H6 Z" {...c} /></>}</svg>;
}

function Btn({ children, href, filled = false, icon, compact = false, className = "" }: { children?: React.ReactNode; href?: string; filled?: boolean; icon?: Icon; compact?: boolean; className?: string }) {
  const body = <span className={`relative inline-flex min-h-9 items-center justify-center gap-2 px-3.5 text-sm font-black leading-none tracking-wide transition-transform hover:-translate-y-0.5 ${compact ? "min-w-9 px-2.5" : ""} ${className}`} style={{ color: filled ? "white" : INK }}><Frame radius={18} seed={filled ? 41 : 39} stroke={INK} strokeWidth={1.2} fill={filled ? INK : "rgba(248,243,231,.88)"} shade={filled} />{icon && <I name={icon} className="relative h-5 w-5" />}{children && <span className="relative">{children}</span>}</span>;
  return href ? <Link href={href}>{body}</Link> : <button type="button">{body}</button>;
}

function SupportButton() {
  return <button type="button" className="relative h-12 w-full overflow-hidden text-base font-black text-white transition-transform hover:-translate-y-0.5"><N4Highlight color="#4f83ff" opacity={.86} seed={330} /><HachureFill seed={335} /><Frame radius={12} seed={333} stroke="#1748b8" strokeWidth={1.35} /><span className="relative">Wesprzyj POLUTEK.PL</span></button>;
}

function Lang() {
  return <div className="relative flex h-9 items-center px-1 text-sm font-black"><Frame radius={18} seed={52} stroke={INK} strokeWidth={1.1} fill="rgba(248,243,231,.8)" /><button type="button" className="relative px-3 py-2">PL</button><span className="relative h-5 w-px bg-neutral-900/35" /><button type="button" className="relative px-3 py-2 text-neutral-700">EN</button></div>;
}

function Badge({ text, variant = "public" }: { text: string; variant?: "public" | "unlocked" }) {
  const unlocked = variant === "unlocked";
  return <span className="relative inline-flex min-h-[21px] items-center gap-1 px-2 text-[9px] font-black uppercase tracking-widest text-white"><Frame radius={7} seed={unlocked ? 73 : 71} stroke={unlocked ? "#1748b8" : INK} strokeWidth={1} fill={unlocked ? BLUE : INK} shade />{unlocked && <I name="lock" className="relative h-3 w-3" stroke="white" />}<span className="relative">{text}</span></span>;
}

function Counter({ icon, value }: { icon: Icon; value: number }) {
  return <span className="relative inline-flex h-9 items-center gap-2 px-3 text-sm font-black"><I name={icon} className="relative h-5 w-5" /> <span className="relative min-w-3">{value}</span></span>;
}

function VideoCard({ video, active = false }: { video: PublicVideoDTO; active?: boolean }) {
  const isPublic = video.tier === "PUBLIC";
  return <Link href={`/eksperyment1?v=${encodeURIComponent(video.id)}`} className="group block"><article className="relative flex gap-3 p-2 transition-transform group-hover:-translate-y-0.5"><N4Highlight color={active ? "#cfcfcf" : "#eeeeee"} opacity={active ? .82 : .58} seed={video.id.charCodeAt(0) + 90} /><Frame radius={13} seed={video.id.charCodeAt(0) + 10} stroke={active ? INK : "#6b7280"} strokeWidth={active ? 1.45 : 1.05} /><div className="relative w-28 shrink-0 overflow-hidden rounded-[10px]"><div className="relative aspect-video w-full">{video.thumbnailUrl ? <Image src={video.thumbnailUrl} alt={video.title} fill className="object-cover" sizes="112px" /> : <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 text-[9px] text-neutral-400">Video</div>}<div className="absolute bottom-1 left-1 z-10"><Badge text={isPublic ? "PUBLICZNE" : "ODBLOKOWANE"} variant={isPublic ? "public" : "unlocked"} /></div></div></div><div className="relative min-w-0 flex-1 py-1 pr-1"><h3 className="line-clamp-2 text-[15px] font-black leading-tight tracking-wide text-neutral-950">{video.title}</h3><p className="mt-2 text-xs font-bold leading-tight text-neutral-700">{video.creator?.name || "Paweł Polutek"}</p><p className="mt-1 text-xs font-bold leading-tight text-neutral-600">{video.views ?? 0} wyświetleń</p></div></article></Link>;
}

function Heading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const a = annotate(ref.current, { type: "underline", color: BLUE, strokeWidth: 3, animate: true, padding: 3 });
    a.show();
    return () => a.remove();
  }, []);
  return <span ref={ref}>{children}</span>;
}

interface RoughHomeProps { mainVideo: PublicVideoDTO; allVideos: PublicVideoDTO[]; currentVideoId?: string; }

export default function RoughHome({ mainVideo, allVideos, currentVideoId }: RoughHomeProps) {
  const selectedVideo = allVideos.find((v) => v.id === currentVideoId) || mainVideo;
  const [countdown, setCountdown] = useState("105 dni 00:00:00");
  useEffect(() => {
    const target = new Date("2026-10-13T00:00:00+02:00");
    const tick = () => { const ms = target.getTime() - Date.now(); if (ms <= 0) return setCountdown("Premiera dostępna"); const s = Math.floor(ms / 1000); const d = Math.floor(s / 86400); const pad = (v: number) => String(v).padStart(2, "0"); setCountdown(`${d} dni ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  const videos = useMemo(() => [...allVideos].slice(0, 8), [allVideos]);
  const publicVideos = videos.filter((v) => v.tier === "PUBLIC");
  const lockedVideos = videos.filter((v) => v.tier !== "PUBLIC");
  const parts = countdown.split(" ");

  return <div className="relative min-h-screen overflow-x-hidden text-neutral-950 selection:bg-yellow-200/80" style={{ backgroundColor: PAPER, fontFamily: HAND_FONT }}><div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: PAPER_NOISE, opacity: .06 }} /><div className="fixed inset-0 z-0 pointer-events-none opacity-[.025]" style={{ backgroundImage: "radial-gradient(#111 .65px, transparent .65px)", backgroundSize: "22px 22px" }} /><div className="fixed inset-[3px] z-0 pointer-events-none"><Frame radius={7} seed={700} stroke={INK} strokeWidth={1.05} /></div>
    <nav className="sticky top-0 z-40 bg-[#f8f3e7]/92 px-4 py-3 backdrop-blur-md md:px-6"><div className="mx-auto flex h-[46px] max-w-6xl items-center gap-4"><Link href="/" className="relative shrink-0 pr-3 text-xl font-black uppercase leading-none tracking-[-.06em]">POLUTEK<span className="text-blue-600">.PL</span><span className="relative -top-2 ml-1 inline-flex text-[8px] tracking-wide text-neutral-800">BETA</span><svg className="absolute -bottom-2 left-0 h-3 w-[72%]" viewBox="0 0 160 12" preserveAspectRatio="none" aria-hidden="true"><path d="M 2 8 Q 78 2 158 7" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" /></svg></Link><div className="relative mx-auto hidden h-[42px] max-w-lg flex-1 items-center md:flex"><Frame radius={20} seed={18} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" /><input readOnly placeholder="Szukaj" className="relative h-full w-full bg-transparent px-5 pr-[62px] text-base font-bold outline-none placeholder:text-neutral-700/75" /><span className="absolute right-[49px] top-2 h-[26px] w-px bg-neutral-900/35" /><I name="search" className="absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2" /></div><div className="ml-auto flex items-center gap-2"><Lang /><span className="hidden h-7 w-px bg-neutral-900/45 sm:block" /><Btn href="/" icon="login">WEJŚCIE</Btn></div></div><div className="mx-auto mt-2 max-w-6xl"><Separator /></div></nav>
    <main className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-6 md:px-6"><div className="grid grid-cols-12 gap-6"><section className="col-span-12 lg:col-span-8"><div className="relative aspect-video"><Frame radius={15} seed={101} stroke={INK} strokeWidth={1.55} fill="rgba(255,255,255,.12)" /><div className="absolute inset-[6px] overflow-hidden rounded-[12px] bg-neutral-950">{selectedVideo.thumbnailUrl ? <Image src={selectedVideo.thumbnailUrl} alt={selectedVideo.title} fill className="object-cover" priority /> : <div className="flex h-full w-full items-center justify-center text-5xl text-white/25">▶</div>}<div className="absolute inset-0 bg-gradient-to-t from-black/12 via-transparent to-black/8" /><div className="absolute inset-0 flex items-center justify-center"><I name="pause" className="h-14 w-16 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.35)]" stroke="white" /></div></div></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start"><div><h1 className="text-3xl font-black leading-none tracking-[-.035em] text-neutral-950 md:text-[34px]"><Heading>{selectedVideo.title}</Heading></h1><div className="mt-3 flex items-center gap-3"><div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-200"><Frame radius={20} seed={121} stroke={INK} strokeWidth={1.2} />{selectedVideo.creator?.imageUrl && <Image src={selectedVideo.creator.imageUrl} alt="avatar" fill className="object-cover" />}</div><div><p className="text-lg font-black leading-none">{selectedVideo.creator?.name || "Paweł Polutek"}</p><p className="mt-1 text-sm font-bold leading-none text-neutral-700">{selectedVideo.creator?.subscribersCount || 0} subskrybentów</p></div><Btn filled icon="bell" className="ml-1">Subskrajb</Btn></div></div><div className="flex flex-wrap items-center gap-2 md:justify-end"><div className="relative inline-flex h-9 items-center overflow-hidden rounded-full"><Frame radius={18} seed={143} stroke={INK} strokeWidth={1.1} fill="rgba(248,243,231,.88)" /><Counter icon="like" value={1} /><span className="relative h-6 w-px bg-neutral-900/35" /><Counter icon="dislike" value={0} /></div><Btn icon="send">Szeruj</Btn><Btn icon="more" compact /></div></div><div className="mt-4"><Separator label="OPIS" /></div>{selectedVideo.description && <div className="relative mt-3 p-4 text-base font-bold leading-relaxed text-neutral-800"><Frame radius={16} seed={177} stroke="#555" strokeWidth={1} fill="rgba(255,255,255,.2)" /><p className="relative line-clamp-3">{selectedVideo.description}</p></div>}</section><aside className="hidden lg:col-span-4 lg:block"><div className="space-y-4"><section><h2 className="mb-1 text-lg font-black uppercase tracking-[.08em]">Publiczne</h2><Separator /><div className="mt-3 space-y-3">{publicVideos.map((v) => <VideoCard key={v.id} video={v} active={v.id === selectedVideo.id} />)}</div></section>{lockedVideos.length > 0 && <section><h2 className="mb-1 text-lg font-black uppercase tracking-[.08em]">Dla zalogowanych</h2><Separator /><div className="mt-3 space-y-3">{lockedVideos.map((v) => <VideoCard key={v.id} video={v} active={v.id === selectedVideo.id} />)}</div></section>}<section className="relative p-5"><Frame radius={16} seed={211} stroke={INK} strokeWidth={1.15} fill="rgba(248,243,231,.72)" /><div className="relative"><h2 className="text-lg font-black leading-tight tracking-wide">Wspieraj rozwój POLUTEK.PL</h2><p className="mt-3 text-sm font-bold leading-relaxed text-neutral-800">Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze. Bez subskrypcji.</p><div className="relative mt-3 p-3 text-center"><Frame radius={11} seed={229} stroke={INK} strokeWidth={1} fill="rgba(255,255,255,.28)" /><p className="relative text-[10px] font-black uppercase tracking-[.24em]">Do premiery</p><p className="relative mt-1 text-3xl font-black leading-none text-blue-600">{parts[0]} <span className="text-sm text-neutral-900">dni</span><span className="ml-2 text-lg text-neutral-900">{parts.slice(2).join(" ")}</span></p></div><div className="mt-3"><SupportButton /></div></div></section></div></aside></div></main><div className="fixed bottom-4 right-4 z-50 hidden sm:block"><div className="relative px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-neutral-600"><Frame radius={10} seed={301} stroke="#a3a3a3" strokeWidth={1} fill="rgba(248,243,231,.88)" /><span className="relative">eksperyment1 — layout głównej + N4/B5</span></div></div></div>;
}
