"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentNineteenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment19?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment19-skin">
      <div className="exp19-deco" aria-hidden="true">
        <span className="exp19-box" />
        <span className="exp19-circle" />
        <span className="exp19-line" />
        <span className="exp19-bracket-l">[</span>
        <span className="exp19-bracket-r">]</span>
      </div>
      <section className="exp19-stage" aria-label="Eksperyment 19 — rough notation paper">
        <div className="exp19-caption" aria-hidden="true">POLUTEK · eksperyment 19 · notation</div>
        {children}
      </section>

      <style jsx global>{`
        .experiment19-skin {
          --paper: #f7f1e4;
          --cream: #fffaf0;
          --ink: #171411;
          --soft: rgba(23,20,17,.65);
          --faint: rgba(23,20,17,.09);
          --amber: rgba(244,197,66,.72);
          --amber-solid: #f4c542;
          --sage: rgba(143,179,118,.55);
          --sage-solid: #5f7c4a;
          --blue: #1f5bd8;
          min-height: 100vh;
          position: relative;
          padding: clamp(10px, 2.4vw, 36px);
          color: var(--ink);
          /* lined paper background */
          background:
            linear-gradient(transparent calc(100% - 1px), rgba(23,20,17,.08) calc(100% - 1px)) 0 0 / 100% 32px,
            var(--paper);
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
          overflow-x: hidden;
          isolation: isolate;
        }

        .experiment19-skin *, .experiment19-skin *::before, .experiment19-skin *::after { box-sizing: border-box; }
        .experiment19-skin * { font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important; }

        /* decorative rough elements behind stage */
        .exp19-deco { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .exp19-box {
          position: absolute; display: block;
          width: clamp(60px, 10vw, 160px); height: clamp(60px, 10vw, 160px);
          right: 2vw; top: 14vh;
          border: 2px solid rgba(23,20,17,.28);
          background: rgba(244,197,66,.18);
          transform: rotate(8deg);
          box-shadow: 4px 4px 0 rgba(23,20,17,.09);
        }
        .exp19-circle {
          position: absolute; display: block;
          width: clamp(80px, 13vw, 200px); aspect-ratio: 1;
          left: 1.5vw; bottom: 22vh;
          border: 2px solid rgba(23,20,17,.22);
          border-radius: 50%;
          background: rgba(143,179,118,.22);
        }
        .exp19-line {
          position: absolute; display: block;
          width: clamp(100px, 18vw, 280px); height: 2px;
          right: 8vw; bottom: 12vh;
          background: rgba(23,20,17,.20);
          transform: rotate(-2deg);
        }
        .exp19-bracket-l, .exp19-bracket-r {
          position: absolute;
          font-size: clamp(80px, 14vw, 200px);
          color: rgba(23,20,17,.06);
          line-height: 1;
          font-family: "Comic Sans MS", cursive !important;
          font-weight: 900;
          pointer-events: none;
        }
        .exp19-bracket-l { left: -1vw; top: 30vh; }
        .exp19-bracket-r { right: -0.5vw; top: 55vh; }

        .exp19-stage {
          position: relative; z-index: 1;
          width: min(100%, 1500px); min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          background: rgba(255,250,240,.88);
          border: 2px solid rgba(23,20,17,.72);
          box-shadow: 8px 8px 0 rgba(23,20,17,.10), 16px 16px 0 rgba(23,20,17,.05);
          isolation: isolate;
        }
        /* Red margin line like a notebook */
        .exp19-stage::before {
          content: "";
          position: absolute;
          left: 48px; top: 0; bottom: 0; width: 1px;
          background: rgba(220,60,60,.28);
          pointer-events: none;
          z-index: 0;
        }
        .exp19-caption {
          position: absolute; top: 12px; right: 14px; z-index: 1002;
          padding: 5px 9px;
          background: var(--amber-solid);
          border: 2px solid var(--ink);
          font-size: 10px; font-weight: 900;
          letter-spacing: .13em; text-transform: uppercase;
          transform: rotate(.8deg);
          pointer-events: none;
        }

        /* sticky nav */
        .exp19-stage > .exp19-caption + div,
        .exp19-stage > div:first-child:not(.exp19-caption) {
          position: sticky !important; top: 0 !important; z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(255,250,240,.96) !important;
          border-bottom: 2px solid var(--ink) !important;
          box-shadow: 0 4px 0 var(--amber) !important;
          backdrop-filter: blur(6px);
        }

        /* content resets */
        .exp19-stage main[class*="bg-neutral-50"],
        .exp19-stage .bg-neutral-50, .exp19-stage .bg-white,
        .exp19-stage [class*="bg-background"], .exp19-stage .bg-secondary { background: transparent !important; }
        .exp19-stage .text-neutral-900, .exp19-stage .text-foreground, .exp19-stage .text-black,
        .exp19-stage h1, .exp19-stage h2, .exp19-stage h3, .exp19-stage strong { color: var(--ink) !important; }
        .exp19-stage .text-neutral-700, .exp19-stage .text-neutral-600,
        .exp19-stage .text-muted-foreground, .exp19-stage p, .exp19-stage span { color: var(--soft); }
        .exp19-stage .border, .exp19-stage .border-border, .exp19-stage .border-input,
        .exp19-stage .border-neutral-100, .exp19-stage .border-neutral-200,
        .exp19-stage .border-neutral-300 { border-color: rgba(23,20,17,.44) !important; }
        .exp19-stage [class*="shadow"] { box-shadow: none !important; }

        /* inputs */
        .exp19-stage input, .exp19-stage textarea {
          background: rgba(255,250,240,.94) !important;
          border: 2px solid rgba(23,20,17,.70) !important;
          border-radius: 0 !important;
          box-shadow: 3px 3px 0 rgba(23,20,17,.12) !important;
        }

        /* video */
        .exp19-stage section.bg-transparent > div > div.relative.aspect-video {
          overflow: hidden;
          border: 2px solid var(--ink) !important;
          border-radius: 0 !important;
          background: #111 !important;
          box-shadow: 8px 8px 0 rgba(23,20,17,.14) !important;
        }

        /* h1 with rough-notation style highlight */
        .exp19-stage section.bg-transparent h1 {
          display: inline;
          letter-spacing: .01em !important;
          background: linear-gradient(transparent 48%, var(--amber) 48% 84%, transparent 84%);
        }

        /* cards / rounded divs */
        .exp19-stage section.bg-transparent div[class*="rounded"],
        .exp19-stage div[class*="rounded"],
        .exp19-stage [role="menu"] {
          border: 2px solid rgba(23,20,17,.42) !important;
          border-radius: 0 !important;
          background: rgba(255,250,240,.86) !important;
          box-shadow: 4px 4px 0 rgba(23,20,17,.08) !important;
        }

        /* primary buttons */
        .exp19-stage button[class*="bg-[#171717]"],
        .exp19-stage aside button.w-full,
        .exp19-stage aside button[class*="bg-primary"],
        .exp19-stage [class*="bg-primary"] {
          color: var(--cream) !important;
          border: 2px solid var(--ink) !important;
          border-radius: 0 !important;
          background: var(--ink) !important;
          box-shadow: 4px 4px 0 var(--amber-solid) !important;
        }

        /* sidebar */
        .exp19-stage aside {
          padding-left: 20px;
          border-left: 2px solid rgba(23,20,17,.42);
        }
        .exp19-stage aside::before {
          content: "[ szkice ]";
          display: inline-block;
          margin-bottom: 12px;
          padding: 4px 8px;
          background: var(--sage);
          border: 2px solid rgba(23,20,17,.48);
          font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
          transform: rotate(-.6deg);
        }
        .exp19-stage aside a {
          margin-bottom: 12px !important;
          border: 2px solid rgba(23,20,17,.44) !important;
          border-radius: 0 !important;
          background: rgba(255,250,240,.84) !important;
        }
        .exp19-stage footer { background: transparent !important; }

        @media (max-width: 768px) {
          .experiment19-skin { padding: 0; }
          .exp19-stage { border-inline: 0; box-shadow: none; }
          .exp19-stage::before { display: none; }
          .exp19-caption { display: none; }
          .exp19-deco { display: none; }
          .exp19-stage aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
