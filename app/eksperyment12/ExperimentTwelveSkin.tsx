"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentTwelveSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment12?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment12-skin">
      <section className="exp12-blueprint" aria-label="Eksperyment 12 — custom SVG blueprint">
        <svg className="exp12-rulers" viewBox="0 0 1500 900" preserveAspectRatio="none" aria-hidden="true">
          <path d="M40 82 H1460 M40 820 H1460 M84 40 V860 M1418 40 V860" />
          <path d="M120 210 H670 V562 H120Z M800 210 H1370 V562 H800Z" />
          <path d="M120 638 C270 614 418 666 566 636 S858 610 1016 640 S1244 678 1370 632" />
          <path d="M72 130 C142 98 204 130 230 186 M1252 118 C1328 86 1398 128 1428 190" />
          <path d="M105 76 l20 -20 M1376 76 l20 -20 M105 820 l20 20 M1376 820 l20 20" />
        </svg>
        <div className="exp12-label" aria-hidden="true">
          <b>POLUTEK BLUEPRINT</b>
          <span>custom svg paths · system sketch 12</span>
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment12-skin {
          --blueprint: #092a43;
          --blueprint-2: #0c3756;
          --line: rgba(190, 231, 255, .42);
          --line-soft: rgba(190, 231, 255, .18);
          --ink: #edf8ff;
          --ink-soft: rgba(237,248,255,.72);
          --accent: #9ee8ff;
          min-height: 100vh;
          padding: clamp(10px, 2.5vw, 38px);
          color: var(--ink);
          background:
            radial-gradient(circle at 18% 8%, rgba(158,232,255,.15), transparent 34vw),
            radial-gradient(circle at 88% 18%, rgba(95,153,255,.12), transparent 32vw),
            linear-gradient(180deg, #061d30, #041421);
          font-family: "SF Mono", "Cascadia Code", "Consolas", monospace;
          overflow-x: hidden;
        }

        .experiment12-skin *,
        .experiment12-skin *::before,
        .experiment12-skin *::after { box-sizing: border-box; }

        .experiment12-skin * {
          font-family: "SF Mono", "Cascadia Code", "Consolas", monospace !important;
        }

        .exp12-blueprint {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          border: 1px solid rgba(190,231,255,.30);
          border-radius: 8px;
          background:
            linear-gradient(90deg, var(--line-soft) 1px, transparent 1px) 0 0 / 32px 32px,
            linear-gradient(var(--line-soft) 1px, transparent 1px) 0 0 / 32px 32px,
            linear-gradient(90deg, rgba(190,231,255,.08) 1px, transparent 1px) 0 0 / 160px 160px,
            linear-gradient(rgba(190,231,255,.08) 1px, transparent 1px) 0 0 / 160px 160px,
            linear-gradient(180deg, rgba(12,55,86,.96), rgba(9,42,67,.98));
          box-shadow: 0 28px 90px rgba(0,0,0,.36), inset 0 0 0 1px rgba(255,255,255,.04);
          isolation: isolate;
        }

        .exp12-rulers {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 900px;
          color: rgba(190,231,255,.44);
          pointer-events: none;
        }

        .exp12-rulers path {
          fill: none;
          stroke: currentColor;
          stroke-width: 1.3;
          stroke-linecap: round;
          stroke-linejoin: round;
          vector-effect: non-scaling-stroke;
        }

        .exp12-rulers path:nth-child(2) { stroke-dasharray: 8 10; opacity: .70; }
        .exp12-rulers path:nth-child(3) { stroke: rgba(158,232,255,.66); stroke-width: 2; }
        .exp12-rulers path:nth-child(4) { opacity: .42; }
        .exp12-rulers path:nth-child(5) { stroke: rgba(255,255,255,.72); }

        .exp12-label {
          position: absolute;
          top: 20px;
          right: 22px;
          z-index: 1002;
          display: grid;
          gap: 3px;
          padding: 9px 12px;
          color: var(--ink);
          background: rgba(9,42,67,.70);
          border: 1px solid rgba(190,231,255,.34);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
          pointer-events: none;
        }

        .exp12-label b,
        .exp12-label span {
          color: inherit !important;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .exp12-label span { opacity: .70; }

        .exp12-blueprint > .exp12-rulers + .exp12-label + div {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(9, 42, 67, .82) !important;
          border-bottom: 1px solid rgba(190,231,255,.24) !important;
          box-shadow: 0 16px 42px rgba(0,0,0,.20) !important;
          backdrop-filter: blur(12px) saturate(1.2);
        }

        .exp12-blueprint main[class*="bg-neutral-50"],
        .exp12-blueprint .bg-neutral-50,
        .exp12-blueprint .bg-white,
        .exp12-blueprint .bg-background\/80,
        .exp12-blueprint .bg-secondary { background: transparent !important; }

        .exp12-blueprint .text-neutral-900,
        .exp12-blueprint .text-foreground,
        .exp12-blueprint .text-black,
        .exp12-blueprint h1,
        .exp12-blueprint h2,
        .exp12-blueprint h3,
        .exp12-blueprint strong { color: var(--ink) !important; }

        .exp12-blueprint .text-neutral-700,
        .exp12-blueprint .text-neutral-600,
        .exp12-blueprint .text-muted-foreground,
        .exp12-blueprint p,
        .exp12-blueprint span { color: var(--ink-soft); }

        .exp12-blueprint .border,
        .exp12-blueprint .border-border,
        .exp12-blueprint .border-input,
        .exp12-blueprint .border-neutral-100,
        .exp12-blueprint .border-neutral-200,
        .exp12-blueprint .border-neutral-300 { border-color: rgba(190,231,255,.30) !important; }

        .exp12-blueprint [class*="shadow"] { box-shadow: 0 18px 48px rgba(0,0,0,.22) !important; }

        .exp12-blueprint input,
        .exp12-blueprint textarea {
          color: var(--ink) !important;
          background: rgba(7,30,49,.88) !important;
          border: 1px solid rgba(190,231,255,.34) !important;
          border-radius: 4px !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.04) !important;
        }

        .exp12-blueprint input::placeholder,
        .exp12-blueprint textarea::placeholder { color: rgba(237,248,255,.44) !important; }

        .exp12-blueprint section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(190,231,255,.48) !important;
          border-radius: 4px !important;
          background: #041421 !important;
          box-shadow: 0 0 0 1px rgba(255,255,255,.05), 18px 18px 0 rgba(158,232,255,.08) !important;
        }

        .exp12-blueprint section.bg-transparent > div > div.relative.aspect-video::after {
          content: "viewport / 16:9";
          position: absolute;
          left: 14px;
          top: 12px;
          z-index: 34;
          padding: 4px 8px;
          color: var(--accent);
          background: rgba(9,42,67,.70);
          border: 1px solid rgba(158,232,255,.34);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          pointer-events: none;
        }

        .exp12-blueprint section.bg-transparent h1 {
          display: inline;
          color: var(--ink) !important;
          text-shadow: 0 0 18px rgba(158,232,255,.30);
          background: linear-gradient(transparent 56%, rgba(158,232,255,.20) 56% 84%, transparent 84%);
        }

        .exp12-blueprint section.bg-transparent div[class*="rounded-[14px]"] {
          border: 1px solid rgba(190,231,255,.26) !important;
          border-radius: 4px !important;
          background: rgba(7,30,49,.52) !important;
        }

        .exp12-blueprint button[class*="bg-[#171717]"],
        .exp12-blueprint aside button.w-full,
        .exp12-blueprint aside button[class*="bg-primary"],
        .exp12-blueprint [class*="bg-primary"] {
          color: #061d30 !important;
          border: 1px solid var(--accent) !important;
          border-radius: 4px !important;
          background: var(--accent) !important;
          box-shadow: 0 0 26px rgba(158,232,255,.20) !important;
        }

        .exp12-blueprint [class*="bg-black/62"] { background-color: rgba(4,20,33,.74) !important; }

        .exp12-blueprint aside {
          position: relative;
          padding-left: 22px;
          border-left: 1px solid rgba(190,231,255,.30);
        }

        .exp12-blueprint aside::before {
          content: "module map";
          display: inline-block;
          margin-bottom: 10px;
          color: var(--accent);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .exp12-blueprint aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 13px !important;
          overflow: hidden;
          border: 1px solid rgba(190,231,255,.26) !important;
          border-radius: 4px !important;
          background: rgba(7,30,49,.62) !important;
        }

        .exp12-blueprint aside a[href^="/?v="]:hover {
          border-color: rgba(158,232,255,.58) !important;
          transform: translateY(-2px);
        }

        .exp12-blueprint aside a[aria-current="page"] {
          background: rgba(158,232,255,.14) !important;
          border-color: rgba(158,232,255,.68) !important;
        }

        .exp12-blueprint aside a[href^="/?v="] > div:first-child {
          border-radius: 3px !important;
          filter: saturate(.9) contrast(1.08);
        }

        .exp12-blueprint div[class*="rounded-[16px]"],
        .exp12-blueprint div[class*="rounded-2xl"],
        .exp12-blueprint [role="menu"] {
          color: var(--ink) !important;
          background: rgba(7,30,49,.96) !important;
          border-color: rgba(190,231,255,.30) !important;
          border-radius: 4px !important;
        }

        .exp12-blueprint footer {
          color: var(--ink-soft) !important;
          background: transparent !important;
          border-color: rgba(190,231,255,.20) !important;
        }

        @media (max-width: 768px) {
          .experiment12-skin { padding: 0; }
          .exp12-blueprint { border-inline: 0; border-radius: 0; box-shadow: none; }
          .exp12-rulers,
          .exp12-label { display: none; }
          .exp12-blueprint aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
