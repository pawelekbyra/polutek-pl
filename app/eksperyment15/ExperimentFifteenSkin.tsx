"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentFifteenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment15?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment15-skin">
      <section className="exp15-gallery" aria-label="Eksperyment 15 — quiet gallery blocks">
        <div className="exp15-geometry" aria-hidden="true">
          <span className="band" />
          <span className="disc" />
          <span className="note" />
        </div>
        <div className="exp15-label" aria-hidden="true">
          <b>POLUTEK</b>
          <span>quiet gallery 15</span>
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment15-skin {
          --paper: #f4efe5;
          --paper-soft: #fbf7ee;
          --ink: #1f211f;
          --ink-soft: rgba(31,33,31,.62);
          --line: rgba(31,33,31,.14);
          --stone: #c9c1ad;
          --blue-gray: #7c93a8;
          --moss: #8d9b7b;
          --sand: #d7c894;
          min-height: 100vh;
          padding: clamp(12px, 2.8vw, 46px);
          color: var(--ink);
          background:
            radial-gradient(circle at 16% 10%, rgba(141,155,123,.16), transparent 30vw),
            radial-gradient(circle at 84% 14%, rgba(124,147,168,.12), transparent 30vw),
            linear-gradient(90deg, var(--line) 1px, transparent 1px) 0 0 / 86px 86px,
            linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 86px 86px,
            var(--paper);
          font-family: "Georgia", "Times New Roman", serif;
          overflow-x: hidden;
        }

        .experiment15-skin *,
        .experiment15-skin *::before,
        .experiment15-skin *::after { box-sizing: border-box; }

        .experiment15-skin * {
          font-family: "Georgia", "Times New Roman", serif !important;
        }

        .exp15-gallery {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          border: 1px solid rgba(31,33,31,.18);
          border-radius: 2px;
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 260 260' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.035'/%3E%3C/svg%3E"),
            rgba(251,247,238,.76);
          background-size: 260px 260px;
          box-shadow: 0 24px 76px rgba(52,42,28,.12), inset 0 0 0 1px rgba(255,255,255,.42);
          isolation: isolate;
        }

        .exp15-gallery::before {
          content: "";
          position: absolute;
          inset: 18px;
          z-index: 1;
          pointer-events: none;
          border: 1px solid rgba(31,33,31,.10);
        }

        .exp15-geometry {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          overflow: hidden;
        }

        .exp15-geometry span {
          position: absolute;
          display: block;
          opacity: .58;
        }

        .exp15-geometry .band {
          width: clamp(220px, 32vw, 480px);
          height: clamp(72px, 10vw, 138px);
          right: -7vw;
          top: 17vh;
          background: rgba(124,147,168,.18);
          border: 1px solid rgba(31,33,31,.14);
          transform: rotate(-5deg);
        }

        .exp15-geometry .disc {
          width: clamp(100px, 14vw, 210px);
          aspect-ratio: 1;
          left: 5vw;
          bottom: 12vh;
          border-radius: 999px;
          background: rgba(141,155,123,.20);
          border: 1px solid rgba(31,33,31,.12);
        }

        .exp15-geometry .note {
          width: clamp(90px, 11vw, 160px);
          height: clamp(150px, 18vw, 260px);
          right: 14vw;
          bottom: -7vh;
          background: rgba(215,200,148,.22);
          border: 1px solid rgba(31,33,31,.12);
          transform: rotate(8deg);
        }

        .exp15-label {
          position: absolute;
          left: 28px;
          top: 28px;
          z-index: 1002;
          display: grid;
          gap: 2px;
          padding: 9px 0 9px 12px;
          color: var(--ink);
          border-left: 3px solid rgba(31,33,31,.36);
          pointer-events: none;
        }

        .exp15-label b,
        .exp15-label span {
          color: var(--ink) !important;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .exp15-label span { opacity: .50; }

        .exp15-gallery > .exp15-geometry + .exp15-label + div {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(251, 247, 238, .90) !important;
          border-bottom: 1px solid rgba(31,33,31,.12) !important;
          box-shadow: 0 12px 36px rgba(52,42,28,.06) !important;
          backdrop-filter: blur(10px);
        }

        .exp15-gallery > .exp15-geometry + .exp15-label + div::after {
          content: "";
          position: absolute;
          left: 28px;
          right: 28px;
          bottom: -2px;
          height: 1px;
          background: rgba(31,33,31,.36);
          pointer-events: none;
        }

        .exp15-gallery main[class*="bg-neutral-50"],
        .exp15-gallery .bg-neutral-50,
        .exp15-gallery .bg-white,
        .exp15-gallery .bg-background\/80,
        .exp15-gallery .bg-secondary { background: transparent !important; }

        .exp15-gallery .text-neutral-900,
        .exp15-gallery .text-foreground,
        .exp15-gallery .text-black,
        .exp15-gallery h1,
        .exp15-gallery h2,
        .exp15-gallery h3,
        .exp15-gallery strong { color: var(--ink) !important; }

        .exp15-gallery .text-neutral-700,
        .exp15-gallery .text-neutral-600,
        .exp15-gallery .text-muted-foreground,
        .exp15-gallery p,
        .exp15-gallery span { color: var(--ink-soft); }

        .exp15-gallery .border,
        .exp15-gallery .border-border,
        .exp15-gallery .border-input,
        .exp15-gallery .border-neutral-100,
        .exp15-gallery .border-neutral-200,
        .exp15-gallery .border-neutral-300 { border-color: rgba(31,33,31,.18) !important; }

        .exp15-gallery [class*="shadow"] { box-shadow: none !important; }

        .exp15-gallery input,
        .exp15-gallery textarea {
          background: rgba(251,247,238,.84) !important;
          border: 1px solid rgba(31,33,31,.18) !important;
          border-radius: 2px !important;
          box-shadow: inset 0 -6px 0 rgba(215,200,148,.11) !important;
        }

        .exp15-gallery section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(31,33,31,.30) !important;
          border-radius: 2px !important;
          background: #151515 !important;
          box-shadow: 0 0 0 10px rgba(251,247,238,.62), 0 18px 48px rgba(52,42,28,.13) !important;
        }

        .exp15-gallery section.bg-transparent > div > div.relative.aspect-video::after {
          content: "quiet frame";
          position: absolute;
          right: 14px;
          top: 12px;
          z-index: 35;
          padding: 4px 8px;
          color: rgba(251,247,238,.86);
          background: rgba(31,33,31,.42);
          border: 1px solid rgba(251,247,238,.18);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .10em;
          pointer-events: none;
        }

        .exp15-gallery section.bg-transparent h1 {
          display: inline;
          letter-spacing: -.025em !important;
          font-weight: 700 !important;
          background: linear-gradient(transparent 66%, rgba(215,200,148,.24) 66% 86%, transparent 86%);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }

        .exp15-gallery section.bg-transparent div[class*="rounded-[14px]"] {
          border: 1px solid rgba(31,33,31,.14) !important;
          border-radius: 2px !important;
          background: rgba(251,247,238,.68) !important;
        }

        .exp15-gallery button[class*="bg-[#171717]"],
        .exp15-gallery aside button.w-full,
        .exp15-gallery aside button[class*="bg-primary"],
        .exp15-gallery [class*="bg-primary"] {
          color: var(--paper-soft) !important;
          border: 1px solid rgba(31,33,31,.80) !important;
          border-radius: 2px !important;
          background: var(--ink) !important;
          box-shadow: 4px 5px 0 rgba(141,155,123,.16) !important;
        }

        .exp15-gallery [class*="bg-black/62"] { background-color: rgba(31,33,31,.64) !important; }

        .exp15-gallery aside {
          position: relative;
          padding-left: 22px;
          border-left: 1px solid rgba(31,33,31,.14);
        }

        .exp15-gallery aside::before {
          content: "gallery list";
          display: inline-block;
          margin-bottom: 10px;
          color: rgba(31,33,31,.62);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .exp15-gallery aside a[href^="/?v="] {
          margin-bottom: 12px !important;
          border: 1px solid rgba(31,33,31,.13) !important;
          border-radius: 2px !important;
          background: rgba(251,247,238,.66) !important;
        }

        .exp15-gallery aside a[href^="/?v="]:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(52,42,28,.08) !important;
        }

        .exp15-gallery aside a[aria-current="page"] {
          background: rgba(141,155,123,.14) !important;
          border-color: rgba(31,33,31,.28) !important;
        }

        .exp15-gallery aside a[href^="/?v="] > div:first-child {
          border-radius: 2px !important;
          filter: saturate(.90) contrast(1.02);
        }

        .exp15-gallery div[class*="rounded-[16px]"],
        .exp15-gallery div[class*="rounded-2xl"],
        .exp15-gallery [role="menu"] {
          background: rgba(251,247,238,.96) !important;
          border-color: rgba(31,33,31,.16) !important;
          border-radius: 2px !important;
        }

        .exp15-gallery footer {
          background: transparent !important;
          border-color: rgba(31,33,31,.10) !important;
        }

        @media (max-width: 768px) {
          .experiment15-skin { padding: 0; }
          .exp15-gallery { border-inline: 0; border-radius: 0; box-shadow: none; }
          .exp15-gallery::before,
          .exp15-geometry,
          .exp15-label { display: none; }
          .exp15-gallery aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
