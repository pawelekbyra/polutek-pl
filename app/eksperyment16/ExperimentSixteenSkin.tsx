"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentSixteenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment16?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment16-skin">
      <div className="exp16-shapes" aria-hidden="true">
        <span className="disc" />
        <span className="bar" />
        <span className="pillar" />
      </div>
      <section className="exp16-stage" aria-label="Eksperyment 16 — bauhaus bez czerwieni">
        <div className="exp16-caption" aria-hidden="true">POLUTEK · eksperyment 16</div>
        {children}
      </section>

      <style jsx global>{`
        .experiment16-skin {
          --paper: #f7efe0;
          --ink: #101010;
          --blue: #2259d6;
          --yellow: #f4c542;
          --green: #1e8f6a;
          --soft: rgba(16, 16, 16, .66);
          position: relative;
          min-height: 100vh;
          padding: clamp(12px, 2.6vw, 40px);
          color: var(--ink);
          background:
            linear-gradient(90deg, rgba(16,16,16,.075) 1px, transparent 1px) 0 0 / 64px 64px,
            linear-gradient(rgba(16,16,16,.075) 1px, transparent 1px) 0 0 / 64px 64px,
            radial-gradient(circle at 6% 12%, rgba(30,143,106,.22), transparent 24vw),
            radial-gradient(circle at 92% 8%, rgba(34,89,214,.18), transparent 26vw),
            var(--paper);
          overflow-x: hidden;
          font-family: "Arial Black", Impact, Inter, system-ui, sans-serif;
        }

        .experiment16-skin *, .experiment16-skin *::before, .experiment16-skin *::after { box-sizing: border-box; }
        .experiment16-skin * { font-family: "Arial Black", Impact, Inter, system-ui, sans-serif !important; }

        .exp16-shapes { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .exp16-shapes span { position: absolute; display: block; border: 3px solid var(--ink); box-shadow: 12px 12px 0 rgba(16,16,16,.14); }
        .exp16-shapes .disc { width: clamp(80px, 14vw, 210px); aspect-ratio: 1; left: 3vw; bottom: 10vh; border-radius: 999px; background: var(--green); }
        .exp16-shapes .bar { width: clamp(90px, 18vw, 280px); height: clamp(54px, 10vw, 154px); right: -4vw; top: 18vh; background: var(--blue); transform: rotate(-10deg); }
        .exp16-shapes .pillar { width: clamp(70px, 11vw, 170px); height: clamp(110px, 17vw, 260px); right: 10vw; bottom: -5vh; background: var(--yellow); transform: rotate(17deg); }

        .exp16-stage { position: relative; z-index: 1; width: min(100%, 1500px); min-height: 100vh; margin-inline: auto; overflow: hidden; border: 4px solid var(--ink); background: rgba(247,239,224,.92); box-shadow: 18px 18px 0 var(--ink); }
        .exp16-stage::before { content: "16"; position: absolute; left: clamp(16px, 3vw, 44px); top: clamp(78px, 8vw, 112px); z-index: 0; color: rgba(16,16,16,.055); font-size: clamp(150px, 28vw, 420px); line-height: .75; font-weight: 950; letter-spacing: -.12em; pointer-events: none; }
        .exp16-caption { position: absolute; top: 18px; right: 18px; z-index: 1002; padding: 8px 10px; color: var(--paper); background: var(--ink); border: 3px solid var(--ink); box-shadow: 6px 6px 0 var(--green); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; pointer-events: none; }

        .exp16-stage > .exp16-caption + div, .exp16-stage > div:first-child:not(.exp16-caption) { position: sticky !important; top: 0 !important; z-index: 1000 !important; overflow: visible !important; background: rgba(247,239,224,.92) !important; border-bottom: 4px solid var(--ink) !important; box-shadow: 0 8px 0 var(--yellow) !important; backdrop-filter: blur(8px); }

        .exp16-stage main[class*="bg-neutral-50"], .exp16-stage .bg-neutral-50, .exp16-stage .bg-white, .exp16-stage [class*="bg-background"], .exp16-stage .bg-secondary { background: transparent !important; }
        .exp16-stage .text-neutral-900, .exp16-stage .text-foreground, .exp16-stage .text-black, .exp16-stage h1, .exp16-stage h2, .exp16-stage h3, .exp16-stage strong { color: var(--ink) !important; }
        .exp16-stage .text-neutral-700, .exp16-stage .text-neutral-600, .exp16-stage .text-muted-foreground, .exp16-stage p, .exp16-stage span { color: var(--soft); }
        .exp16-stage .border, .exp16-stage .border-border, .exp16-stage .border-input, .exp16-stage .border-neutral-100, .exp16-stage .border-neutral-200, .exp16-stage .border-neutral-300 { border-color: var(--ink) !important; }
        .exp16-stage [class*="shadow"] { box-shadow: 8px 8px 0 rgba(16,16,16,.16) !important; }
        .exp16-stage input, .exp16-stage textarea { color: var(--ink) !important; background: #fff8e8 !important; border: 3px solid var(--ink) !important; border-radius: 0 !important; box-shadow: 5px 5px 0 var(--blue) !important; }
        .exp16-stage section.bg-transparent > div > div.relative.aspect-video { overflow: hidden; border: 4px solid var(--ink) !important; border-radius: 0 !important; background: #101010 !important; box-shadow: 14px 14px 0 var(--green), 28px 28px 0 rgba(16,16,16,.13) !important; }
        .exp16-stage section.bg-transparent h1 { display: inline; letter-spacing: -.085em !important; text-transform: uppercase; text-shadow: 4px 4px 0 var(--yellow), 8px 8px 0 rgba(34,89,214,.22); }
        .exp16-stage section.bg-transparent div[class*="rounded"], .exp16-stage div[class*="rounded"], .exp16-stage [role="menu"] { border: 3px solid var(--ink) !important; border-radius: 0 !important; background: rgba(255,248,232,.88) !important; }
        .exp16-stage button[class*="bg-[#171717]"], .exp16-stage aside button.w-full, .exp16-stage aside button[class*="bg-primary"], .exp16-stage [class*="bg-primary"] { color: var(--paper) !important; border: 3px solid var(--ink) !important; border-radius: 0 !important; background: var(--blue) !important; box-shadow: 6px 6px 0 var(--ink) !important; }
        .exp16-stage aside { padding-left: 24px; border-left: 4px solid var(--ink); }
        .exp16-stage aside::before { content: "bez czerwieni"; display: inline-block; margin-bottom: 12px; padding: 5px 9px; background: var(--yellow); border: 3px solid var(--ink); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; }
        .exp16-stage aside a { margin-bottom: 12px !important; border: 3px solid var(--ink) !important; border-radius: 0 !important; background: rgba(255,248,232,.88) !important; }
        .exp16-stage footer { background: transparent !important; }

        @media (max-width: 768px) { .experiment16-skin { padding: 0; } .exp16-stage { border-inline: 0; box-shadow: none; } .exp16-caption, .exp16-stage::before { display: none; } .exp16-stage aside { padding-left: 0; border-left: 0; } }
      `}</style>
    </div>
  );
}
