"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentTwentyTwoSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment22?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment22-skin">
      <div className="exp22-poster" aria-hidden="true">
        <span className="circle" />
        <span className="blue" />
        <span className="yellow" />
      </div>
      <section className="exp22-stage" aria-label="Eksperyment 22 — bauhaus scroll background">
        <div className="exp22-caption" aria-hidden="true">
          <b>POLUTEK</b>
          <span>layout system 22 · scrolling background</span>
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment22-skin {
          --cream: #f7efe0;
          --ink: #101010;
          --ink-soft: rgba(16, 16, 16, .66);
          --blue: #2259d6;
          --yellow: #f4c542;
          --green: #1e8f6a;
          min-height: 100vh;
          position: relative;
          padding: clamp(12px, 2.6vw, 40px);
          color: var(--ink);
          background:
            linear-gradient(90deg, rgba(16, 16, 16, .075) 1px, transparent 1px) 0 0 / 64px 64px,
            linear-gradient(rgba(16, 16, 16, .075) 1px, transparent 1px) 0 0 / 64px 64px,
            radial-gradient(circle at 92% 8%, rgba(34, 89, 214, .20), transparent 26vw),
            radial-gradient(circle at 86% 92%, rgba(244, 197, 66, .23), transparent 28vw),
            var(--cream);
          font-family: "Arial Black", Impact, Inter, system-ui, sans-serif;
          overflow-x: hidden;
          isolation: isolate;
        }

        .experiment22-skin *,
        .experiment22-skin *::before,
        .experiment22-skin *::after {
          box-sizing: border-box;
        }

        .experiment22-skin * {
          font-family: "Arial Black", Impact, Inter, system-ui, sans-serif !important;
        }

        .exp22-poster {
          position: absolute;
          inset: 0;
          z-index: 0;
          min-height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .exp22-poster span {
          position: absolute;
          display: block;
          border: 3px solid var(--ink);
          box-shadow: 12px 12px 0 rgba(16, 16, 16, .12);
        }

        .exp22-poster .circle {
          width: clamp(80px, 14vw, 210px);
          aspect-ratio: 1;
          left: 3vw;
          top: 72vh;
          border-radius: 999px;
          background: var(--green);
          opacity: .82;
        }

        .exp22-poster .blue {
          width: clamp(90px, 18vw, 280px);
          height: clamp(54px, 10vw, 154px);
          right: -4vw;
          top: 22vh;
          background: var(--blue);
          transform: rotate(-10deg);
          opacity: .84;
        }

        .exp22-poster .yellow {
          width: clamp(70px, 11vw, 170px);
          height: clamp(110px, 17vw, 260px);
          right: 10vw;
          top: 118vh;
          background: var(--yellow);
          transform: rotate(17deg);
          opacity: .78;
        }

        .exp22-stage {
          position: relative;
          z-index: 1;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          border: 3px solid var(--ink);
          background: rgba(247, 239, 224, .76);
          box-shadow: 18px 18px 0 rgba(16, 16, 16, .10);
          isolation: isolate;
        }

        .exp22-caption {
          position: absolute;
          top: 18px;
          right: 18px;
          z-index: 1002;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          color: var(--ink);
          background: rgba(247, 239, 224, .86);
          border: 3px solid var(--ink);
          transform: rotate(-1deg);
          pointer-events: none;
        }

        .exp22-caption b,
        .exp22-caption span {
          color: var(--ink) !important;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .exp22-stage > .exp22-caption + div,
        .exp22-stage > div:first-child:not(.exp22-caption) {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(247, 239, 224, .92) !important;
          border-bottom: 4px solid var(--ink) !important;
          box-shadow: 0 8px 0 var(--yellow) !important;
          backdrop-filter: blur(8px);
        }

        .exp22-stage main[class*="bg-neutral-50"],
        .exp22-stage .bg-neutral-50,
        .exp22-stage .bg-white,
        .exp22-stage [class*="bg-background"],
        .exp22-stage .bg-secondary {
          background: transparent !important;
        }

        .exp22-stage .text-neutral-900,
        .exp22-stage .text-foreground,
        .exp22-stage .text-black,
        .exp22-stage h1,
        .exp22-stage h2,
        .exp22-stage h3,
        .exp22-stage strong {
          color: var(--ink) !important;
        }

        .exp22-stage .text-neutral-700,
        .exp22-stage .text-neutral-600,
        .exp22-stage .text-muted-foreground,
        .exp22-stage p,
        .exp22-stage span {
          color: var(--ink-soft);
        }

        .exp22-stage .border,
        .exp22-stage .border-border,
        .exp22-stage .border-input,
        .exp22-stage .border-neutral-100,
        .exp22-stage .border-neutral-200,
        .exp22-stage .border-neutral-300 {
          border-color: rgba(16, 16, 16, .50) !important;
        }

        .exp22-stage [class*="shadow"] {
          box-shadow: none !important;
        }

        .exp22-stage input,
        .exp22-stage textarea {
          background: rgba(247, 239, 224, .92) !important;
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          box-shadow: 5px 5px 0 var(--blue) !important;
        }

        .exp22-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 4px solid var(--ink) !important;
          border-radius: 0 !important;
          background: #111 !important;
          box-shadow: 12px 12px 0 var(--blue) !important;
        }

        .exp22-stage section.bg-transparent > div > div.relative.aspect-video::after {
          content: "scroll bg";
          position: absolute;
          left: 14px;
          top: 12px;
          z-index: 35;
          padding: 4px 8px;
          color: var(--ink);
          background: var(--yellow);
          border: 3px solid var(--ink);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .10em;
          pointer-events: none;
        }

        .exp22-stage section.bg-transparent h1 {
          display: inline;
          letter-spacing: -.06em !important;
          background: linear-gradient(transparent 55%, rgba(244, 197, 66, .62) 55% 88%, transparent 88%);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }

        .exp22-stage section.bg-transparent div[class*="rounded"] {
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          background: rgba(247, 239, 224, .82) !important;
          box-shadow: 7px 7px 0 rgba(16, 16, 16, .08) !important;
        }

        .exp22-stage button[class*="bg-[#171717]"],
        .exp22-stage aside button.w-full,
        .exp22-stage aside button[class*="bg-primary"],
        .exp22-stage [class*="bg-primary"] {
          color: var(--cream) !important;
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          background: var(--ink) !important;
          box-shadow: 5px 5px 0 var(--yellow) !important;
        }

        .exp22-stage [class*="bg-black"] {
          background-color: rgba(16, 16, 16, .72) !important;
        }

        .exp22-stage aside {
          position: relative;
          padding-left: 24px;
          border-left: 4px solid var(--ink);
        }

        .exp22-stage aside::before {
          content: "scrolling poster";
          display: inline-block;
          margin-bottom: 12px;
          padding: 4px 8px;
          color: var(--ink);
          background: var(--yellow);
          border: 3px solid var(--ink);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
          transform: rotate(-1deg);
        }

        .exp22-stage aside a {
          margin-bottom: 12px !important;
          border: 3px solid var(--ink) !important;
          border-radius: 0 !important;
          background: rgba(247, 239, 224, .88) !important;
        }

        .exp22-stage aside a:hover {
          transform: translateY(-2px) rotate(-.3deg);
          box-shadow: 7px 7px 0 var(--blue) !important;
        }

        .exp22-stage aside a[aria-current="page"] {
          background: rgba(244, 197, 66, .28) !important;
        }

        .exp22-stage aside a > div:first-child {
          border-radius: 0 !important;
          filter: saturate(.96) contrast(1.06);
        }

        .exp22-stage div[class*="rounded"],
        .exp22-stage [role="menu"] {
          background: rgba(247, 239, 224, .96) !important;
          border-color: var(--ink) !important;
          border-radius: 0 !important;
        }

        .exp22-stage footer {
          background: transparent !important;
          border-color: rgba(16, 16, 16, .24) !important;
        }

        @media (max-width: 768px) {
          .experiment22-skin {
            padding: 0;
          }

          .exp22-stage {
            border-inline: 0;
            box-shadow: none;
          }

          .exp22-caption {
            display: none;
          }

          .exp22-poster {
            opacity: .45;
          }

          .exp22-stage aside {
            padding-left: 0;
            border-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
