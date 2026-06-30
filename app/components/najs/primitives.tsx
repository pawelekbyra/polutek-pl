"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";

export const INK = "#171717";
export const PAPER = "#f8f3e7";
export const BLUE = "#2563eb";
export const BLUE_DARK = "#1748b8";

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
  const l = 3 + wobble(seed, 1);
  const t = 3 + wobble(seed, 2);
  const rr = w - 3 + wobble(seed, 3);
  const b = h - 3 + wobble(seed, 4);
  const rad = Math.min(r, (rr - l) / 2 - 1, (b - t) / 2 - 1);
  return `M ${l + rad} ${t} Q ${l} ${t} ${l} ${t + rad} L ${l} ${b - rad} Q ${l} ${b} ${l + rad} ${b} L ${rr - rad} ${b} Q ${rr} ${b} ${rr} ${b - rad} L ${rr} ${t + rad} Q ${rr} ${t} ${rr - rad} ${t} Z`;
}

export function Frame({
  radius = 14,
  seed = 1,
  stroke = INK,
  strokeWidth = 1.2,
  fill = "transparent",
  showShadow = false,
}: {
  radius?: number;
  seed?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  showShadow?: boolean;
}) {
  const { ref, size } = useParentSize<SVGSVGElement>();
  const d = size.w && size.h ? roundedPath(size.w, size.h, radius, seed) : "";
  const d2 = size.w && size.h ? roundedPath(size.w, size.h, radius + 1, seed + 50) : "";
  return (
    <svg ref={ref} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
      {d && (
        <>
          {showShadow && (
            <path d={d} transform="translate(2,2)" fill="none" stroke="#171717" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity="0.16" />
          )}
          <path d={d} fill={fill} />
          <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth + 0.3} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d2} fill="none" stroke={stroke} strokeWidth=".65" opacity=".28" />
        </>
      )}
    </svg>
  );
}

export function HachureFill({
  fill = BLUE,
  stroke = BLUE_DARK,
  seed = 1,
}: {
  fill?: string;
  stroke?: string;
  seed?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    const parent = svg?.parentElement;
    if (!svg || !parent) return;
    const draw = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (!width || !height) return;
      svg.innerHTML = "";
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.appendChild(
        rough.svg(svg).rectangle(4, 4, width - 8, height - 8, {
          seed, roughness: 1.15, bowing: 1.2, stroke, strokeWidth: 1,
          fill, fillStyle: "hachure", fillWeight: 1.45, hachureGap: 4,
        }),
      );
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [fill, seed, stroke]);
  return <svg ref={ref} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true" />;
}

