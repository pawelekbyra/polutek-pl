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
      <div className="exp21-deco" aria-hidden="true">
        <span className="exp21-stack-a" />
        <span className="exp21-stack-b" />
        <span className="exp21-tab" />
        <span className="exp21-cross-h" />
        <span className="exp21-cross-v" />
        <span className="exp21-note">NEW</span>
        <span className="exp21-note2">BETA</span>
      </div>
      <section className="exp21-stage" aria-label="Eksperyment 21 — sketch cards amber">
        <div className="exp21-caption" aria-hidden="true">POLUTEK · eksperyment 21 · cards</div>
        {children}
      </section>

      <style jsx global>{`
        .experiment21-skin {
          --paper: #f5efe0;
          --cream: #fffcf5;
          --ink: #18150f;
          --soft: rgba(24,21,15,.62);
          --faint: rgba(24,21,15,.08);
          --amber: #f4c542;
          --amber-mid: rgba(244,197,66,.50);
          --blue: #2259d6;
          --blue-faint: rgba(34,89,214,.13);
          --sage: #c5d9b4;
          min-height: 100vh;
          position: relative;
          padding: clamp(10px, 2.2vw, 34px);
          color: var(--ink);
          /* dot-grid paper */
          background:
            radial-gradient(circle, rgba(24,21,15,.18) 1px, transparent 1px) 0 0 / 24px 24px,
            var(--paper);
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
          overflow-x: hidden;
          isolation: isolate;
        }

        .experiment21-skin *, .experiment21-skin *::before, .experiment21-skin *::after { box-sizing: border-box; }
        .experiment21-skin * { font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important; }

        /* decorative stacked card shapes */
        .exp21-deco { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .exp21-stack-a {
          position: absolute; display: block;
          width: clamp(90px, 14vw, 210px); height: clamp(70px, 11vw, 160px);
          right: 3vw; top: 8vh;
          border: 1.5px solid rgba(24,21,15,.28);
          border-radius: clamp(10px, 1.4vw, 18px);
          background: rgba(255,252,245,.80);
          transform: rotate(5deg);
          box-shadow: 4px 4px 0 rgba(24,21,15,.07);
        }
        .exp21-stack-b {
          position: absolute; display: block;
          width: clamp(90px, 14vw, 210px); height: clamp(70px, 11vw, 160px);
          right: calc(3vw + 8px); top: calc(8vh + 10px);
          border: 1.5px solid rgba(24,21,15,.18);
          border-radius: clamp(10px, 1.4vw, 18px);
          background: var(--amber-mid);
          transform: rotate(10deg);
        }
        .exp21-tab {
          position: absolute; display: block;
          width: clamp(100px, 16vw, 220px); height: clamp(40px, 5.5vw, 72px);
          left: 1.5vw; bottom: 24vh;
          border: 1.5px solid rgba(24,21,15,.22);
          border-radius: 999px;
          background: var(--blue-faint);
          transform: rotate(-3deg);
        }
        .exp21-cross-h {
          position: absolute; display: block;
          width: clamp(48px, 7vw, 100px); height: 1.5px;
          left: 6vw; top: 40vh;
          background: rgba(24,21,15,.22);
        }
        .exp21-cross-v {
          position: absolute; display: block;
          width: 1.5px; height: clamp(48px, 7vw, 100px);
          left: calc(6vw + clamp(22px, 3.3vw, 48px)); top: calc(40vh - clamp(22px, 3.3vw, 48px));
          background: rgba(24,21,15,.22);
        }
        .exp21-note, .exp21-note2 {
          position: absolute;
          padding: 4px 10px;
          border: 1.5px solid rgba(24,21,15,.32);
          border-radius: 999px;
          font-size: 9px; font-weight: 900; letter-spacing: .18em;
          font-family: "Comic Sans MS", cursive !important;
          pointer-events: none;
        }
        .exp21-note { right: 5vw; bottom: 20vh; background: var(--amber); color: var(--ink); transform: rotate(2deg); }
        .exp21-note2 { left: 3vw; top: 18vh; background: var(--sage); color: var(--ink); transform: rotate(-4deg); border-radius: 4px; border-style: dashed; }

        .exp21-stage {
          position: relative; z-index: 1;
          width: min(100%, 1500px); min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          background: rgba(255,252,245,.92);
          border: 1.5px solid rgba(24,21,15,.52);
          border-radius: clamp(12px, 1.6vw, 20px);
          box-shadow: 6px 6px 0 rgba(24,21,15,.10), 12px 12px 0 rgba(24,21,15,.05);
          isolation: isolate;
        }
        .exp21-caption {
          position: absolute; top: 14px; right: 14px; z-index: 1002;
          padding: 5px 10px;
          background: var(--cream);
          border: 1.5px solid rgba(24,21,15,.42);
          border-radius: 4px;
          font-size: 10px; font-weight: 900;
          letter-spacing: .13em; text-transform: uppercase;
          transform: rotate(-.6deg);
          pointer-events: none;
        }

        /* sticky nav */
        .exp21-stage > .exp21-caption + div,
        .exp21-stage > div:first-child:not(.exp21-caption) {
          position: sticky !important; top: 0 !important; z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(255,252,245,.96) !important;
          border-bottom: 1.5px solid rgba(24,21,15,.32) !important;
          box-shadow: 0 3px 0 var(--amber-mid) !important;
          backdrop-filter: blur(8px);
          border-radius: clamp(12px, 1.6vw, 20px) clamp(12px, 1.6vw, 20px) 0 0 !important;
        }

        /* content resets */
        .exp21-stage main[class*="bg-neutral-50"],
        .exp21-stage .bg-neutral-50, .exp21-stage .bg-white,
        .exp21-stage [class*="bg-background"], .exp21-stage .bg-secondary { background: transparent !important; }
        .exp21-stage .text-neutral-900, .exp21-stage .text-foreground, .exp21-stage .text-black,
        .exp21-stage h1, .exp21-stage h2, .exp21-stage h3, .exp21-stage strong { color: var(--ink) !important; }
        .exp21-stage .text-neutral-700, .exp21-stage .text-neutral-600,
        .exp21-stage .text-muted-foreground, .exp21-stage p, .exp21-stage span { color: var(--soft); }
        .exp21-stage .border, .exp21-stage .border-border, .exp21-stage .border-input,
        .exp21-stage .border-neutral-100, .exp21-stage .border-neutral-200,
        .exp21-stage .border-neutral-300 { border-color: rgba(24,21,15,.28) !important; }
        .exp21-stage [class*="shadow"] { box-shadow: none !important; }

        /* inputs */
        .exp21-stage input, .exp21-stage textarea {
          background: rgba(255,252,245,.96) !important;
          border: 1.5px solid rgba(24,21,15,.48) !important;
          border-radius: clamp(8px, 1.2vw, 14px) !important;
          box-shadow: 3px 3px 0 rgba(24,21,15,.08) !important;
        }

        /* video */
        .exp21-stage section.bg-transparent > div > div.relative.aspect-video {
          overflow: hidden;
          border: 1.5px solid rgba(24,21,15,.52) !important;
          border-radius: clamp(8px, 1.2vw, 14px) !important;
          background: #111 !important;
          box-shadow: 6px 6px 0 rgba(24,21,15,.10) !important;
        }

        /* h1 with amber box highlight */
        .exp21-stage section.bg-transparent h1 {
          display: inline;
          letter-spacing: .005em !important;
          background: linear-gradient(transparent 44%, var(--amber-mid) 44% 86%, transparent 86%);
        }

        /* cards — rounded like in reference image */
        .exp21-stage section.bg-transparent div[class*="rounded"],
        .exp21-stage div[class*="rounded"],
        .exp21-stage [role="menu"] {
          border: 1.5px solid rgba(24,21,15,.28) !important;
          border-radius: clamp(10px, 1.4vw, 18px) !important;
          background: rgba(255,252,245,.88) !important;
          box-shadow: 4px 4px 0 rgba(24,21,15,.07) !important;
        }

        /* primary buttons */
        .exp21-stage button[class*="bg-[#171717]"],
        .exp21-stage aside button.w-full,
        .exp21-stage aside button[class*="bg-primary"],
        .exp21-stage [class*="bg-primary"] {
          color: #fff !important;
          border: 1.5px solid rgba(24,21,15,.20) !important;
          border-radius: 999px !important;
          background: var(--ink) !important;
          box-shadow: 3px 3px 0 var(--amber) !important;
        }

        /* sidebar */
        .exp21-stage aside {
          padding-left: 20px;
          border-left: 1.5px solid rgba(24,21,15,.28);
        }
        .exp21-stage aside::before {
          content: "PUBLICZNE";
          display: inline-block;
          margin-bottom: 12px;
          padding: 4px 10px;
          background: var(--ink);
          color: #fff;
          border: 1.5px solid rgba(24,21,15,.44);
          border-radius: 999px;
          font-size: 9px; letter-spacing: .18em; text-transform: uppercase;
        }
        .exp21-stage aside a {
          margin-bottom: 10px !important;
          border: 1.5px solid rgba(24,21,15,.24) !important;
          border-radius: clamp(8px, 1.2vw, 14px) !important;
          background: rgba(255,252,245,.84) !important;
        }
        .exp21-stage footer { background: transparent !important; }

        @media (max-width: 768px) {
          .experiment21-skin { padding: 0; }
          .exp21-stage { border-radius: 0; border-inline: 0; box-shadow: none; }
          .exp21-caption { display: none; }
          .exp21-deco { display: none; }
          .exp21-stage aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
