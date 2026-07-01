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
  | "download" | "video" | "alert" | "heart" | "pause"
  | "play" | "maximize" | "volume" | "mute" | "subtitles" | "check";

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
      {name === "pause" && <path d="M8 6 v12 M16 6 v12" fill="none" stroke={stroke} strokeWidth={4} strokeLinecap="round" />}
      {name === "play" && <path d="M7 5 L20 12 L7 19 Z" fill={stroke} stroke="none" />}
      {name === "maximize" && <><path d="M4 10 V4 H10" {...c} /><path d="M14 4 H20 V10" {...c} /><path d="M4 14 V20 H10" {...c} /><path d="M14 20 H20 V14" {...c} /></>}
      {name === "volume" && <><path d="M11 5 L6 9 H2 v6 h4 l5 4 Z" {...c} /><path d="M15.5 9 c2 1.8 2 5.2 0 7" {...c} /></>}
      {name === "mute" && <><path d="M11 5 L6 9 H2 v6 h4 l5 4 Z" {...c} /><path d="M15 10 L21 16 M21 10 L15 16" {...c} /></>}
      {name === "subtitles" && <><path d="M3 7 Q3 6 4 6 h16 Q21 6 21 7 v11 Q21 19 20 19 H4 Q3 19 3 18 Z" {...c} /><path d="M6 12 h4 M12 12 h3 M17 12 h1" {...c} /><path d="M6 16 h2 M10 16 h3 M15 16 h4" {...c} /></>}
      {name === "check" && <path d="M4 12 L10 18 L20 7" {...c} />}
    </svg>
  );
}
