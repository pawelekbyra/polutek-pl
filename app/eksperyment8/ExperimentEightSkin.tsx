"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import rough from "roughjs";

function RoughPaperMarks() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.innerHTML = "";
    const rc = rough.svg(svg);
    const options = {
      stroke: "rgba(25, 22, 17, .48)",
      strokeWidth: 1.15,
      roughness: 1.35,
      bowing: 1.1,
      fill: "transparent",
      seed: 808,
    };

    svg.appendChild(rc.rectangle(18, 18, 1464, 96, options));
    svg.appendChild(rc.rectangle(28, 142, 936, 548, { ...options, seed: 809, strokeWidth: 1.4 }));
    svg.appendChild(rc.rectangle(994, 142, 476, 548, { ...options, seed: 810 }));
    svg.appendChild(rc.line(46, 728, 1458, 724, { ...options, seed: 811, strokeWidth: 1.6 }));
    svg.appendChild(rc.line(58, 760, 620, 754, { ...options, seed: 812 }));
    svg.appendChild(rc.circle(1382, 74, 42, { ...options, seed: 813, stroke: "rgba(223, 161, 64, .68)" }));
  }, []);

  return (
    <svg
      ref={svgRef}
      className="exp8-rough-layer"
      viewBox="0 0 1500 820"
      preserveAspectRatio="none"
      aria-hidden="true"
    />
  );
}