export function NajsSeparator({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`relative h-5 w-full ${className}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 20" preserveAspectRatio="none" aria-hidden="true">
        <path
          d={label ? "M 0 10 Q 115 8 220 10 M 380 10 Q 495 8 600 10" : "M 0 10 Q 300 8 600 10"}
          fill="none" stroke={INK} strokeWidth="1.25" strokeLinecap="round" opacity=".72"
        />
      </svg>
      {label && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#f8f3e7] px-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-700">
          {label}
        </span>
      )}
    </div>
  );
}

export type NajsIconName =
  | "search" | "login" | "bell" | "like" | "dislike" | "send"
  | "more" | "more-vertical" | "lock" | "close" | "shield"
  | "download" | "video" | "alert" | "heart" | "play" | "pause"
  | "volume" | "volume-off" | "subtitles" | "fullscreen";

export function NajsIcon({
  name,
  className = "h-5 w-5",
  stroke = "currentColor",
}: {
  name: NajsIconName;
  className?: string;
  stroke?: string;
}) {
  const c = { fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const player = { fill: "none", stroke, strokeWidth: 2.05, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {name === "search" && <><circle cx="10" cy="10" r="6.3" {...c} /><path d="M15 15.5 L21 21" {...c} /></>}
      {name === "login" && <><path d="M4 5 h8 M4 19 h8 M12 5 v4 M12 15 v4" {...c} /><path d="M10 12 h10 M16 8 l4 4 -4 4" {...c} /></>}
      {name === "bell" && <><path d="M7 10 c0 -4 2 -6 5 -6 s5 2 5 6 v4 l2 3 H5 l2 -3 Z" {...c} /><path d="M10 20 c1.3 1 2.7 1 4 0" {...c} /></>}
      {name === "like" && <><path d="M7 20 H4 V10 h3 Z" {...c} /><path d="M7 10 l4 -6 c1 -1 2 .2 1.6 1.6 L12 9 h6 c1.4 0 2.2 1.1 1.8 2.4 l-1.2 5.2 C18.3 18.3 17.3 20 15 20 H7" {...c} /></>}
      {name === "dislike" && <><path d="M7 4 H4 v10 h3 Z" {...c} /><path d="M7 14 l4 6 c1 1 2 -.2 1.6 -1.6 L12 15 h6 c1.4 0 2.2 -1.1 1.8 -2.4 L18.6 7.4 C18.3 5.7 17.3 4 15 4 H7" {...c} /></>}
      {name === "send" && <><path d="M3 12 L21 4 L16 21 L11 14 Z" {...c} /><path d="M11 14 L21 4" {...c} /></>}
      {name === "more" && <><circle cx="6" cy="12" r="1.2" fill={stroke} stroke="none" /><circle cx="12" cy="12" r="1.2" fill={stroke} stroke="none" /><circle cx="18" cy="12" r="1.2" fill={stroke} stroke="none" /></>}
      {name === "more-vertical" && <><circle cx="12" cy="6" r="1.2" fill={stroke} stroke="none" /><circle cx="12" cy="12" r="1.2" fill={stroke} stroke="none" /><circle cx="12" cy="18" r="1.2" fill={stroke} stroke="none" /></>}
      {name === "lock" && <><path d="M7 11 V8 c0 -3 2 -5 5 -5 s5 2 5 5 v3" {...c} /><path d="M6 11 h12 v9 H6 Z" {...c} /></>}
      {name === "close" && <><path d="M5 5 L19 19" {...c} /><path d="M19 5 L5 19" {...c} /></>}
      {name === "shield" && <><path d="M12 3 L20 7 v6 c0 4 -3 7 -8 9 C7 20 4 17 4 13 V7 Z" {...c} /><path d="M9 12 l2 2 4 -4" {...c} /></>}
      {name === "download" && <><path d="M12 3 v13" {...c} /><path d="M8 12 l4 4 4 -4" {...c} /><path d="M4 19 h16" {...c} /></>}
      {name === "video" && <><path d="M2 8 h12 v8 H2 Z" {...c} /><path d="M14 10 l6 -3 v10 l -6 -3" {...c} /></>}
      {name === "alert" && <><circle cx="12" cy="12" r="9" {...c} /><path d="M12 8 v4" {...c} /><circle cx="12" cy="16" r="0.5" fill={stroke} stroke="none" /></>}
      {name === "heart" && <path d="M12 21 C12 21 3 14 3 8 c0 -3 2 -5 5 -5 c2 0 3.5 1 4 2.5 C12.5 4 14 3 16 3 c3 0 5 2 5 5 C21 14 12 21 12 21 Z" {...c} />}
      {name === "play" && <path d="M8 5.8 L18.2 12.1 L8.2 18.3 Z" fill={stroke} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />}
      {name === "pause" && <><path d="M8.4 6.4 v11.2" {...player} strokeWidth="2.65" /><path d="M15.6 6.4 v11.2" {...player} strokeWidth="2.65" /></>}
      {name === "volume" && <><path d="M4 10.2 h4.2 L13.5 6 v12 l-5.3 -4.2 H4 Z" {...player} /><path d="M16.2 9.2 c1.1 1.3 1.1 4.3 0 5.6" {...player} /><path d="M18.7 7.1 c2.2 2.8 2.2 7 0 9.8" {...player} /></>}
      {name === "volume-off" && <><path d="M4 10.2 h4.2 L13.5 6 v12 l-5.3 -4.2 H4 Z" {...player} /><path d="M17 9 l4 6" {...player} /><path d="M21 9 l-4 6" {...player} /></>}
      {name === "subtitles" && <><path d="M4.2 6.4 h15.6 v11.2 H4.2 Z" {...player} /><path d="M7.3 12.4 h4.4" {...player} /><path d="M13.3 12.4 h3.4" {...player} /><path d="M7.3 15.2 h7.9" {...player} /></>}
      {name === "fullscreen" && <><path d="M8.4 4.6 H4.6 v3.8" {...player} /><path d="M15.6 4.6 h3.8 v3.8" {...player} /><path d="M4.6 15.6 v3.8 h3.8" {...player} /><path d="M19.4 15.6 v3.8 h-3.8" {...player} /></>}
    </svg>
  );
}
