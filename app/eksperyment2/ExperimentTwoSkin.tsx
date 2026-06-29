"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentTwoSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment2?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment2-skin">
      <header className="exp2-masthead" aria-hidden="true">
        <span className="exp2-spark">〰</span>
        <div>
          <p>POLUTEK — rough UI concept</p>
          <h1>Rough.js outlines + Rough Notation emphasis</h1>
        </div>
        <span className="exp2-spark">〰</span>
      </header>

      <div className="exp2-board">
        <aside className="exp2-kit" aria-hidden="true">
          <div className="exp2-kit-section">
            <h2>Buttons</h2>
            <div className="exp2-button-row">
              <span className="exp2-pill">Learn more</span>
              <span className="exp2-rect">Get started</span>
            </div>
            <span className="exp2-fill">Subscribe</span>
          </div>

          <div className="exp2-kit-section">
            <h2>Badges / chips</h2>
            <div className="exp2-chip-row">
              <span>New</span>
              <span>Popular</span>
              <span className="dashed">Beta</span>
              <span>★ Limited</span>
            </div>
          </div>

          <div className="exp2-kit-section">
            <h2>Card frame</h2>
            <div className="exp2-card-sample">
              <div className="exp2-thumb"><i /></div>
              <div>
                <strong>Card title</strong>
                <p>This is a short description of the card content.</p>
              </div>
            </div>
          </div>

          <div className="exp2-kit-section">
            <h2>Annotation legend</h2>
            <div className="exp2-legend-grid">
              <span className="underline">Important</span>
              <span className="boxed">Key info</span>
              <span className="circled">Focus</span>
              <span className="highlighted">Emphasis</span>
            </div>
          </div>
        </aside>

        <section className="exp2-stage" aria-label="Eksperyment 2 rough UI preview">
          {children}
        </section>
      </div>

      <style jsx global>{`
        .experiment2-skin {
          --paper: #f8f3e7;
          --paper-soft: rgba(248, 243, 231, 0.95);
          --ink: #151515;
          --ink-soft: rgba(21, 21, 21, 0.72);
          --marker: #f4d679;
          --marker-soft: rgba(244, 214, 121, 0.55);
          --graphite: #eeeeee;
          --graphite-active: #cfcfcf;
          --blue: #2563eb;
          --blue-dark: #1748b8;
          min-height: 100vh;
          padding: clamp(14px, 2.3vw, 30px);
          color: var(--ink);
          background-color: var(--paper);
          background-image:
            radial-gradient(rgba(21, 21, 21, 0.034) 0.72px, transparent 0.72px),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 260 260' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' opacity='0.10' filter='url(%23paper)'/%3E%3C/svg%3E");
          background-size: 22px 22px, 260px 260px;
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
        }

        .experiment2-skin * {
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important;
        }

        .exp2-masthead {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 22px;
          max-width: 1500px;
          margin: 0 auto 18px;
          text-align: center;
        }

        .exp2-masthead p {
          position: relative;
          display: inline-block;
          margin: 0;
          font-size: clamp(30px, 4vw, 54px);
          line-height: 0.92;
          font-weight: 900;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .exp2-masthead p::after {
          content: "";
          position: absolute;
          left: 6px;
          right: 8px;
          bottom: -7px;
          height: 5px;
          background: var(--ink);
          transform: rotate(-0.45deg);
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 360 14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 9 Q88 3 180 8 T357 7' fill='none' stroke='black' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
        }

        .exp2-masthead h1 {
          margin: 14px 0 0;
          font-size: clamp(14px, 1.5vw, 20px);
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .exp2-spark {
          font-size: 34px;
          transform: rotate(90deg);
          opacity: 0.78;
        }

        .exp2-board {
          display: grid;
          grid-template-columns: minmax(260px, 0.38fr) minmax(0, 1fr);
          gap: clamp(16px, 2.2vw, 28px);
          max-width: 1500px;
          margin: 0 auto;
          align-items: start;
        }

        .exp2-kit,
        .exp2-stage {
          position: relative;
          background: rgba(248, 243, 231, 0.72);
        }

        .exp2-kit {
          top: 18px;
          display: grid;
          gap: 18px;
          padding: 16px;
          border-right: 2px solid rgba(21, 21, 21, 0.7);
        }

        .exp2-kit::before {
          content: "component notes";
          position: absolute;
          top: -11px;
          left: 10px;
          padding: 0 8px;
          background: var(--paper);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .exp2-kit-section {
          position: relative;
          padding-top: 15px;
          border-top: 1.8px solid rgba(21, 21, 21, 0.72);
        }

        .exp2-kit-section h2 {
          display: inline-block;
          margin: 0 0 12px;
          font-size: 14px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 2px solid currentColor;
        }

        .exp2-button-row,
        .exp2-chip-row,
        .exp2-legend-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .exp2-pill,
        .exp2-rect,
        .exp2-fill,
        .exp2-chip-row span,
        .exp2-card-sample,
        .exp2-thumb,
        .exp2-boxed,
        .boxed {
          border: 1.5px solid var(--ink);
        }

        .exp2-pill,
        .exp2-rect,
        .exp2-fill,
        .exp2-chip-row span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 900;
          background: rgba(248, 243, 231, 0.85);
        }

        .exp2-pill { border-radius: 999px; }
        .exp2-rect { border-radius: 6px; }
        .exp2-fill {
          width: 100%;
          margin-top: 9px;
          color: white;
          border-color: var(--ink);
          border-radius: 8px;
          background:
            repeating-linear-gradient(-12deg, rgba(255,255,255,.16) 0 1px, transparent 1px 4px),
            var(--ink);
        }

        .exp2-chip-row span {
          min-height: 27px;
          padding: 4px 10px;
          border-radius: 6px;
          background: var(--paper-soft);
        }

        .exp2-chip-row .dashed { border-style: dashed; }

        .exp2-card-sample {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          background: rgba(248, 243, 231, 0.72);
          transform: rotate(-0.2deg);
        }

        .exp2-thumb {
          position: relative;
          min-height: 60px;
          border-radius: 4px;
        }

        .exp2-thumb::before,
        .exp2-thumb::after,
        .exp2-stage aside a[href^="/?v="] > div:first-child::before,
        .exp2-stage aside a[href^="/?v="] > div:first-child::after {
          content: "";
          position: absolute;
          left: 8px;
          right: 8px;
          top: 50%;
          height: 1.3px;
          background: rgba(21, 21, 21, 0.74);
          transform: rotate(31deg);
          pointer-events: none;
          z-index: 25;
        }

        .exp2-thumb::after,
        .exp2-stage aside a[href^="/?v="] > div:first-child::after {
          transform: rotate(-31deg);
        }

        .exp2-card-sample strong {
          display: inline;
          background: linear-gradient(transparent 52%, var(--marker-soft) 52% 89%, transparent 89%);
        }

        .exp2-card-sample p {
          margin: 7px 0 0;
          font-size: 12px;
          line-height: 1.35;
        }

        .exp2-legend-grid span {
          position: relative;
          display: inline-flex;
          min-height: 32px;
          align-items: center;
          padding: 3px 8px;
          font-size: 12px;
          font-weight: 800;
        }

        .exp2-legend-grid .underline { border-bottom: 2px solid currentColor; }
        .exp2-legend-grid .boxed { border-radius: 4px; }
        .exp2-legend-grid .circled { border: 1.6px solid var(--ink); border-radius: 999px; }
        .exp2-legend-grid .highlighted { background: var(--marker-soft); }

        .exp2-stage {
          min-width: 0;
          overflow: hidden;
          border: 2px solid var(--ink);
          border-radius: 9px;
          box-shadow: none !important;
          isolation: isolate;
        }

        .exp2-stage::before {
          content: "live page frame  /eksperyment2";
          position: absolute;
          top: 10px;
          right: 18px;
          z-index: 1001;
          color: rgba(21, 21, 21, 0.58);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          pointer-events: none;
        }

        .exp2-stage > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          height: 58px !important;
          min-height: 58px !important;
          overflow: visible !important;
          background: rgba(248, 243, 231, 0.94) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(10px);
        }

        .exp2-stage > div:first-child::after {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: -1px;
          height: 4px;
          background: var(--ink);
          opacity: 0.82;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 640 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 7 Q155 2 320 7 T637 6' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .exp2-stage main[class*="bg-neutral-50"],
        .exp2-stage .bg-neutral-50 {
          background: transparent !important;
        }

        .exp2-stage main > div:first-child {
          padding-top: 26px !important;
          padding-bottom: 26px !important;
        }

        .exp2-stage .bg-white,
        .exp2-stage .bg-background\/80,
        .exp2-stage .bg-secondary {
          background-color: var(--paper-soft) !important;
        }

        .exp2-stage .border,
        .exp2-stage .border-border,
        .exp2-stage .border-input,
        .exp2-stage .border-neutral-200,
        .exp2-stage .border-neutral-300 {
          border-color: var(--ink-soft) !important;
        }

        .exp2-stage [class*="shadow"] {
          box-shadow: none !important;
        }

        .exp2-stage input,
        .exp2-stage textarea {
          background: rgba(248, 243, 231, 0.93) !important;
          border-color: rgba(21, 21, 21, 0.78) !important;
          border-radius: 6px !important;
          box-shadow: none !important;
        }

        .exp2-stage input:focus,
        .exp2-stage textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18) !important;
        }

        .exp2-stage section.bg-transparent {
          position: relative;
          padding: 2px;
        }

        .exp2-stage section.bg-transparent::before {
          content: "[ hero ]";
          position: absolute;
          left: 10px;
          top: -18px;
          color: rgba(21, 21, 21, 0.58);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .exp2-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border-color: var(--ink) !important;
          border-radius: 5px !important;
          background: #f2eadc !important;
        }

        .exp2-stage section.bg-transparent > div > div.relative.aspect-video::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 26;
          background:
            linear-gradient(28deg, transparent calc(50% - 1px), rgba(248,243,231,.62) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
            linear-gradient(-28deg, transparent calc(50% - 1px), rgba(248,243,231,.62) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px));
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .exp2-stage section.bg-transparent > div > div.relative.aspect-video::after {
          content: "";
          position: absolute;
          inset: -3px;
          border: 1.7px solid rgba(21, 21, 21, 0.96);
          border-radius: 7px;
          transform: rotate(-0.12deg);
          pointer-events: none;
          z-index: 30;
        }

        .exp2-stage section.bg-transparent h1 {
          display: inline;
          font-size: clamp(26px, 3.5vw, 42px) !important;
          line-height: 1.08 !important;
          letter-spacing: 0.01em !important;
          background: linear-gradient(transparent 52%, var(--marker-soft) 52% 83%, transparent 83%);
        }

        .exp2-stage h1,
        .exp2-stage h2,
        .exp2-stage h3,
        .exp2-stage h4,
        .exp2-stage .font-heading,
        .exp2-stage .font-brand {
          letter-spacing: 0.01em;
        }

        .exp2-stage section.bg-transparent a[href^="/channel/"] img,
        .exp2-stage section.bg-transparent a[href^="/channel/"] {
          border-radius: 999px !important;
        }

        .exp2-stage section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          background: rgba(238, 238, 238, 0.62) !important;
          border-color: rgba(21, 21, 21, 0.64) !important;
          border-radius: 9px !important;
        }

        .exp2-stage section.bg-transparent div[class*="rounded-[14px]"]::after {
          content: "";
          position: absolute;
          inset: -2px;
          border: 1px solid rgba(21, 21, 21, 0.72);
          border-radius: 10px;
          transform: rotate(0.08deg);
          pointer-events: none;
        }

        .exp2-stage aside {
          position: relative;
          border-left: 2px solid rgba(21, 21, 21, 0.55);
          padding-left: 18px;
        }

        .exp2-stage aside::before {
          content: "Featured stories";
          display: block;
          margin: 0 0 12px;
          width: max-content;
          background: var(--marker-soft);
          font-size: 14px;
          font-weight: 900;
        }

        .exp2-stage aside a[href^="/?v="] {
          position: relative;
          overflow: hidden;
          border: 1.15px solid rgba(21, 21, 21, 0.68) !important;
          border-radius: 8px !important;
          background: transparent !important;
        }

        .exp2-stage aside a[href^="/?v="]::before {
          content: "";
          position: absolute;
          inset: 4px 5px;
          border-radius: 7px;
          background: var(--graphite);
          opacity: 0.56;
          transform: rotate(0.08deg);
          clip-path: polygon(2% 12%, 48% 2%, 98% 10%, 96% 88%, 52% 98%, 3% 89%);
          z-index: 0;
          pointer-events: none;
        }

        .exp2-stage aside a[aria-current="page"]::before {
          background: var(--graphite-active);
          opacity: 0.88;
        }

        .exp2-stage aside a[href^="/?v="] > * {
          position: relative;
          z-index: 1;
        }

        .exp2-stage aside [class*="border-b"] {
          border-color: rgba(21, 21, 21, 0.72) !important;
        }

        .exp2-stage [class*="bg-black/62"],
        .exp2-stage [class*="bg-primary"] {
          background-color: var(--ink) !important;
        }

        .exp2-stage button[class*="bg-[#171717]"],
        .exp2-stage button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"] {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          min-height: 40px !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
          border-radius: 999px !important;
          border: 0 !important;
          color: #fff !important;
          background: transparent !important;
          transform: rotate(-0.25deg);
        }

        .exp2-stage button[class*="bg-[#171717]"]::before,
        .exp2-stage button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"]::before {
          content: "";
          position: absolute;
          inset: 2px 4px;
          z-index: -2;
          border-radius: 999px;
          background:
            repeating-linear-gradient(-15deg, rgba(255,255,255,.16) 0 1px, transparent 1px 4px),
            #151515;
          clip-path: polygon(3% 18%, 18% 7%, 50% 3%, 82% 7%, 97% 20%, 96% 78%, 83% 94%, 50% 98%, 16% 93%, 3% 78%);
        }

        .exp2-stage button[class*="bg-[#171717]"]::after,
        .exp2-stage button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"]::after {
          content: "";
          position: absolute;
          inset: 1px 2px;
          z-index: -1;
          border: 1.6px solid var(--ink);
          border-radius: 999px;
          transform: rotate(0.45deg);
          pointer-events: none;
        }

        .exp2-stage button[class*="bg-[#171717]"] span,
        .exp2-stage button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"] span {
          position: relative;
          top: -0.5px;
          color: #fff !important;
          font-size: 14px !important;
          letter-spacing: 0.01em;
        }

        .exp2-stage aside button.w-full,
        .exp2-stage aside button[class*="bg-primary"] {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          height: 50px !important;
          border: 0 !important;
          border-radius: 9px !important;
          color: white !important;
          background: transparent !important;
          font-size: 17px !important;
          letter-spacing: 0.01em;
          transform: rotate(-0.18deg);
        }

        .exp2-stage aside button.w-full::before,
        .exp2-stage aside button[class*="bg-primary"]::before {
          content: "";
          position: absolute;
          inset: 3px 4px;
          z-index: -3;
          border-radius: 8px;
          background:
            repeating-linear-gradient(-18deg, rgba(255,255,255,.25) 0 1.4px, transparent 1.4px 4.6px),
            var(--blue);
          clip-path: polygon(2% 13%, 16% 5%, 50% 2%, 84% 5%, 98% 13%, 97% 86%, 84% 95%, 50% 98%, 16% 95%, 2% 86%);
        }

        .exp2-stage aside button.w-full::after,
        .exp2-stage aside button[class*="bg-primary"]::after {
          content: "";
          position: absolute;
          inset: 1px 2px;
          z-index: -2;
          border: 1.6px solid var(--blue-dark);
          border-radius: 9px;
          transform: rotate(0.38deg);
          pointer-events: none;
        }

        .exp2-stage aside button.w-full:hover,
        .exp2-stage aside button[class*="bg-primary"]:hover,
        .exp2-stage button[class*="bg-[#171717]"]:hover {
          filter: brightness(1.04);
          transform: translateY(-1px) rotate(-0.18deg);
        }

        .exp2-stage div[class*="rounded-[16px]"],
        .exp2-stage div[class*="rounded-2xl"],
        .exp2-stage [role="menu"] {
          background: rgba(248, 243, 231, 0.96) !important;
          border-color: rgba(21,21,21,.68) !important;
        }

        .exp2-stage footer {
          background: transparent !important;
          border-color: rgba(21,21,21,.45) !important;
        }

        @media (max-width: 1180px) {
          .exp2-board {
            grid-template-columns: 1fr;
          }

          .exp2-kit {
            position: relative;
            top: auto;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            border-right: 0;
            border-bottom: 2px solid rgba(21, 21, 21, 0.7);
          }
        }

        @media (max-width: 720px) {
          .experiment2-skin { padding: 10px; }
          .exp2-masthead { gap: 8px; }
          .exp2-spark { display: none; }
          .exp2-kit { grid-template-columns: 1fr; }
          .exp2-stage::before { display: none; }
          .exp2-stage main > div:first-child { padding-left: 14px !important; padding-right: 14px !important; }
        }
      `}</style>
    </div>
  );
}
