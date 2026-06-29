"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentThreeSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment3?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment3-skin">
      <div className="exp3-lab" aria-hidden="true">
        <div className="exp3-label">/katalog → production page</div>
        <h1>POLUTEK component atlas</h1>
        <div className="exp3-card-grid">
          <div>
            <strong>L / lines</strong>
            <p>podwójne separatory, jitter, poprawiane kreski</p>
          </div>
          <div>
            <strong>B / frames</strong>
            <p>karty, obrysy, niedomknięte rogi, hachure CTA</p>
          </div>
          <div>
            <strong>N / notation</strong>
            <p>highlight, circle, bracket, strike-through as UI states</p>
          </div>
        </div>
      </div>

      <section className="exp3-stage" aria-label="Eksperyment 3 katalog card preview">
        {children}
      </section>

      <style jsx global>{`
        .experiment3-skin {
          --paper: #fbf6ea;
          --paper-2: #f4eddf;
          --ink: #141414;
          --ink-soft: rgba(20, 20, 20, 0.68);
          --yellow: rgba(244, 214, 121, 0.66);
          --mint: rgba(198, 227, 207, 0.64);
          --rose: rgba(237, 200, 190, 0.58);
          --blue: #2563eb;
          min-height: 100vh;
          padding: clamp(12px, 2vw, 26px);
          color: var(--ink);
          background:
            radial-gradient(circle at 12px 12px, rgba(20,20,20,.045) 1px, transparent 1.2px) 0 0 / 24px 24px,
            linear-gradient(90deg, rgba(20,20,20,.025) 1px, transparent 1px) 0 0 / 36px 36px,
            linear-gradient(var(--paper), var(--paper));
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
        }

        .experiment3-skin * {
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important;
        }

        .exp3-lab {
          position: relative;
          max-width: 1320px;
          margin: 0 auto 18px;
          padding: 18px 18px 20px;
          border: 2px solid var(--ink);
          border-radius: 10px;
          background: rgba(251, 246, 234, 0.78);
        }

        .exp3-lab::after {
          content: "";
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 8px;
          height: 2px;
          background: repeating-linear-gradient(90deg, var(--ink) 0 10px, transparent 10px 18px);
          opacity: .62;
        }

        .exp3-label {
          position: absolute;
          top: -12px;
          left: 18px;
          padding: 0 8px;
          background: var(--paper);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .exp3-lab h1 {
          display: inline;
          margin: 0;
          font-size: clamp(28px, 4vw, 56px);
          line-height: .95;
          font-weight: 900;
          letter-spacing: .015em;
          text-transform: uppercase;
          background: linear-gradient(transparent 58%, var(--yellow) 58% 88%, transparent 88%);
        }

        .exp3-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .exp3-card-grid > div {
          position: relative;
          min-height: 96px;
          padding: 14px 16px;
          border: 1.7px solid var(--ink);
          border-radius: 8px;
          background: rgba(251, 246, 234, 0.78);
          transform: rotate(-.16deg);
        }

        .exp3-card-grid > div:nth-child(2) { transform: rotate(.2deg); background: rgba(198, 227, 207, 0.28); }
        .exp3-card-grid > div:nth-child(3) { transform: rotate(-.08deg); background: rgba(237, 200, 190, 0.22); }

        .exp3-card-grid strong {
          display: inline-block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .14em;
          border-bottom: 2px solid currentColor;
        }

        .exp3-card-grid p {
          margin: 0;
          max-width: 28ch;
          font-size: 12px;
          line-height: 1.35;
        }

        .exp3-stage {
          position: relative;
          max-width: 1320px;
          margin: 0 auto;
          overflow: hidden;
          border: 2px solid var(--ink);
          border-radius: 14px;
          background: rgba(251, 246, 234, .88);
          isolation: isolate;
        }

        .exp3-stage::before,
        .exp3-stage::after {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 999;
        }

        .exp3-stage::before {
          top: 82px;
          left: 22px;
          width: 82px;
          height: 34px;
          border-left: 2px solid var(--ink);
          border-top: 2px solid var(--ink);
          transform: rotate(-1deg);
          opacity: .6;
        }

        .exp3-stage::after {
          right: 16px;
          bottom: 18px;
          width: 160px;
          height: 18px;
          background: repeating-linear-gradient(-18deg, rgba(20,20,20,.24) 0 1px, transparent 1px 5px);
          opacity: .22;
          transform: rotate(.8deg);
        }

        .exp3-stage > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(251, 246, 234, 0.95) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(8px);
        }

        .exp3-stage > div:first-child::after {
          content: "";
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: -2px;
          height: 6px;
          background: var(--ink);
          opacity: .78;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 760 18' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 9 Q95 3 190 9 T380 9 T570 8 T757 10' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M2 14 Q160 12 320 14 T758 13' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' opacity='.55'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .exp3-stage main[class*="bg-neutral-50"],
        .exp3-stage .bg-neutral-50,
        .exp3-stage .bg-white,
        .exp3-stage .bg-background\/80 {
          background: transparent !important;
        }

        .exp3-stage main > div:first-child {
          max-width: 1220px !important;
          padding-top: 30px !important;
          padding-bottom: 30px !important;
        }

        .exp3-stage .grid[class*="grid-cols-12"] {
          gap: 20px !important;
        }

        .exp3-stage .border,
        .exp3-stage .border-border,
        .exp3-stage .border-input,
        .exp3-stage .border-neutral-100,
        .exp3-stage .border-neutral-200,
        .exp3-stage .border-neutral-300 {
          border-color: var(--ink-soft) !important;
        }

        .exp3-stage [class*="shadow"] {
          box-shadow: none !important;
        }

        .exp3-stage input,
        .exp3-stage textarea {
          background: rgba(251, 246, 234, 0.95) !important;
          border: 1.7px solid rgba(20,20,20,.76) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .exp3-stage input::placeholder { color: rgba(20,20,20,.55) !important; }

        .exp3-stage button,
        .exp3-stage a {
          text-decoration-thickness: 2px;
          text-underline-offset: 5px;
        }

        .exp3-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 2px solid var(--ink) !important;
          border-radius: 10px !important;
          background: #181818 !important;
        }

        .exp3-stage section.bg-transparent > div > div.relative.aspect-video::after {
          content: "play / rough placeholder";
          position: absolute;
          left: 16px;
          bottom: 14px;
          z-index: 30;
          padding: 3px 9px;
          color: rgba(251,246,234,.92);
          border: 1px solid rgba(251,246,234,.6);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
          pointer-events: none;
          background: rgba(20,20,20,.38);
        }

        .exp3-stage section.bg-transparent h1 {
          position: relative;
          display: inline;
          font-size: clamp(25px, 3vw, 38px) !important;
          line-height: 1.06 !important;
          background: linear-gradient(transparent 54%, var(--mint) 54% 86%, transparent 86%);
        }

        .exp3-stage section.bg-transparent h1::after {
          content: "";
          position: absolute;
          left: -6px;
          right: -8px;
          bottom: -6px;
          height: 3px;
          background: var(--ink);
          opacity: .86;
          transform: rotate(-.7deg);
        }

        .exp3-stage section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 1.5px solid var(--ink-soft) !important;
          border-radius: 6px !important;
          background: rgba(244, 237, 223, .76) !important;
        }

        .exp3-stage section.bg-transparent div[class*="rounded-[14px]"]::before {
          content: "context note";
          position: absolute;
          top: -10px;
          right: 12px;
          padding: 0 5px;
          background: var(--paper);
          color: rgba(20,20,20,.58);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .exp3-stage section.bg-transparent a[href^="/channel/"] {
          border: 1.7px solid var(--ink) !important;
          border-radius: 50% !important;
          background: var(--rose) !important;
        }

        .exp3-stage section.bg-transparent a[href^="/channel/"] img {
          border-radius: 50% !important;
          filter: saturate(.85) contrast(1.04);
        }

        .exp3-stage aside {
          position: relative;
          padding-left: 18px;
          border-left: 1.8px dashed rgba(20,20,20,.6);
        }

        .exp3-stage aside [class*="border-b"] {
          border-bottom: 0 !important;
        }

        .exp3-stage aside h3 {
          display: inline-block;
          padding: 2px 7px;
          background: var(--yellow);
          border: 1px solid rgba(20,20,20,.55);
          transform: rotate(-.4deg);
        }

        .exp3-stage aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 10px !important;
          overflow: hidden;
          border: 1.5px solid rgba(20,20,20,.68) !important;
          border-radius: 9px !important;
          background: rgba(251,246,234,.84) !important;
          transform: rotate(-.08deg);
        }

        .exp3-stage aside a[href^="/?v="]:hover {
          transform: translateY(-2px) rotate(.12deg);
        }

        .exp3-stage aside a[href^="/?v="]::before {
          content: "";
          position: absolute;
          inset: 5px;
          background: var(--paper-2);
          opacity: .7;
          clip-path: polygon(1% 8%, 52% 1%, 99% 8%, 97% 92%, 46% 99%, 2% 91%);
          z-index: 0;
          pointer-events: none;
        }

        .exp3-stage aside a[aria-current="page"]::before {
          background: var(--yellow);
          opacity: .72;
        }

        .exp3-stage aside a[href^="/?v="] > * {
          position: relative;
          z-index: 1;
        }

        .exp3-stage aside a[href^="/?v="] > div:first-child {
          border-radius: 4px !important;
          border-color: var(--ink) !important;
          filter: grayscale(.16) contrast(1.05);
        }

        .exp3-stage aside a[href^="/?v="] > div:first-child::after {
          content: "";
          position: absolute;
          inset: 0;
          border: 1px solid rgba(251,246,234,.72);
          background:
            linear-gradient(32deg, transparent 48%, rgba(251,246,234,.52) 49% 51%, transparent 52%),
            linear-gradient(-32deg, transparent 48%, rgba(251,246,234,.52) 49% 51%, transparent 52%);
          pointer-events: none;
          z-index: 20;
        }

        .exp3-stage aside button.w-full,
        .exp3-stage aside button[class*="bg-primary"] {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 8px !important;
          background: transparent !important;
          color: white !important;
        }

        .exp3-stage aside button.w-full::before,
        .exp3-stage aside button[class*="bg-primary"]::before {
          content: "";
          position: absolute;
          inset: 3px 4px;
          z-index: -1;
          border-radius: 7px;
          background:
            repeating-linear-gradient(-20deg, rgba(255,255,255,.22) 0 1px, transparent 1px 5px),
            var(--blue);
          clip-path: polygon(2% 14%, 50% 3%, 98% 12%, 96% 86%, 50% 98%, 3% 88%);
        }

        .exp3-stage [class*="bg-primary"],
        .exp3-stage [class*="bg-black/62"] {
          background-color: var(--ink) !important;
        }

        .exp3-stage div[class*="rounded-[16px]"],
        .exp3-stage div[class*="rounded-2xl"],
        .exp3-stage [role="menu"] {
          background: rgba(251, 246, 234, .96) !important;
          border-color: rgba(20,20,20,.65) !important;
        }

        .exp3-stage footer {
          background: transparent !important;
          border-color: rgba(20,20,20,.45) !important;
        }

        @media (max-width: 860px) {
          .exp3-card-grid { grid-template-columns: 1fr; }
          .exp3-stage main > div:first-child { padding-left: 14px !important; padding-right: 14px !important; }
        }
      `}</style>
    </div>
  );
}
