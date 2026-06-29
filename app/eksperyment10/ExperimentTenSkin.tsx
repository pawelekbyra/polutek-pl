"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { annotate } from "rough-notation";

function AnnotatedWord({ children, type = "highlight", color = "#f4d35e" }: { children: React.ReactNode; type?: "highlight" | "underline" | "box" | "circle"; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const annotation = annotate(ref.current, {
      type,
      color,
      padding: 4,
      strokeWidth: 2,
      animate: false,
      multiline: true,
    });
    annotation.show();
    return () => annotation.remove();
  }, [type, color]);

  return <span ref={ref}>{children}</span>;
}

export default function ExperimentTenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment10?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment10-skin">
      <section className="exp10-sheet" aria-label="Eksperyment 10 — rough notation marks">
        <div className="exp10-legend" aria-hidden="true">
          <b><AnnotatedWord type="box" color="#111">POLUTEK</AnnotatedWord></b>
          <span><AnnotatedWord color="#f4d35e">rough-notation</AnnotatedWord></span>
          <em><AnnotatedWord type="underline" color="#d94b3d">/eksperyment10</AnnotatedWord></em>
        </div>
        <svg className="exp10-doodles" viewBox="0 0 1200 620" preserveAspectRatio="none" aria-hidden="true">
          <path d="M36 122 C178 76 272 150 414 104 S686 62 826 126 S1032 168 1162 104" />
          <path d="M74 512 C238 548 354 494 492 532 S782 568 1114 500" />
          <path d="M1010 42 C1052 28 1102 34 1128 72 C1158 116 1120 164 1068 150 C1018 136 976 82 1010 42Z" />
          <path d="M54 342 C94 310 148 326 166 374 C182 424 130 454 84 424 C48 400 28 364 54 342Z" />
        </svg>
        {children}
      </section>

      <style jsx global>{`
        .experiment10-skin {
          --paper: #fbf4e8;
          --ink: #15120e;
          --ink-soft: rgba(21,18,14,.66);
          --yellow: rgba(244, 211, 94, .58);
          --red: #d94b3d;
          --blue: #2658b7;
          --green: #57734b;
          min-height: 100vh;
          padding: clamp(10px, 2.5vw, 40px);
          color: var(--ink);
          background:
            radial-gradient(circle at 12% 14%, rgba(244,211,94,.18), transparent 30vw),
            radial-gradient(circle at 88% 24%, rgba(217,75,61,.12), transparent 28vw),
            linear-gradient(90deg, rgba(21,18,14,.030) 1px, transparent 1px) 0 0 / 48px 48px,
            linear-gradient(rgba(21,18,14,.026) 1px, transparent 1px) 0 0 / 48px 48px,
            var(--paper);
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive;
          overflow-x: hidden;
        }

        .experiment10-skin *,
        .experiment10-skin *::before,
        .experiment10-skin *::after { box-sizing: border-box; }

        .experiment10-skin * {
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive !important;
        }

        .exp10-sheet {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 280 280' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.065'/%3E%3C/svg%3E"),
            rgba(251,244,232,.88);
          background-size: 280px 280px;
          border: 1px solid rgba(21,18,14,.16);
          border-radius: 14px;
          box-shadow: 0 30px 82px rgba(65,43,19,.13), inset 0 0 0 12px rgba(255,255,255,.18);
          isolation: isolate;
        }

        .exp10-legend {
          position: absolute;
          top: 18px;
          right: 22px;
          z-index: 1002;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          max-width: min(520px, 72vw);
          padding: 9px 12px;
          background: rgba(251,244,232,.72);
          border: 1px solid rgba(21,18,14,.18);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .10em;
          text-transform: uppercase;
          pointer-events: none;
        }

        .exp10-legend b,
        .exp10-legend span,
        .exp10-legend em { color: var(--ink) !important; font-style: normal; }

        .exp10-doodles {
          position: absolute;
          inset: 86px 20px auto 20px;
          z-index: 1;
          width: calc(100% - 40px);
          height: 620px;
          color: var(--ink);
          pointer-events: none;
          opacity: .46;
        }

        .exp10-doodles path {
          fill: none;
          stroke: currentColor;
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          vector-effect: non-scaling-stroke;
        }

        .exp10-doodles path:nth-child(2) { stroke: var(--red); opacity: .62; }
        .exp10-doodles path:nth-child(3) { stroke: var(--blue); opacity: .44; }
        .exp10-doodles path:nth-child(4) { stroke: var(--green); opacity: .50; }

        .exp10-sheet > .exp10-legend + .exp10-doodles + div {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(251, 244, 232, .90) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(8px);
        }

        .exp10-sheet > .exp10-legend + .exp10-doodles + div::after {
          content: "";
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: -6px;
          height: 12px;
          background: var(--yellow);
          transform: rotate(-.18deg);
          clip-path: polygon(0 24%, 12% 10%, 30% 26%, 46% 12%, 64% 24%, 82% 8%, 100% 22%, 100% 78%, 0 82%);
          pointer-events: none;
        }

        .exp10-sheet main[class*="bg-neutral-50"],
        .exp10-sheet .bg-neutral-50,
        .exp10-sheet .bg-white,
        .exp10-sheet .bg-background\/80,
        .exp10-sheet .bg-secondary { background: transparent !important; }

        .exp10-sheet .text-neutral-900,
        .exp10-sheet .text-foreground,
        .exp10-sheet .text-black,
        .exp10-sheet h1,
        .exp10-sheet h2,
        .exp10-sheet h3,
        .exp10-sheet strong { color: var(--ink) !important; }

        .exp10-sheet .text-neutral-700,
        .exp10-sheet .text-neutral-600,
        .exp10-sheet .text-muted-foreground,
        .exp10-sheet p,
        .exp10-sheet span { color: var(--ink-soft); }

        .exp10-sheet .border,
        .exp10-sheet .border-border,
        .exp10-sheet .border-input,
        .exp10-sheet .border-neutral-100,
        .exp10-sheet .border-neutral-200,
        .exp10-sheet .border-neutral-300 { border-color: rgba(21,18,14,.32) !important; }

        .exp10-sheet [class*="shadow"] { box-shadow: 0 14px 34px rgba(65,43,19,.09) !important; }

        .exp10-sheet input,
        .exp10-sheet textarea {
          background: rgba(255,250,240,.90) !important;
          border: 1.5px solid rgba(21,18,14,.36) !important;
          border-radius: 4px !important;
          box-shadow: inset 0 -8px 0 rgba(244,211,94,.18) !important;
        }

        .exp10-sheet section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 2px solid var(--ink) !important;
          border-radius: 10px !important;
          background: #15120e !important;
          box-shadow: 0 0 0 8px rgba(244,211,94,.18), 10px 12px 0 rgba(21,18,14,.10) !important;
        }

        .exp10-sheet section.bg-transparent > div > div.relative.aspect-video::before,
        .exp10-sheet section.bg-transparent > div > div.relative.aspect-video::after {
          content: "";
          position: absolute;
          z-index: 32;
          pointer-events: none;
          border: 2px solid rgba(251,244,232,.48);
        }

        .exp10-sheet section.bg-transparent > div > div.relative.aspect-video::before {
          inset: 10px;
          border-radius: 7px;
          border-style: dashed;
        }

        .exp10-sheet section.bg-transparent > div > div.relative.aspect-video::after {
          width: 86px;
          height: 42px;
          right: 14px;
          top: 14px;
          border-color: rgba(244,211,94,.70);
          border-radius: 999px;
          transform: rotate(-8deg);
        }

        .exp10-sheet section.bg-transparent h1 {
          display: inline;
          background: linear-gradient(transparent 55%, rgba(244,211,94,.62) 55% 86%, transparent 86%);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }

        .exp10-sheet section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 1.5px solid rgba(21,18,14,.34) !important;
          border-radius: 7px !important;
          background: rgba(255,250,240,.72) !important;
        }

        .exp10-sheet section.bg-transparent div[class*="rounded-[14px]"]::after {
          content: "";
          position: absolute;
          left: 10px;
          right: 10px;
          bottom: 8px;
          height: 6px;
          background: rgba(217,75,61,.16);
          transform: rotate(-.5deg);
          pointer-events: none;
        }

        .exp10-sheet button[class*="bg-[#171717]"],
        .exp10-sheet aside button.w-full,
        .exp10-sheet aside button[class*="bg-primary"],
        .exp10-sheet [class*="bg-primary"] {
          color: white !important;
          border: 1.5px solid var(--ink) !important;
          border-radius: 4px !important;
          background: var(--ink) !important;
          box-shadow: 5px 5px 0 rgba(217,75,61,.30) !important;
        }

        .exp10-sheet [class*="bg-black/62"] { background-color: rgba(21,18,14,.70) !important; }

        .exp10-sheet aside {
          position: relative;
          padding-left: 20px;
          border-left: 2px solid rgba(21,18,14,.28);
        }

        .exp10-sheet aside::before {
          content: "adnotacje";
          display: inline-block;
          margin-bottom: 10px;
          padding: 3px 9px;
          color: var(--ink);
          background: rgba(244,211,94,.50);
          border: 1px solid rgba(21,18,14,.34);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
          transform: rotate(-.4deg);
        }

        .exp10-sheet aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 12px !important;
          overflow: hidden;
          border: 1.5px solid rgba(21,18,14,.32) !important;
          border-radius: 7px !important;
          background: rgba(255,250,240,.80) !important;
        }

        .exp10-sheet aside a[href^="/?v="]::after {
          content: "";
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: 7px;
          height: 5px;
          background: rgba(244,211,94,.42);
          transform: rotate(.5deg);
          pointer-events: none;
        }

        .exp10-sheet aside a[href^="/?v="]:hover {
          transform: translateY(-2px);
          box-shadow: 5px 5px 0 rgba(38,88,183,.16) !important;
        }

        .exp10-sheet aside a[aria-current="page"] {
          background: rgba(244,211,94,.20) !important;
          border-color: rgba(217,75,61,.52) !important;
        }

        .exp10-sheet aside a[href^="/?v="] > div:first-child {
          border-radius: 5px !important;
          filter: saturate(.96) contrast(1.06);
        }

        .exp10-sheet div[class*="rounded-[16px]"],
        .exp10-sheet div[class*="rounded-2xl"],
        .exp10-sheet [role="menu"] {
          background: rgba(255,250,240,.96) !important;
          border-color: rgba(21,18,14,.30) !important;
          border-radius: 7px !important;
        }

        .exp10-sheet footer {
          background: transparent !important;
          border-color: rgba(21,18,14,.18) !important;
        }

        @media (max-width: 768px) {
          .experiment10-skin { padding: 0; }
          .exp10-sheet { border-radius: 0; box-shadow: none; }
          .exp10-legend,
          .exp10-doodles { display: none; }
          .exp10-sheet aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
