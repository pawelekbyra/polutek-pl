"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentFourteenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment14?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment14-skin">
      <div className="exp14-shapes" aria-hidden="true">
        <span className="circle" />
        <span className="slab" />
        <span className="tall" />
      </div>
      <section className="exp14-stage" aria-label="Eksperyment 14 — soft poster paper">
        <div className="exp14-caption" aria-hidden="true">
          <b>POLUTEK</b>
          <span>soft poster system 14</span>
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment14-skin {
          --paper: #f7f1e4;
          --ink: #161616;
          --ink-soft: rgba(22, 22, 22, .66);
          --ink-faint: rgba(22, 22, 22, .105);
          --blue: #426ba8;
          --ochre: #d8b760;
          --sage: #9fb69a;
          --cream-panel: rgba(255, 250, 239, .74);
          min-height: 100vh;
          padding: clamp(12px, 2.6vw, 42px);
          color: var(--ink);
          background:
            linear-gradient(90deg, var(--ink-faint) 1px, transparent 1px) 0 0 / 54px 54px,
            linear-gradient(var(--ink-faint) 1px, transparent 1px) 0 0 / 54px 54px,
            radial-gradient(circle at 8% 14%, rgba(159, 182, 154, .20), transparent 24vw),
            radial-gradient(circle at 92% 12%, rgba(66, 107, 168, .13), transparent 24vw),
            var(--paper);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        .experiment14-skin *,
        .experiment14-skin *::before,
        .experiment14-skin *::after { box-sizing: border-box; }

        .experiment14-skin * {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        .exp14-shapes {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .exp14-shapes span {
          position: absolute;
          display: block;
          border: 2px solid rgba(22, 22, 22, .52);
          box-shadow: 10px 10px 0 rgba(22, 22, 22, .065);
          opacity: .76;
        }

        .exp14-shapes .circle {
          width: clamp(84px, 12vw, 178px);
          aspect-ratio: 1;
          left: 4vw;
          bottom: 11vh;
          border-radius: 999px;
          background: rgba(159, 182, 154, .42);
        }

        .exp14-shapes .slab {
          width: clamp(112px, 18vw, 260px);
          height: clamp(58px, 9vw, 132px);
          right: -3vw;
          top: 20vh;
          background: rgba(66, 107, 168, .26);
          transform: rotate(-7deg);
        }

        .exp14-shapes .tall {
          width: clamp(64px, 9vw, 128px);
          height: clamp(112px, 16vw, 226px);
          right: 10vw;
          bottom: -4vh;
          background: rgba(216, 183, 96, .34);
          transform: rotate(12deg);
        }

        .exp14-stage {
          position: relative;
          z-index: 1;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          border: 2px solid rgba(22, 22, 22, .42);
          border-radius: 10px;
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.045'/%3E%3C/svg%3E"),
            rgba(247, 241, 228, .84);
          box-shadow: 0 22px 70px rgba(72, 53, 24, .14), inset 0 0 0 8px rgba(255,255,255,.16);
          isolation: isolate;
        }

        .exp14-caption {
          position: absolute;
          top: 22px;
          right: 24px;
          z-index: 1002;
          display: grid;
          gap: 2px;
          padding: 9px 12px;
          color: var(--ink);
          background: rgba(247, 241, 228, .78);
          border: 1.5px solid rgba(22,22,22,.34);
          transform: rotate(.18deg);
          pointer-events: none;
        }

        .exp14-caption b,
        .exp14-caption span {
          color: var(--ink) !important;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .exp14-caption span { opacity: .58; }

        .exp14-stage > .exp14-caption + div,
        .exp14-stage > div:first-child:not(.exp14-caption) {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(247, 241, 228, .92) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(8px);
        }

        .exp14-stage > .exp14-caption + div::after,
        .exp14-stage > div:first-child:not(.exp14-caption)::after {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: -4px;
          height: 8px;
          background: var(--ink);
          opacity: .50;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 760 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 9 C110 5 160 13 250 8 S420 3 520 9 S650 14 758 8' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M3 15 C140 12 260 16 381 13 S600 9 757 14' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' opacity='.5'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .exp14-stage main[class*="bg-neutral-50"],
        .exp14-stage .bg-neutral-50,
        .exp14-stage .bg-white,
        .exp14-stage .bg-background\/80,
        .exp14-stage .bg-secondary { background: transparent !important; }

        .exp14-stage .text-neutral-900,
        .exp14-stage .text-foreground,
        .exp14-stage .text-black,
        .exp14-stage h1,
        .exp14-stage h2,
        .exp14-stage h3,
        .exp14-stage strong { color: var(--ink) !important; }

        .exp14-stage .text-neutral-700,
        .exp14-stage .text-neutral-600,
        .exp14-stage .text-muted-foreground,
        .exp14-stage p,
        .exp14-stage span { color: var(--ink-soft); }

        .exp14-stage .border,
        .exp14-stage .border-border,
        .exp14-stage .border-input,
        .exp14-stage .border-neutral-100,
        .exp14-stage .border-neutral-200,
        .exp14-stage .border-neutral-300 { border-color: rgba(22,22,22,.38) !important; }

        .exp14-stage [class*="shadow"] { box-shadow: none !important; }

        .exp14-stage input,
        .exp14-stage textarea {
          background: rgba(255, 250, 239, .78) !important;
          border: 1.5px solid rgba(22,22,22,.34) !important;
          border-radius: 6px !important;
          box-shadow: 3px 4px 0 rgba(22,22,22,.055) !important;
        }

        .exp14-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 2px solid rgba(22,22,22,.74) !important;
          border-radius: 8px !important;
          background: #171717 !important;
          box-shadow: 10px 12px 0 rgba(66,107,168,.13) !important;
        }

        .exp14-stage section.bg-transparent > div > div.relative.aspect-video::after {
          content: "soft frame";
          position: absolute;
          left: 14px;
          top: 12px;
          z-index: 35;
          padding: 4px 8px;
          color: var(--ink);
          background: rgba(216, 183, 96, .42);
          border: 1px solid rgba(22,22,22,.32);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
          pointer-events: none;
        }

        .exp14-stage section.bg-transparent h1 {
          display: inline;
          letter-spacing: -.035em !important;
          background: linear-gradient(transparent 58%, rgba(216,183,96,.34) 58% 84%, transparent 84%);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }

        .exp14-stage section.bg-transparent div[class*="rounded-[14px]"] {
          border: 1.5px solid rgba(22,22,22,.28) !important;
          border-radius: 8px !important;
          background: var(--cream-panel) !important;
        }

        .exp14-stage button[class*="bg-[#171717]"],
        .exp14-stage aside button.w-full,
        .exp14-stage aside button[class*="bg-primary"],
        .exp14-stage [class*="bg-primary"] {
          color: white !important;
          border: 1.5px solid var(--ink) !important;
          border-radius: 8px !important;
          background: var(--ink) !important;
          box-shadow: 5px 6px 0 rgba(159,182,154,.24) !important;
        }

        .exp14-stage [class*="bg-black/62"] { background-color: rgba(22,22,22,.68) !important; }

        .exp14-stage aside {
          position: relative;
          padding-left: 22px;
          border-left: 2px solid rgba(22,22,22,.22);
        }

        .exp14-stage aside::before {
          content: "soft blocks";
          display: inline-block;
          margin-bottom: 10px;
          color: var(--blue);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .exp14-stage aside a[href^="/?v="] {
          margin-bottom: 12px !important;
          border: 1.5px solid rgba(22,22,22,.26) !important;
          border-radius: 8px !important;
          background: rgba(255,250,239,.74) !important;
          transform: rotate(-.08deg);
        }

        .exp14-stage aside a[href^="/?v="]:hover {
          transform: translateY(-2px) rotate(.04deg);
          box-shadow: 5px 6px 0 rgba(66,107,168,.10) !important;
        }

        .exp14-stage aside a[aria-current="page"] {
          background: rgba(216,183,96,.18) !important;
          border-color: rgba(22,22,22,.52) !important;
        }

        .exp14-stage aside a[href^="/?v="] > div:first-child {
          border-radius: 6px !important;
          filter: saturate(.94) contrast(1.04);
        }

        .exp14-stage div[class*="rounded-[16px]"],
        .exp14-stage div[class*="rounded-2xl"],
        .exp14-stage [role="menu"] {
          background: rgba(255,250,239,.94) !important;
          border-color: rgba(22,22,22,.30) !important;
          border-radius: 8px !important;
        }

        .exp14-stage footer {
          background: transparent !important;
          border-color: rgba(22,22,22,.16) !important;
        }

        @media (max-width: 768px) {
          .experiment14-skin { padding: 0; }
          .exp14-shapes { display: none; }
          .exp14-stage { border-inline: 0; border-radius: 0; box-shadow: none; }
          .exp14-caption { display: none; }
          .exp14-stage aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
