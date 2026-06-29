"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentSeventeenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment17?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment17-skin">
      <div className="exp17-marks" aria-hidden="true">
        <span className="note" />
        <span className="tab" />
        <span className="stamp" />
      </div>
      <section className="exp17-stage" aria-label="Eksperyment 17 — spokojny szkic">
        <div className="exp17-caption" aria-hidden="true">POLUTEK · eksperyment 17</div>
        {children}
      </section>

      <style jsx global>{`
        .experiment17-skin {
          --paper: #f7f1e4;
          --ink: #121212;
          --soft: rgba(18,18,18,.68);
          --faint: rgba(18,18,18,.13);
          --marker: rgba(250, 213, 103, .62);
          --sage: rgba(191, 220, 190, .58);
          --blue: #1f5bd8;
          min-height: 100vh;
          position: relative;
          padding-inline: clamp(12px, 3vw, 44px);
          color: var(--ink);
          background: linear-gradient(90deg, var(--faint) 1px, transparent 1px) 0 0 / 42px 42px, linear-gradient(var(--faint) 1px, transparent 1px) 0 0 / 42px 42px, var(--paper);
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive;
          overflow-x: hidden;
        }

        .experiment17-skin *, .experiment17-skin *::before, .experiment17-skin *::after { box-sizing: border-box; }
        .experiment17-skin * { font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive !important; }

        .exp17-marks { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .exp17-marks span { position: absolute; display: block; opacity: .72; border: 1.8px solid rgba(18,18,18,.58); background: rgba(247,241,228,.44); }
        .exp17-marks .note { width: clamp(120px, 16vw, 230px); height: clamp(80px, 11vw, 160px); left: -24px; top: 17vh; border-radius: 4px; background: var(--sage); transform: rotate(-8deg); }
        .exp17-marks .tab { width: clamp(90px, 12vw, 180px); height: clamp(48px, 7vw, 92px); right: -18px; top: 19vh; border-radius: 999px; background: rgba(31,91,216,.14); transform: rotate(9deg); }
        .exp17-marks .stamp { width: clamp(84px, 11vw, 160px); aspect-ratio: 1; right: 12vw; bottom: 5vh; border-radius: 4px; background: rgba(250,213,103,.28); transform: rotate(-3deg); }

        .exp17-stage { position: relative; z-index: 1; width: min(100%, 1500px); min-height: 100vh; margin-inline: auto; overflow: visible; background: transparent; isolation: isolate; }
        .exp17-stage::before { content: "17"; position: absolute; left: clamp(16px, 3vw, 44px); top: clamp(78px, 8vw, 112px); z-index: -1; color: rgba(18,18,18,.045); font-size: clamp(130px, 24vw, 360px); line-height: .78; font-weight: 950; letter-spacing: -.12em; pointer-events: none; }
        .exp17-caption { position: absolute; top: 16px; right: 18px; z-index: 1002; padding: 6px 9px; background: rgba(247,241,228,.92); border: 1.6px solid rgba(18,18,18,.68); border-radius: 3px; box-shadow: 3px 3px 0 rgba(18,18,18,.13); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; pointer-events: none; }
        .exp17-stage > .exp17-caption + div, .exp17-stage > div:first-child:not(.exp17-caption) { position: sticky !important; top: 0 !important; z-index: 1000 !important; overflow: visible !important; background: rgba(247,241,228,.94) !important; border-bottom: 0 !important; box-shadow: none !important; backdrop-filter: blur(8px); }
        .exp17-stage > .exp17-caption + div::after, .exp17-stage > div:first-child:not(.exp17-caption)::after { content: ""; position: absolute; left: 18px; right: 18px; bottom: -3px; height: 7px; background: var(--ink); opacity: .72; pointer-events: none; }

        .exp17-stage main[class*="bg-neutral-50"], .exp17-stage .bg-neutral-50, .exp17-stage .bg-white, .exp17-stage [class*="bg-background"], .exp17-stage .bg-secondary { background: transparent !important; }
        .exp17-stage .text-neutral-900, .exp17-stage .text-foreground, .exp17-stage .text-black, .exp17-stage h1, .exp17-stage h2, .exp17-stage h3, .exp17-stage strong { color: var(--ink) !important; }
        .exp17-stage .text-neutral-700, .exp17-stage .text-neutral-600, .exp17-stage .text-muted-foreground, .exp17-stage p, .exp17-stage span { color: var(--soft); }
        .exp17-stage .border, .exp17-stage .border-border, .exp17-stage .border-input, .exp17-stage .border-neutral-100, .exp17-stage .border-neutral-200, .exp17-stage .border-neutral-300 { border-color: var(--soft) !important; }
        .exp17-stage [class*="shadow"] { box-shadow: none !important; }
        .exp17-stage input, .exp17-stage textarea { background: rgba(247,241,228,.94) !important; border: 1.8px solid rgba(18,18,18,.78) !important; border-radius: 3px !important; box-shadow: none !important; }
        .exp17-stage section.bg-transparent > div > div.relative.aspect-video { overflow: hidden; border: 2px solid var(--ink) !important; border-radius: 3px !important; background: #151515 !important; box-shadow: 7px 7px 0 rgba(18,18,18,.12) !important; }
        .exp17-stage section.bg-transparent h1 { display: inline; letter-spacing: .005em !important; background: linear-gradient(transparent 49%, var(--marker) 49% 82%, transparent 82%); }
        .exp17-stage section.bg-transparent div[class*="rounded"], .exp17-stage div[class*="rounded"], .exp17-stage [role="menu"] { border-color: rgba(18,18,18,.56) !important; border-radius: 4px !important; background: rgba(247,241,228,.86) !important; }
        .exp17-stage button[class*="bg-[#171717]"], .exp17-stage aside button.w-full, .exp17-stage aside button[class*="bg-primary"], .exp17-stage [class*="bg-primary"], .exp17-stage [class*="bg-black"] { background-color: var(--ink) !important; color: white !important; border-radius: 4px !important; }
        .exp17-stage aside { padding-left: 22px; border-left: 2px solid rgba(18,18,18,.52); }
        .exp17-stage aside::before { content: "kolejne szkice"; display: inline-block; margin-bottom: 12px; padding: 4px 8px; background: var(--sage); border: 1.5px solid rgba(18,18,18,.55); border-radius: 3px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; transform: rotate(-.5deg); }
        .exp17-stage aside a { margin-bottom: 12px !important; border: 1.6px solid rgba(18,18,18,.58) !important; border-radius: 3px !important; background: rgba(247,241,228,.82) !important; }
        .exp17-stage footer { background: transparent !important; }

        @media (max-width: 768px) { .experiment17-skin { padding-inline: 0; } .exp17-caption, .exp17-stage::before { display: none; } .exp17-stage aside { padding-left: 0; border-left: 0; } }
      `}</style>
    </div>
  );
}
