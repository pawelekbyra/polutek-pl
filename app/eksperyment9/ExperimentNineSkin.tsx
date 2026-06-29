"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStroke } from "perfect-freehand";

function getSvgPath(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    return acc;
  }, ["M", ...stroke[0], "Q"] as (string | number)[]);
  d.push("Z");
  return d.join(" ");
}

function FreehandRibbon({ className = "" }: { className?: string }) {
  const points: [number, number, number][] = [
    [12, 44, .28], [96, 24, .52], [190, 50, .88], [308, 28, .66],
    [448, 52, .92], [592, 34, .58], [732, 48, .80], [890, 30, .42],
  ];
  const stroke = getStroke(points, {
    size: 7,
    thinning: .62,
    smoothing: .72,
    streamline: .42,
    simulatePressure: false,
  });

  return (
    <svg className={className} viewBox="0 0 900 86" preserveAspectRatio="none" aria-hidden="true">
      <path d={getSvgPath(stroke)} fill="currentColor" />
    </svg>
  );
}

export default function ExperimentNineSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment9?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment9-skin">
      <section className="exp9-page" aria-label="Eksperyment 9 — perfect-freehand organic stroke">
        <div className="exp9-margin-note" aria-hidden="true">
          <span>perfect-freehand</span>
          <b>organic line test</b>
        </div>
        <FreehandRibbon className="exp9-ribbon top" />
        <FreehandRibbon className="exp9-ribbon bottom" />
        {children}
      </section>

      <style jsx global>{`
        .experiment9-skin {
          --paper: #fff9ed;
          --ink: #17130e;
          --ink-soft: rgba(23,19,14,.68);
          --wash: rgba(206, 143, 98, .20);
          --brush: #32251a;
          --terracotta: #b95f3b;
          --olive: #6e7d4f;
          min-height: 100vh;
          padding: clamp(10px, 2.7vw, 40px);
          color: var(--ink);
          background:
            radial-gradient(circle at 12% 20%, rgba(185,95,59,.18), transparent 30vw),
            radial-gradient(circle at 88% 12%, rgba(110,125,79,.18), transparent 28vw),
            linear-gradient(120deg, rgba(23,19,14,.035) 0 1px, transparent 1px 12px),
            var(--paper);
          font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
          overflow-x: hidden;
        }

        .experiment9-skin *,
        .experiment9-skin *::before,
        .experiment9-skin *::after { box-sizing: border-box; }

        .experiment9-skin * {
          font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive !important;
        }

        .exp9-page {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='.055'/%3E%3C/svg%3E"),
            rgba(255,249,237,.88);
          background-size: 220px 220px;
          border: 0;
          border-radius: clamp(18px, 2vw, 30px);
          box-shadow: 0 28px 80px rgba(63, 42, 23, .14), inset 0 0 0 1px rgba(23,19,14,.12);
          isolation: isolate;
        }

        .exp9-page::before,
        .exp9-page::after {
          content: "";
          position: absolute;
          z-index: 1;
          pointer-events: none;
          border: 2px solid rgba(23,19,14,.28);
          border-radius: 58% 42% 53% 47% / 48% 52% 44% 56%;
        }

        .exp9-page::before {
          width: clamp(90px, 12vw, 180px);
          height: clamp(90px, 12vw, 180px);
          right: 28px;
          top: 112px;
          transform: rotate(-12deg);
          border-color: rgba(185,95,59,.38);
        }

        .exp9-page::after {
          width: clamp(70px, 10vw, 140px);
          height: clamp(120px, 16vw, 220px);
          left: 26px;
          bottom: 80px;
          transform: rotate(16deg);
          border-color: rgba(110,125,79,.36);
        }

        .exp9-ribbon {
          position: absolute;
          z-index: 2;
          width: min(78%, 980px);
          height: 86px;
          color: rgba(23,19,14,.42);
          pointer-events: none;
        }

        .exp9-ribbon.top {
          left: 18px;
          top: 104px;
          transform: rotate(-.45deg);
        }

        .exp9-ribbon.bottom {
          right: 28px;
          bottom: 128px;
          color: rgba(185,95,59,.24);
          transform: rotate(179deg);
        }

        .exp9-margin-note {
          position: absolute;
          left: 18px;
          top: 20px;
          z-index: 1002;
          display: grid;
          gap: 2px;
          padding: 8px 12px;
          background: rgba(255,249,237,.74);
          border-left: 4px solid var(--terracotta);
          color: rgba(23,19,14,.62);
          pointer-events: none;
        }

        .exp9-margin-note span,
        .exp9-margin-note b {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .exp9-page > .exp9-margin-note + .exp9-ribbon + .exp9-ribbon + div {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(255, 249, 237, .88) !important;
          border-bottom: 0 !important;
          box-shadow: 0 14px 32px rgba(63,42,23,.06) !important;
          backdrop-filter: blur(10px);
        }

        .exp9-page > .exp9-margin-note + .exp9-ribbon + .exp9-ribbon + div::after {
          content: "";
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: -9px;
          height: 13px;
          background: var(--brush);
          opacity: .46;
          clip-path: polygon(0 50%, 8% 38%, 16% 58%, 27% 42%, 38% 62%, 49% 44%, 60% 59%, 72% 40%, 84% 56%, 100% 48%, 100% 70%, 0 74%);
          pointer-events: none;
        }

        .exp9-page main[class*="bg-neutral-50"],
        .exp9-page .bg-neutral-50,
        .exp9-page .bg-white,
        .exp9-page .bg-background\/80,
        .exp9-page .bg-secondary { background: transparent !important; }

        .exp9-page .text-neutral-900,
        .exp9-page .text-foreground,
        .exp9-page .text-black,
        .exp9-page h1,
        .exp9-page h2,
        .exp9-page h3,
        .exp9-page strong { color: var(--ink) !important; }

        .exp9-page .text-neutral-700,
        .exp9-page .text-neutral-600,
        .exp9-page .text-muted-foreground,
        .exp9-page p,
        .exp9-page span { color: var(--ink-soft); }

        .exp9-page .border,
        .exp9-page .border-border,
        .exp9-page .border-input,
        .exp9-page .border-neutral-100,
        .exp9-page .border-neutral-200,
        .exp9-page .border-neutral-300 { border-color: rgba(23,19,14,.30) !important; }

        .exp9-page [class*="shadow"] { box-shadow: 0 13px 32px rgba(63,42,23,.10) !important; }

        .exp9-page input,
        .exp9-page textarea {
          background: rgba(255,249,237,.92) !important;
          border: 0 !important;
          border-bottom: 2px solid rgba(23,19,14,.52) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .exp9-page section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 0 !important;
          border-radius: 26px 18px 30px 20px !important;
          background: #16120f !important;
          box-shadow: 0 0 0 2px rgba(23,19,14,.66), 13px 15px 0 rgba(185,95,59,.20) !important;
        }

        .exp9-page section.bg-transparent > div > div.relative.aspect-video::after {
          content: "";
          position: absolute;
          inset: 8px;
          z-index: 28;
          border: 2px solid rgba(255,249,237,.36);
          border-radius: 42% 58% 48% 52% / 52% 46% 54% 48%;
          pointer-events: none;
        }

        .exp9-page section.bg-transparent h1 {
          display: inline;
          letter-spacing: -.035em !important;
          text-decoration: underline;
          text-decoration-thickness: 5px;
          text-decoration-color: rgba(185,95,59,.34);
          text-underline-offset: -4px;
          text-decoration-skip-ink: none;
        }

        .exp9-page section.bg-transparent div[class*="rounded-[14px]"] {
          border: 1.5px solid rgba(23,19,14,.28) !important;
          border-radius: 20px 14px 24px 16px !important;
          background: rgba(255,249,237,.68) !important;
        }

        .exp9-page button[class*="bg-[#171717]"],
        .exp9-page aside button.w-full,
        .exp9-page aside button[class*="bg-primary"],
        .exp9-page [class*="bg-primary"] {
          color: white !important;
          border: 0 !important;
          border-radius: 999px 44px 999px 50px !important;
          background: var(--brush) !important;
          box-shadow: 4px 6px 0 rgba(185,95,59,.30) !important;
        }

        .exp9-page [class*="bg-black/62"] { background-color: rgba(23,19,14,.70) !important; }

        .exp9-page aside {
          position: relative;
          padding-left: 22px;
          border-left: 0;
        }

        .exp9-page aside::before {
          content: "organic queue";
          display: inline-block;
          margin-bottom: 10px;
          color: var(--terracotta);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .exp9-page aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 14px !important;
          overflow: visible;
          border: 1.5px solid rgba(23,19,14,.26) !important;
          border-radius: 18px 12px 22px 14px !important;
          background: rgba(255,249,237,.82) !important;
        }

        .exp9-page aside a[href^="/?v="]::before {
          content: "";
          position: absolute;
          inset: -5px;
          z-index: -1;
          border-radius: 44% 56% 52% 48% / 50% 48% 52% 50%;
          background: var(--wash);
          transform: rotate(.8deg);
        }

        .exp9-page aside a[href^="/?v="]:hover {
          transform: translateY(-2px) rotate(-.2deg);
        }

        .exp9-page aside a[aria-current="page"]::before {
          background: rgba(110,125,79,.26);
        }

        .exp9-page aside a[href^="/?v="] > div:first-child {
          border-radius: 14px 9px 18px 10px !important;
          filter: saturate(.92) contrast(1.06);
        }

        .exp9-page div[class*="rounded-[16px]"],
        .exp9-page div[class*="rounded-2xl"],
        .exp9-page [role="menu"] {
          background: rgba(255,249,237,.96) !important;
          border-color: rgba(23,19,14,.28) !important;
          border-radius: 18px 12px 22px 14px !important;
        }

        .exp9-page footer {
          background: transparent !important;
          border-color: rgba(23,19,14,.18) !important;
        }

        @media (max-width: 768px) {
          .experiment9-skin { padding: 0; }
          .exp9-page { border-radius: 0; box-shadow: none; }
          .exp9-ribbon,
          .exp9-margin-note { display: none; }
          .exp9-page aside { padding-left: 0; }
        }
      `}</style>
    </div>
  );
}
