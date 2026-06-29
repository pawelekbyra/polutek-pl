"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentSevenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment7?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment7-skin">
      <div className="exp7-poster" aria-hidden="true">
        <span className="red" />
        <span className="blue" />
        <span className="yellow" />
      </div>
      <section className="exp7-stage" aria-label="Eksperyment 7 — bauhaus blocks">
        <div className="exp7-caption" aria-hidden="true">
          <b>POLUTEK</b>
          <span>layout system 07</span>
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment7-skin {
          --cream: #f7efe0;
          --ink: #101010;
          --ink-soft: rgba(16,16,16,.66);
          --red: #e54835;
          --blue: #2259d6;
          --yellow: #f4c542;
          --green: #1e8f6a;
          min-height: 100vh;
          padding: clamp(12px, 2.6vw, 40px);
          color: var(--ink);
          background:
            linear-gradient(90deg, rgba(16,16,16,.075) 1px, transparent 1px) 0 0 / 64px 64px,
            linear-gradient(rgba(16,16,16,.075) 1px, transparent 1px) 0 0 / 64px 64px,
            radial-gradient(circle at 6% 12%, rgba(229,72,53,.26), transparent 24vw),
            radial-gradient(circle at 92% 8%, rgba(34,89,214,.20), transparent 26vw),
            radial-gradient(circle at 86% 92%, rgba(244,197,66,.23), transparent 28vw),
            var(--cream);
          font-family: "Arial Black", Impact, "Inter", system-ui, sans-serif;
          overflow-x: hidden;
        }

        .experiment7-skin *,
        .experiment7-skin *::before,
        .experiment7-skin *::after {
          box-sizing: border-box;
        }

        .experiment7-skin * {
          font-family: "Arial Black", Impact, "Inter", system-ui, sans-serif !important;
        }

        .exp7-poster {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .exp7-poster span {
          position: absolute;
          display: block;
          border: 3px solid var(--ink);
          box-shadow: 12px 12px 0 rgba(16,16,16,.14);
        }

        .exp7-poster .red {
          width: clamp(80px, 14vw, 210px);
          aspect-ratio: 1;
          left: 3vw;
          bottom: 10vh;
          border-radius: 999px;
          background: var(--red);
        }

        .exp7-poster .blue {
          width: clamp(90px, 18vw, 280px);
          height: clamp(54px, 10vw, 154px);
          right: -4vw;
          top: 18vh;
          background: var(--blue);
          transform: rotate(-10deg);
        }

        .exp7-poster .yellow {
          width: clamp(70px, 11vw, 170px);
          height: clamp(110px, 17vw, 260px);
          right: 10vw;
          bottom: -5vh;
          background: var(--yellow);
          transform: rotate(17deg);
        }

        .exp7-stage {
          position: relative;
          z-index: 1;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          border: 4px solid var(--ink);
          background:
            linear-gradient(90deg, rgba(16,16,16,.07) 1px, transparent 1px) 0 0 / 32px 32px,
            linear-gradient(rgba(16,16,16,.07) 1px, transparent 1px) 0 0 / 32px 32px,
            rgba(247,239,224,.92);
          box-shadow: 18px 18px 0 var(--ink);
          isolation: isolate;
        }

        .exp7-stage::before {
          content: "07";
          position: absolute;
          left: clamp(16px, 3vw, 44px);
          top: clamp(78px, 8vw, 112px);
          z-index: 0;
          color: rgba(16,16,16,.055);
          font-size: clamp(150px, 28vw, 420px);
          line-height: .75;
          font-weight: 950;
          letter-spacing: -.12em;
          pointer-events: none;
        }

        .exp7-caption {
          position: absolute;
          top: 18px;
          right: 18px;
          z-index: 1002;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          color: var(--cream);
          background: var(--ink);
          border: 3px solid var(--ink);
          box-shadow: 6px 6px 0 var(--red);
          font-size: 10px;
          letter-spacing: .16em;
          text-transform: uppercase;
          pointer-events: none;
        }

        .exp7-caption b,
        .exp7-caption span {
          color: inherit !important;
        }

        .exp7-stage > .exp7-caption + div,
        .exp7-stage > div:first-child:not(.exp7-caption) {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(247, 239, 224, .92) !important;
          border-bottom: 4px solid var(--ink) !important;
          box-shadow: 0 8px 0 var(--yellow) !important;
          backdrop-filter: blur(8px);
        }

        .exp7-stage main[class*="bg-neutral-50"],
        .exp7-stage .bg-neutral-50,
        .exp7-stage .bg-white,
        .exp7-stage .bg-background\/80,
        .exp7-stage .bg-secondary {
          background: transparent !important;
        }

        .exp7-stage .text-neutral-900,
        .exp7-stage .text-foreground,
        .exp7-stage .text-black,
        .exp7-stage h1,
        .exp7-stage h2,
        .exp7-stage h3,
        .exp7-stage strong {
          color: var(--ink) !important;
        }

        .exp7-stage .text-neutral-700,
        .exp7-stage .text-neutral-600,
        .exp7-stage .text-muted-foreground,
        .exp7-stage p,
        .exp7-stage span {
          color: var(--ink-soft);
        }

        .exp7-stage .border,
        .exp7-stage .border-border,
        .exp7-stage .border-input,
        .exp7-stage .border-neutral-100,
        .exp7-stage .border-neutral-200,
        .exp7-stage .border-neutral-300 {
          border-color: var(--ink) !important;
        }

        .exp7-stage [class*="shadow"] {
          box-shadow: 8px 8px 0 rgba(16,16,16,.16) !important;
        }

        .exp7-stage input,
        .exp7-stage textarea {
          color: var(--ink) !important;
          background: #fff8e8 !important;
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          box-shadow: 5px 5px 0 var(--blue) !important;
        }

        .exp7-stage input:focus,
        .exp7-stage textarea:focus {
          outline: none !important;
          box-shadow: 5px 5px 0 var(--red), 0 0 0 4px rgba(244,197,66,.35) !important;
        }

        .exp7-stage section.bg-transparent {
          position: relative;
          z-index: 2;
        }

        .exp7-stage section.bg-transparent::before {
          content: "watch / build / remix";
          position: absolute;
          left: clamp(14px, 2vw, 28px);
          top: -10px;
          z-index: 22;
          padding: 7px 11px;
          color: var(--ink);
          background: var(--yellow);
          border: 3px solid var(--ink);
          box-shadow: 5px 5px 0 var(--blue);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .exp7-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 4px solid var(--ink) !important;
          border-radius: 0 !important;
          background: #101010 !important;
          box-shadow: 14px 14px 0 var(--red), 28px 28px 0 rgba(16,16,16,.13) !important;
        }

        .exp7-stage section.bg-transparent > div > div.relative.aspect-video::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 30;
          pointer-events: none;
          background:
            linear-gradient(135deg, transparent 48%, rgba(244,197,66,.22) 48% 52%, transparent 52%),
            linear-gradient(-135deg, transparent 48%, rgba(34,89,214,.16) 48% 52%, transparent 52%);
          mix-blend-mode: screen;
        }

        .exp7-stage section.bg-transparent h1 {
          display: inline;
          color: var(--ink) !important;
          letter-spacing: -.085em !important;
          text-transform: uppercase;
          text-shadow: 4px 4px 0 var(--yellow), 8px 8px 0 rgba(229,72,53,.34);
        }

        .exp7-stage section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          background: rgba(255,248,232,.88) !important;
          box-shadow: 8px 8px 0 rgba(16,16,16,.14) !important;
        }

        .exp7-stage section.bg-transparent div[class*="rounded-[14px]"]:nth-of-type(odd) {
          box-shadow: 8px 8px 0 rgba(34,89,214,.26) !important;
        }

        .exp7-stage section.bg-transparent a[href^="/channel/"] {
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          background: var(--yellow) !important;
          box-shadow: 6px 6px 0 var(--blue) !important;
        }

        .exp7-stage section.bg-transparent a[href^="/channel/"] img {
          border-radius: 0 !important;
          filter: saturate(1.15) contrast(1.08);
        }

        .exp7-stage button[class*="rounded-full"],
        .exp7-stage a[class*="rounded-full"],
        .exp7-stage div[class*="rounded-full"] {
          border-radius: 0 !important;
        }

        .exp7-stage button[class*="bg-[#171717]"],
        .exp7-stage aside button.w-full,
        .exp7-stage aside button[class*="bg-primary"],
        .exp7-stage [class*="bg-primary"] {
          color: var(--cream) !important;
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          background: var(--blue) !important;
          box-shadow: 6px 6px 0 var(--ink) !important;
        }

        .exp7-stage button[class*="bg-[#171717]"]:hover,
        .exp7-stage aside button.w-full:hover,
        .exp7-stage aside button[class*="bg-primary"]:hover {
          transform: translate(-2px, -2px);
          box-shadow: 9px 9px 0 var(--ink) !important;
        }

        .exp7-stage [class*="bg-black/62"] {
          background-color: rgba(16,16,16,.72) !important;
        }

        .exp7-stage aside {
          position: relative;
          padding-left: 22px;
          border-left: 4px solid var(--ink);
        }

        .exp7-stage aside::before {
          content: "next blocks";
          display: inline-block;
          margin-bottom: 12px;
          padding: 6px 10px;
          color: var(--ink);
          background: var(--red);
          border: 3px solid var(--ink);
          box-shadow: 5px 5px 0 var(--yellow);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .exp7-stage aside h3 {
          display: inline-block;
          color: var(--ink) !important;
          background: var(--cream);
          border: 3px solid var(--ink) !important;
          box-shadow: 5px 5px 0 var(--blue);
          padding: 5px 9px;
          text-transform: uppercase;
        }

        .exp7-stage aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 14px !important;
          overflow: visible;
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          background: rgba(255,248,232,.90) !important;
          box-shadow: 7px 7px 0 rgba(16,16,16,.16) !important;
        }

        .exp7-stage aside a[href^="/?v="]:nth-of-type(3n+1) {
          box-shadow: 7px 7px 0 var(--yellow) !important;
        }

        .exp7-stage aside a[href^="/?v="]:nth-of-type(3n+2) {
          box-shadow: 7px 7px 0 rgba(229,72,53,.72) !important;
        }

        .exp7-stage aside a[href^="/?v="]:hover {
          transform: translate(-2px, -2px) rotate(-.4deg);
          box-shadow: 11px 11px 0 var(--ink) !important;
        }

        .exp7-stage aside a[aria-current="page"] {
          background: var(--yellow) !important;
          box-shadow: 9px 9px 0 var(--blue) !important;
        }

        .exp7-stage aside a[href^="/?v="] > div:first-child {
          border-radius: 0 !important;
          border-color: var(--ink) !important;
          filter: saturate(1.1) contrast(1.1);
        }

        .exp7-stage aside a[href^="/?v="] > div:first-child::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 22;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(244,197,66,.18), transparent 44%, rgba(34,89,214,.12));
        }

        .exp7-stage div[class*="rounded-[16px]"],
        .exp7-stage div[class*="rounded-2xl"],
        .exp7-stage [role="menu"] {
          color: var(--ink) !important;
          background: rgba(255,248,232,.98) !important;
          border-color: var(--ink) !important;
          border-radius: 0 !important;
        }

        .exp7-stage footer {
          background: transparent !important;
          border-color: var(--ink) !important;
        }

        @media (max-width: 768px) {
          .experiment7-skin {
            padding: 0;
          }

          .exp7-stage {
            border-inline: 0;
            box-shadow: none;
          }

          .exp7-caption,
          .exp7-stage::before,
          .exp7-stage section.bg-transparent::before {
            display: none;
          }

          .exp7-stage aside {
            padding-left: 0;
            border-left: 0;
          }

          .exp7-stage section.bg-transparent > div > div.relative.aspect-video {
            box-shadow: 8px 8px 0 var(--red) !important;
          }
        }
      `}</style>
    </div>
  );
}
