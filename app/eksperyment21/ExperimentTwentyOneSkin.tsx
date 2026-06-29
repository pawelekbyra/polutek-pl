"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentTwentyOneSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment21?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment21-skin">
      <div className="exp21-paper-marks" aria-hidden="true">
        <span className="note" />
        <span className="tab" />
        <span className="stamp" />
      </div>
      <section className="exp21-stage" aria-label="Eksperyment 21 — spokojny szkic">
        <div className="exp21-caption" aria-hidden="true">
          <b>POLUTEK</b>
          <span>layout sketch 21</span>
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment21-skin {
          --paper: #f7f1e4;
          --paper-soft: rgba(247, 241, 228, .86);
          --ink: #121212;
          --ink-soft: rgba(18,18,18,.68);
          --ink-faint: rgba(18,18,18,.13);
          --marker: rgba(250, 213, 103, .62);
          --sage: rgba(191, 220, 190, .58);
          --blue: #1f5bd8;
          min-height: 100vh;
          position: relative;
          padding-inline: clamp(12px, 3vw, 44px);
          color: var(--ink);
          background:
            linear-gradient(90deg, var(--ink-faint) 1px, transparent 1px) 0 0 / 42px 42px,
            linear-gradient(var(--ink-faint) 1px, transparent 1px) 0 0 / 42px 42px,
            var(--paper);
          background-attachment: scroll;
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
          overflow-x: hidden;
        }

        .experiment21-skin *,
        .experiment21-skin *::before,
        .experiment21-skin *::after {
          box-sizing: border-box;
        }

        .experiment21-skin * {
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important;
        }

        .exp21-paper-marks {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .exp21-paper-marks span {
          position: absolute;
          display: block;
          opacity: .72;
          border: 1.8px solid rgba(18,18,18,.58);
          background: rgba(247,241,228,.44);
        }

        .exp21-paper-marks .note {
          width: clamp(120px, 16vw, 230px);
          height: clamp(80px, 11vw, 160px);
          left: -24px;
          top: 17vh;
          border-radius: 4px;
          background: var(--sage);
          transform: rotate(-8deg);
        }

        .exp21-paper-marks .tab {
          width: clamp(90px, 12vw, 180px);
          height: clamp(48px, 7vw, 92px);
          right: -18px;
          top: 19vh;
          border-radius: 999px;
          background: rgba(31,91,216,.14);
          transform: rotate(9deg);
        }

        .exp21-paper-marks .stamp {
          width: clamp(84px, 11vw, 160px);
          aspect-ratio: 1;
          right: 12vw;
          bottom: 5vh;
          border-radius: 4px;
          background: rgba(250,213,103,.28);
          transform: rotate(-3deg);
        }

        .exp21-stage {
          position: relative;
          z-index: 1;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: visible;
          background: transparent;
          isolation: isolate;
        }

        .exp21-stage::before {
          content: "21";
          position: absolute;
          left: clamp(16px, 3vw, 44px);
          top: clamp(78px, 8vw, 112px);
          z-index: -1;
          color: rgba(18,18,18,.045);
          font-size: clamp(130px, 24vw, 360px);
          line-height: .78;
          font-weight: 950;
          letter-spacing: -.12em;
          pointer-events: none;
        }

        .exp21-caption {
          position: absolute;
          top: 16px;
          right: 18px;
          z-index: 1002;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 9px;
          color: var(--ink);
          background: rgba(247,241,228,.92);
          border: 1.6px solid rgba(18,18,18,.68);
          border-radius: 3px;
          box-shadow: 3px 3px 0 rgba(18,18,18,.13);
          font-size: 10px;
          letter-spacing: .14em;
          text-transform: uppercase;
          pointer-events: none;
        }

        .exp21-caption b,
        .exp21-caption span {
          color: inherit !important;
        }

        .exp21-stage > .exp21-caption + div,
        .exp21-stage > div:first-child:not(.exp21-caption) {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(247, 241, 228, .94) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(8px);
        }

        .exp21-stage > .exp21-caption + div::after,
        .exp21-stage > div:first-child:not(.exp21-caption)::after {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: -3px;
          height: 7px;
          background: var(--ink);
          opacity: .72;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 760 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 9 C110 5 160 13 250 8 S420 3 520 9 S650 14 758 8' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M3 15 C140 12 260 16 381 13 S600 9 757 14' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' opacity='.5'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .exp21-stage main[class*="bg-neutral-50"],
        .exp21-stage .bg-neutral-50,
        .exp21-stage .bg-white,
        .exp21-stage .bg-background\/80,
        .exp21-stage .bg-secondary {
          background: transparent !important;
        }

        .exp21-stage .text-neutral-900,
        .exp21-stage .text-foreground,
        .exp21-stage .text-black,
        .exp21-stage h1,
        .exp21-stage h2,
        .exp21-stage h3,
        .exp21-stage strong {
          color: var(--ink) !important;
        }

        .exp21-stage .text-neutral-700,
        .exp21-stage .text-neutral-600,
        .exp21-stage .text-muted-foreground,
        .exp21-stage p,
        .exp21-stage span {
          color: var(--ink-soft);
        }

        .exp21-stage .border,
        .exp21-stage .border-border,
        .exp21-stage .border-input,
        .exp21-stage .border-neutral-100,
        .exp21-stage .border-neutral-200,
        .exp21-stage .border-neutral-300 {
          border-color: var(--ink-soft) !important;
        }

        .exp21-stage [class*="shadow"] {
          box-shadow: none !important;
        }

        .exp21-stage input,
        .exp21-stage textarea {
          background: rgba(247, 241, 228, .94) !important;
          border: 1.8px solid rgba(18,18,18,.78) !important;
          border-radius: 3px !important;
          box-shadow: none !important;
        }

        .exp21-stage input:focus,
        .exp21-stage textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(250, 213, 103, .36) !important;
        }

        .exp21-stage section.bg-transparent {
          position: relative;
          z-index: 2;
        }

        .exp21-stage section.bg-transparent::before,
        .exp21-stage section.bg-transparent::after {
          content: "";
          position: absolute;
          top: 15px;
          bottom: 166px;
          width: 18px;
          border-color: var(--ink);
          pointer-events: none;
          z-index: 20;
          opacity: .45;
        }

        .exp21-stage section.bg-transparent::before {
          left: -14px;
          border-left: 2px solid;
          border-top: 2px solid;
          border-bottom: 2px solid;
        }

        .exp21-stage section.bg-transparent::after {
          right: -14px;
          border-right: 2px solid;
          border-top: 2px solid;
          border-bottom: 2px solid;
        }

        .exp21-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 2px solid var(--ink) !important;
          border-radius: 3px !important;
          background: #151515 !important;
          box-shadow: 7px 7px 0 rgba(18,18,18,.12) !important;
        }

        .exp21-stage section.bg-transparent > div > div.relative.aspect-video::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 28;
          background:
            linear-gradient(30deg, transparent 49.4%, rgba(247,241,228,.34) 49.4% 50.6%, transparent 50.6%),
            linear-gradient(-30deg, transparent 49.4%, rgba(247,241,228,.34) 49.4% 50.6%, transparent 50.6%);
          opacity: .42;
          pointer-events: none;
        }

        .exp21-stage section.bg-transparent h1 {
          display: inline;
          letter-spacing: .005em !important;
          background: linear-gradient(transparent 49%, var(--marker) 49% 82%, transparent 82%);
        }

        .exp21-stage section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 1.6px solid rgba(18,18,18,.58) !important;
          border-radius: 3px !important;
          background: rgba(247,241,228,.74) !important;
        }

        .exp21-stage section.bg-transparent a[href^="/channel/"] {
          border-radius: 0 !important;
          border: 1.8px solid var(--ink) !important;
          transform: rotate(-.45deg);
        }

        .exp21-stage section.bg-transparent a[href^="/channel/"] img {
          border-radius: 0 !important;
          filter: contrast(1.04) grayscale(.10);
        }

        .exp21-stage button[class*="rounded-full"],
        .exp21-stage a[class*="rounded-full"],
        .exp21-stage div[class*="rounded-full"] {
          border-radius: 4px !important;
        }

        .exp21-stage button[class*="bg-[#171717]"],
        .exp21-stage aside button.w-full,
        .exp21-stage aside button[class*="bg-primary"] {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 4px !important;
          background: transparent !important;
          color: white !important;
        }

        .exp21-stage button[class*="bg-[#171717]"]::before,
        .exp21-stage aside button.w-full::before,
        .exp21-stage aside button[class*="bg-primary"]::before {
          content: "";
          position: absolute;
          inset: 3px 4px;
          z-index: -1;
          border-radius: 3px;
          background:
            repeating-linear-gradient(-18deg, rgba(255,255,255,.22) 0 1px, transparent 1px 4px),
            var(--ink);
          clip-path: polygon(2% 10%, 50% 2%, 98% 10%, 96% 90%, 48% 98%, 3% 91%);
        }

        .exp21-stage aside button.w-full::before,
        .exp21-stage aside button[class*="bg-primary"]::before {
          background:
            repeating-linear-gradient(-18deg, rgba(255,255,255,.24) 0 1px, transparent 1px 4px),
            var(--blue);
        }

        .exp21-stage [class*="bg-primary"],
        .exp21-stage [class*="bg-black/62"] {
          background-color: var(--ink) !important;
        }

        .exp21-stage aside {
          position: relative;
          padding-left: 22px;
          border-left: 2px solid rgba(18,18,18,.52);
        }

        .exp21-stage aside::before {
          content: "kolejne szkice";
          display: inline-block;
          margin-bottom: 12px;
          padding: 4px 8px;
          color: var(--ink);
          background: var(--sage);
          border: 1.5px solid rgba(18,18,18,.55);
          border-radius: 3px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
          transform: rotate(-.5deg);
        }

        .exp21-stage aside h3 {
          color: var(--ink) !important;
          border-bottom: 2px solid var(--ink);
        }

        .exp21-stage aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 12px !important;
          overflow: visible;
          border: 1.6px solid rgba(18,18,18,.58) !important;
          border-radius: 3px !important;
          background: rgba(247,241,228,.82) !important;
        }

        .exp21-stage aside a[href^="/?v="]::before {
          content: "";
          position: absolute;
          inset: -4px;
          border: 1px solid rgba(18,18,18,.26);
          border-radius: 4px;
          transform: rotate(.35deg);
          pointer-events: none;
        }

        .exp21-stage aside a[aria-current="page"] {
          background: rgba(250,213,103,.36) !important;
        }

        .exp21-stage aside a[href^="/?v="] > div:first-child {
          border-radius: 2px !important;
          border-color: var(--ink) !important;
          filter: grayscale(.18) contrast(1.06);
        }

        .exp21-stage aside a[href^="/?v="] > div:first-child::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 24;
          background:
            linear-gradient(34deg, transparent 49%, rgba(247,241,228,.42) 49% 51%, transparent 51%),
            linear-gradient(-34deg, transparent 49%, rgba(247,241,228,.42) 49% 51%, transparent 51%);
          pointer-events: none;
        }

        .exp21-stage div[class*="rounded-[16px]"],
        .exp21-stage div[class*="rounded-2xl"],
        .exp21-stage [role="menu"] {
          background: rgba(247,241,228,.96) !important;
          border-color: rgba(18,18,18,.56) !important;
          border-radius: 4px !important;
        }

        .exp21-stage footer {
          background: transparent !important;
          border-color: rgba(18,18,18,.45) !important;
        }

        @media (max-width: 768px) {
          .experiment21-skin {
            padding-inline: 0;
          }

          .exp21-caption,
          .exp21-stage::before,
          .exp21-stage section.bg-transparent::before,
          .exp21-stage section.bg-transparent::after {
            display: none;
          }

          .exp21-stage aside {
            padding-left: 0;
            border-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