export default function ExperimentEightSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment8?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment8-skin">
      <section className="exp8-paper" aria-label="Eksperyment 8 — roughjs paper system">
        <RoughPaperMarks />
        <div className="exp8-tool-note" aria-hidden="true">
          roughjs · stable seed · dekoracyjne SVG nad HTML
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment8-skin {
          --paper: #f8f1e3;
          --paper-deep: #eadfc9;
          --ink: #191611;
          --ink-soft: rgba(25, 22, 17, .67);
          --line: rgba(25, 22, 17, .22);
          --marker: rgba(244, 200, 84, .54);
          --blue-pencil: #2556b8;
          min-height: 100vh;
          padding: clamp(10px, 2.6vw, 42px);
          color: var(--ink);
          background:
            radial-gradient(circle at 14% 8%, rgba(244,200,84,.18), transparent 30vw),
            radial-gradient(circle at 88% 22%, rgba(37,86,184,.10), transparent 30vw),
            linear-gradient(90deg, rgba(25,22,17,.035) 1px, transparent 1px) 0 0 / 34px 34px,
            linear-gradient(rgba(25,22,17,.027) 1px, transparent 1px) 0 0 / 34px 34px,
            var(--paper);
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive;
          overflow-x: hidden;
        }

        .experiment8-skin *,
        .experiment8-skin *::before,
        .experiment8-skin *::after { box-sizing: border-box; }

        .experiment8-skin * {
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive !important;
        }

        .exp8-paper {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: visible;
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 260 260' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.075'/%3E%3C/svg%3E"),
            rgba(248,241,227,.88);
          background-size: 260px 260px;
          border: 1px solid rgba(25,22,17,.16);
          box-shadow: 0 26px 80px rgba(93, 66, 28, .16), inset 0 0 0 10px rgba(255,255,255,.20);
          isolation: isolate;
        }

        .exp8-rough-layer {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 820px;
          pointer-events: none;
          opacity: .92;
        }

        .exp8-tool-note {
          position: absolute;
          right: 24px;
          top: 26px;
          z-index: 1002;
          padding: 7px 12px;
          color: rgba(25,22,17,.64);
          background: rgba(248,241,227,.78);
          border: 1px dashed rgba(25,22,17,.38);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          transform: rotate(.4deg);
          pointer-events: none;
        }

        .exp8-paper > div:first-child:not(.exp8-tool-note),
        .exp8-paper > .exp8-rough-layer + .exp8-tool-note + div {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(248, 241, 227, .92) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(8px);
        }

        .exp8-paper > .exp8-rough-layer + .exp8-tool-note + div::after {
          content: "";
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: -5px;
          height: 10px;
          background: var(--ink);
          opacity: .72;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 900 22' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 12 C104 4 182 17 284 10 S468 7 600 13 S778 6 896 12' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M8 18 C150 15 300 20 446 16 S710 12 892 17' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' opacity='.55'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .exp8-paper main[class*="bg-neutral-50"],
        .exp8-paper .bg-neutral-50,
        .exp8-paper .bg-white,
        .exp8-paper .bg-background\/80,
        .exp8-paper .bg-secondary { background: transparent !important; }

        .exp8-paper .text-neutral-900,
        .exp8-paper .text-foreground,
        .exp8-paper .text-black,
        .exp8-paper h1,
        .exp8-paper h2,
        .exp8-paper h3,
        .exp8-paper strong { color: var(--ink) !important; }

        .exp8-paper .text-neutral-700,
        .exp8-paper .text-neutral-600,
        .exp8-paper .text-muted-foreground,
        .exp8-paper p,
        .exp8-paper span { color: var(--ink-soft); }

        .exp8-paper .border,
        .exp8-paper .border-border,
        .exp8-paper .border-input,
        .exp8-paper .border-neutral-100,
        .exp8-paper .border-neutral-200,
        .exp8-paper .border-neutral-300 { border-color: rgba(25,22,17,.34) !important; }

        .exp8-paper [class*="shadow"] { box-shadow: none !important; }

        .exp8-paper input,
        .exp8-paper textarea {
          background: rgba(255,250,239,.86) !important;
          border: 1.6px solid rgba(25,22,17,.56) !important;
          border-radius: 7px !important;
          box-shadow: 3px 4px 0 rgba(25,22,17,.08) !important;
        }

        .exp8-paper section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 2px solid rgba(25,22,17,.80) !important;
          border-radius: 9px !important;
          background: #141414 !important;
          box-shadow: 10px 12px 0 rgba(37,86,184,.16) !important;
        }

        .exp8-paper section.bg-transparent > div > div.relative.aspect-video::after {
          content: "roughjs frame";
          position: absolute;
          left: 14px;
          top: 12px;
          z-index: 35;
          padding: 4px 8px;
          color: var(--ink);
          background: var(--marker);
          border: 1px solid rgba(25,22,17,.45);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
          pointer-events: none;
        }

        .exp8-paper section.bg-transparent h1 {
          display: inline;
          background: linear-gradient(transparent 50%, var(--marker) 50% 84%, transparent 84%);
        }

        .exp8-paper section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 1.5px solid rgba(25,22,17,.50) !important;
          border-radius: 8px !important;
          background: rgba(255,250,239,.70) !important;
        }

        .exp8-paper button[class*="bg-[#171717]"],
        .exp8-paper aside button.w-full,
        .exp8-paper aside button[class*="bg-primary"],
        .exp8-paper [class*="bg-primary"] {
          color: white !important;
          border: 1.5px solid var(--ink) !important;
          border-radius: 8px !important;
          background: var(--ink) !important;
          box-shadow: 5px 6px 0 rgba(244,200,84,.42) !important;
        }

        .exp8-paper [class*="bg-black/62"] { background-color: rgba(25,22,17,.70) !important; }

        .exp8-paper aside {
          position: relative;
          padding-left: 20px;
          border-left: 2px dashed rgba(25,22,17,.36);
        }

        .exp8-paper aside::before {
          content: "rough list";
          display: inline-block;
          margin-bottom: 10px;
          padding: 4px 8px;
          border: 1px dashed rgba(25,22,17,.44);
          color: var(--blue-pencil);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .exp8-paper aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 12px !important;
          overflow: visible;
          border: 1.5px solid rgba(25,22,17,.42) !important;
          border-radius: 8px !important;
          background: rgba(255,250,239,.76) !important;
          transform: rotate(-.12deg);
        }

        .exp8-paper aside a[href^="/?v="]:hover {
          transform: translateY(-2px) rotate(.08deg);
          box-shadow: 5px 6px 0 rgba(37,86,184,.12) !important;
        }

        .exp8-paper aside a[aria-current="page"] {
          background: rgba(244,200,84,.28) !important;
          border-color: rgba(25,22,17,.70) !important;
        }

        .exp8-paper aside a[href^="/?v="] > div:first-child {
          border-radius: 6px !important;
          filter: saturate(.95) contrast(1.05);
        }

        .exp8-paper div[class*="rounded-[16px]"],
        .exp8-paper div[class*="rounded-2xl"],
        .exp8-paper [role="menu"] {
          background: rgba(255,250,239,.96) !important;
          border-color: rgba(25,22,17,.42) !important;
          border-radius: 8px !important;
        }

        .exp8-paper footer {
          background: transparent !important;
          border-color: rgba(25,22,17,.22) !important;
        }

        @media (max-width: 768px) {
          .experiment8-skin { padding: 0; }
          .exp8-paper { border-inline: 0; box-shadow: none; }
          .exp8-rough-layer,
          .exp8-tool-note { display: none; }
          .exp8-paper aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
