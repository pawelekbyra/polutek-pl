"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentSixSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment6?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment6-skin">
      <aside className="exp6-index" aria-hidden="true">
        <span>POLUTEK REVIEW</span>
        <strong>No. 006</strong>
        <em>editorial interface issue</em>
      </aside>
      <section className="exp6-stage" aria-label="Eksperyment 6 — editorial premium">
        {children}
      </section>

      <style jsx global>{`
        .experiment6-skin {
          --paper: #f4efe4;
          --paper-deep: #e8decf;
          --card: rgba(255, 252, 246, .86);
          --ink: #1a1611;
          --ink-soft: rgba(26, 22, 17, .68);
          --hairline: rgba(26, 22, 17, .18);
          --gold: #b0833a;
          --wine: #7f1d1d;
          --sage: #6f7d55;
          min-height: 100vh;
          padding: clamp(12px, 2.8vw, 42px);
          color: var(--ink);
          background:
            linear-gradient(90deg, rgba(26,22,17,.035) 1px, transparent 1px) 0 0 / 72px 72px,
            linear-gradient(rgba(26,22,17,.03) 1px, transparent 1px) 0 0 / 72px 72px,
            radial-gradient(circle at 10% 0%, rgba(176,131,58,.14), transparent 36vw),
            radial-gradient(circle at 92% 24%, rgba(127,29,29,.08), transparent 32vw),
            var(--paper);
          font-family: Georgia, "Times New Roman", serif;
          overflow-x: hidden;
        }

        .experiment6-skin *,
        .experiment6-skin *::before,
        .experiment6-skin *::after {
          box-sizing: border-box;
        }

        .experiment6-skin * {
          font-family: Georgia, "Times New Roman", serif !important;
        }

        .exp6-index {
          position: fixed;
          left: clamp(10px, 2vw, 26px);
          top: 50%;
          z-index: 0;
          display: grid;
          gap: 10px;
          width: 38px;
          transform: translateY(-50%);
          color: rgba(26,22,17,.40);
          writing-mode: vertical-rl;
          text-orientation: mixed;
          pointer-events: none;
        }

        .exp6-index span,
        .exp6-index strong,
        .exp6-index em {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .22em;
          text-transform: uppercase;
          font-style: normal;
        }

        .exp6-stage {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: visible;
          padding: clamp(0px, 1vw, 12px);
          background:
            linear-gradient(180deg, rgba(255,252,246,.72), rgba(244,239,228,.64)),
            radial-gradient(circle at 28px 28px, rgba(26,22,17,.055) 0 1px, transparent 1px) 0 0 / 28px 28px;
          border: 1px solid rgba(26,22,17,.18);
          box-shadow: 0 34px 90px rgba(66, 45, 19, .14), inset 0 0 0 12px rgba(255,255,255,.18);
          isolation: isolate;
        }

        .exp6-stage::before {
          content: "THE CHANNEL EDITION  —  /eksperyment6";
          position: absolute;
          top: 14px;
          right: 22px;
          z-index: 1002;
          color: rgba(26,22,17,.46);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .20em;
          text-transform: uppercase;
          pointer-events: none;
        }

        .exp6-stage::after {
          content: "";
          position: absolute;
          inset: 14px;
          z-index: 1;
          border: 1px solid rgba(26,22,17,.10);
          pointer-events: none;
        }

        .exp6-stage > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(244, 239, 228, .88) !important;
          border-bottom: 1px solid rgba(26,22,17,.16) !important;
          box-shadow: 0 14px 34px rgba(66,45,19,.08) !important;
          backdrop-filter: blur(14px) saturate(1.1);
        }

        .exp6-stage > div:first-child::before {
          content: "POLUTEK";
          position: absolute;
          left: 50%;
          bottom: -18px;
          transform: translateX(-50%);
          padding: 4px 14px;
          color: var(--paper);
          background: var(--ink);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .24em;
          text-transform: uppercase;
        }

        .exp6-stage main[class*="bg-neutral-50"],
        .exp6-stage .bg-neutral-50,
        .exp6-stage .bg-white,
        .exp6-stage .bg-background\/80,
        .exp6-stage .bg-secondary {
          background: transparent !important;
        }

        .exp6-stage .text-neutral-900,
        .exp6-stage .text-foreground,
        .exp6-stage .text-black,
        .exp6-stage h1,
        .exp6-stage h2,
        .exp6-stage h3,
        .exp6-stage strong {
          color: var(--ink) !important;
        }

        .exp6-stage .text-neutral-700,
        .exp6-stage .text-neutral-600,
        .exp6-stage .text-muted-foreground,
        .exp6-stage p,
        .exp6-stage span {
          color: var(--ink-soft);
        }

        .exp6-stage .border,
        .exp6-stage .border-border,
        .exp6-stage .border-input,
        .exp6-stage .border-neutral-100,
        .exp6-stage .border-neutral-200,
        .exp6-stage .border-neutral-300 {
          border-color: var(--hairline) !important;
        }

        .exp6-stage [class*="shadow"] {
          box-shadow: 0 18px 42px rgba(66,45,19,.10) !important;
        }

        .exp6-stage input,
        .exp6-stage textarea {
          color: var(--ink) !important;
          background: rgba(255, 252, 246, .78) !important;
          border: 1px solid rgba(26,22,17,.24) !important;
          border-radius: 0 !important;
          box-shadow: inset 0 -2px 0 rgba(176,131,58,.24) !important;
        }

        .exp6-stage input:focus,
        .exp6-stage textarea:focus {
          outline: none !important;
          box-shadow: inset 0 -2px 0 var(--gold), 0 0 0 3px rgba(176,131,58,.12) !important;
        }

        .exp6-stage section.bg-transparent {
          position: relative;
        }

        .exp6-stage section.bg-transparent::before {
          content: "featured story";
          position: absolute;
          top: -6px;
          left: clamp(16px, 2vw, 28px);
          z-index: 20;
          padding: 5px 12px;
          color: white;
          background: var(--wine);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .exp6-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(26,22,17,.30) !important;
          border-radius: 0 !important;
          background: #111 !important;
          box-shadow: 18px 18px 0 rgba(176,131,58,.18), 0 28px 70px rgba(66,45,19,.16) !important;
        }

        .exp6-stage section.bg-transparent > div > div.relative.aspect-video::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 28;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(255,252,246,.10), transparent 26%, transparent 74%, rgba(255,252,246,.10)),
            radial-gradient(circle at 50% 50%, transparent 52%, rgba(0,0,0,.30));
        }

        .exp6-stage section.bg-transparent h1 {
          display: inline;
          font-size: clamp(44px, 6vw, 86px) !important;
          line-height: .88 !important;
          letter-spacing: -.075em !important;
          color: var(--ink) !important;
          text-wrap: balance;
          background: linear-gradient(transparent 62%, rgba(176,131,58,.22) 62% 88%, transparent 88%);
        }

        .exp6-stage section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 1px solid rgba(26,22,17,.17) !important;
          border-radius: 0 !important;
          background: var(--card) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.38), 0 12px 32px rgba(66,45,19,.08) !important;
        }

        .exp6-stage section.bg-transparent div[class*="rounded-[14px]"]::before {
          content: "";
          position: absolute;
          left: 12px;
          top: 12px;
          bottom: 12px;
          width: 3px;
          background: linear-gradient(var(--gold), var(--wine));
          opacity: .75;
          pointer-events: none;
        }

        .exp6-stage section.bg-transparent a[href^="/channel/"] {
          border: 1px solid rgba(26,22,17,.24) !important;
          border-radius: 0 !important;
          background: rgba(255,252,246,.88) !important;
          box-shadow: 6px 6px 0 rgba(111,125,85,.20) !important;
        }

        .exp6-stage section.bg-transparent a[href^="/channel/"] img {
          border-radius: 0 !important;
          filter: sepia(.16) contrast(1.03) saturate(.9);
        }

        .exp6-stage button[class*="rounded-full"],
        .exp6-stage a[class*="rounded-full"],
        .exp6-stage div[class*="rounded-full"] {
          border-radius: 0 !important;
        }

        .exp6-stage button[class*="bg-[#171717]"],
        .exp6-stage aside button.w-full,
        .exp6-stage aside button[class*="bg-primary"],
        .exp6-stage [class*="bg-primary"] {
          color: #fffaf0 !important;
          border: 1px solid var(--ink) !important;
          border-radius: 0 !important;
          background: linear-gradient(135deg, var(--ink), #3a2a1b) !important;
          box-shadow: 6px 6px 0 rgba(176,131,58,.28) !important;
        }

        .exp6-stage button[class*="bg-[#171717]"]:hover,
        .exp6-stage aside button.w-full:hover,
        .exp6-stage aside button[class*="bg-primary"]:hover {
          transform: translate(-1px, -1px);
          box-shadow: 9px 9px 0 rgba(176,131,58,.30) !important;
        }

        .exp6-stage [class*="bg-black/62"] {
          background-color: rgba(26,22,17,.70) !important;
        }

        .exp6-stage aside {
          position: relative;
          padding-left: 24px;
          border-left: 1px solid rgba(26,22,17,.16);
        }

        .exp6-stage aside::before {
          content: "watch list";
          display: block;
          margin-bottom: 12px;
          color: var(--gold);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .20em;
          text-transform: uppercase;
        }

        .exp6-stage aside h3 {
          display: inline-block;
          color: var(--ink) !important;
          border-bottom: 1px solid var(--ink) !important;
          font-size: 18px !important;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .exp6-stage aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 14px !important;
          overflow: visible;
          border: 1px solid rgba(26,22,17,.15) !important;
          border-radius: 0 !important;
          background: rgba(255,252,246,.78) !important;
          box-shadow: 8px 8px 0 rgba(26,22,17,.055) !important;
        }

        .exp6-stage aside a[href^="/?v="]::after {
          content: "";
          position: absolute;
          left: -1px;
          right: -1px;
          bottom: -1px;
          height: 3px;
          background: linear-gradient(90deg, var(--gold), var(--wine), var(--sage));
          opacity: .54;
          pointer-events: none;
        }

        .exp6-stage aside a[href^="/?v="]:hover {
          transform: translate(-2px, -2px);
          box-shadow: 12px 12px 0 rgba(26,22,17,.075) !important;
        }

        .exp6-stage aside a[aria-current="page"] {
          background: rgba(232,222,207,.95) !important;
          border-color: rgba(127,29,29,.28) !important;
        }

        .exp6-stage aside a[href^="/?v="] > div:first-child {
          border-radius: 0 !important;
          border-color: rgba(26,22,17,.25) !important;
          filter: sepia(.18) saturate(.86) contrast(1.06);
        }

        .exp6-stage aside a[href^="/?v="] > div:first-child::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 22;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255,252,246,.10), rgba(26,22,17,.12));
        }

        .exp6-stage div[class*="rounded-[16px]"],
        .exp6-stage div[class*="rounded-2xl"],
        .exp6-stage [role="menu"] {
          color: var(--ink) !important;
          background: rgba(255,252,246,.96) !important;
          border-color: rgba(26,22,17,.18) !important;
          border-radius: 0 !important;
        }

        .exp6-stage footer {
          background: transparent !important;
          border-color: rgba(26,22,17,.16) !important;
        }

        @media (max-width: 900px) {
          .exp6-index {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .experiment6-skin {
            padding: 0;
          }

          .exp6-stage {
            border-inline: 0;
            box-shadow: none;
          }

          .exp6-stage::before,
          .exp6-stage::after {
            display: none;
          }

          .exp6-stage aside {
            padding-left: 0;
            border-left: 0;
          }

          .exp6-stage section.bg-transparent > div > div.relative.aspect-video {
            box-shadow: 0 20px 48px rgba(66,45,19,.16) !important;
          }
        }
      `}</style>
    </div>
  );
}
