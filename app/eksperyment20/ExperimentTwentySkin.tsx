"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentTwentySkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment20?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment20-skin">
      <div className="exp20-deco" aria-hidden="true">
        <span className="exp20-card-sm" />
        <span className="exp20-card-lg" />
        <span className="exp20-pill" />
        <span className="exp20-dot" />
        <span className="exp20-sep" />
      </div>
      <section className="exp20-stage" aria-label="Eksperyment 20 — thin pen clean">
        <div className="exp20-caption" aria-hidden="true">POLUTEK · eksperyment 20 · cienkopis</div>
        {children}
      </section>

      <style jsx global>{`
        .experiment20-skin {
          --paper: #fafaf8;
          --off: #f2f1ec;
          --ink: #141414;
          --soft: rgba(20,20,20,.60);
          --faint: rgba(20,20,20,.07);
          --blue: #2259d6;
          --blue-light: rgba(34,89,214,.12);
          --amber: #f4c542;
          --amber-faint: rgba(244,197,66,.22);
          min-height: 100vh;
          position: relative;
          padding: clamp(10px, 2vw, 32px);
          color: var(--ink);
          background: var(--paper);
          font-family: Inter, "Helvetica Neue", Arial, sans-serif;
          overflow-x: hidden;
          isolation: isolate;
        }

        .experiment20-skin *, .experiment20-skin *::before, .experiment20-skin *::after { box-sizing: border-box; }
        /* intentionally NOT overriding all fonts — this skin uses system sans-serif */
        .experiment20-skin * { font-family: Inter, "Helvetica Neue", Arial, sans-serif !important; }

        /* decorative wireframe shapes */
        .exp20-deco { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .exp20-card-sm {
          position: absolute; display: block;
          width: clamp(80px, 12vw, 180px); height: clamp(60px, 9vw, 130px);
          right: 2vw; top: 8vh;
          border: 1px solid rgba(20,20,20,.22);
          border-radius: clamp(12px, 2vw, 24px);
          background: transparent;
        }
        .exp20-card-lg {
          position: absolute; display: block;
          width: clamp(140px, 20vw, 300px); height: clamp(90px, 13vw, 190px);
          right: 4vw; top: calc(8vh + clamp(70px, 10vw, 150px) + 16px);
          border: 1px solid rgba(20,20,20,.14);
          border-radius: clamp(14px, 2.2vw, 28px);
          background: transparent;
        }
        .exp20-pill {
          position: absolute; display: block;
          width: clamp(100px, 14vw, 200px); height: clamp(40px, 5.5vw, 72px);
          left: 1.5vw; bottom: 18vh;
          border: 1px solid rgba(20,20,20,.18);
          border-radius: 999px;
          background: var(--blue-light);
        }
        .exp20-dot {
          position: absolute; display: block;
          width: clamp(30px, 4vw, 56px); aspect-ratio: 1;
          right: 12vw; bottom: 24vh;
          border: 1px solid rgba(20,20,20,.18);
          border-radius: 50%;
          background: var(--amber-faint);
        }
        .exp20-sep {
          position: absolute; display: block;
          width: clamp(60px, 10vw, 150px); height: 1px;
          left: 2vw; top: 38vh;
          background: rgba(20,20,20,.16);
        }

        .exp20-stage {
          position: relative; z-index: 1;
          width: min(100%, 1500px); min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          background: var(--paper);
          border: 1px solid rgba(20,20,20,.18);
          border-radius: clamp(12px, 1.8vw, 24px);
          box-shadow: 0 2px 0 rgba(20,20,20,.06), 0 8px 32px rgba(20,20,20,.06);
          isolation: isolate;
        }
        .exp20-caption {
          position: absolute; top: 14px; right: 16px; z-index: 1002;
          padding: 5px 12px;
          background: var(--amber);
          border: 1px solid rgba(20,20,20,.30);
          border-radius: 999px;
          font-size: 10px; font-weight: 700;
          letter-spacing: .12em; text-transform: uppercase;
          pointer-events: none;
        }

        /* sticky nav */
        .exp20-stage > .exp20-caption + div,
        .exp20-stage > div:first-child:not(.exp20-caption) {
          position: sticky !important; top: 0 !important; z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(250,250,248,.95) !important;
          border-bottom: 1px solid rgba(20,20,20,.12) !important;
          box-shadow: none !important;
          backdrop-filter: blur(12px);
          border-radius: clamp(12px, 1.8vw, 24px) clamp(12px, 1.8vw, 24px) 0 0 !important;
        }

        /* content resets */
        .exp20-stage main[class*="bg-neutral-50"],
        .exp20-stage .bg-neutral-50, .exp20-stage .bg-white,
        .exp20-stage [class*="bg-background"], .exp20-stage .bg-secondary { background: transparent !important; }
        .exp20-stage .text-neutral-900, .exp20-stage .text-foreground, .exp20-stage .text-black,
        .exp20-stage h1, .exp20-stage h2, .exp20-stage h3, .exp20-stage strong { color: var(--ink) !important; }
        .exp20-stage .text-neutral-700, .exp20-stage .text-neutral-600,
        .exp20-stage .text-muted-foreground, .exp20-stage p, .exp20-stage span { color: var(--soft); }
        .exp20-stage .border, .exp20-stage .border-border, .exp20-stage .border-input,
        .exp20-stage .border-neutral-100, .exp20-stage .border-neutral-200,
        .exp20-stage .border-neutral-300 { border-color: rgba(20,20,20,.18) !important; }
        .exp20-stage [class*="shadow"] { box-shadow: none !important; }

        /* inputs — pill style */
        .exp20-stage input, .exp20-stage textarea {
          background: var(--off) !important;
          border: 1px solid rgba(20,20,20,.22) !important;
          border-radius: 999px !important;
          box-shadow: none !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
        }

        /* video */
        .exp20-stage section.bg-transparent > div > div.relative.aspect-video {
          overflow: hidden;
          border: 1px solid rgba(20,20,20,.22) !important;
          border-radius: clamp(8px, 1.2vw, 16px) !important;
          background: #111 !important;
          box-shadow: 0 4px 24px rgba(20,20,20,.12) !important;
        }

        /* h1 underline accent */
        .exp20-stage section.bg-transparent h1 {
          display: inline;
          letter-spacing: -.02em !important;
          text-decoration: underline;
          text-decoration-color: var(--amber);
          text-decoration-thickness: 3px;
          text-underline-offset: 5px;
        }

        /* cards */
        .exp20-stage section.bg-transparent div[class*="rounded"],
        .exp20-stage div[class*="rounded"],
        .exp20-stage [role="menu"] {
          border: 1px solid rgba(20,20,20,.15) !important;
          border-radius: clamp(10px, 1.4vw, 20px) !important;
          background: var(--paper) !important;
          box-shadow: 0 1px 4px rgba(20,20,20,.05) !important;
        }

        /* primary buttons — pill filled */
        .exp20-stage button[class*="bg-[#171717]"],
        .exp20-stage aside button.w-full,
        .exp20-stage aside button[class*="bg-primary"],
        .exp20-stage [class*="bg-primary"] {
          color: #fff !important;
          border: 1px solid rgba(20,20,20,.15) !important;
          border-radius: 999px !important;
          background: var(--ink) !important;
          box-shadow: none !important;
        }

        /* sidebar */
        .exp20-stage aside {
          padding-left: 20px;
          border-left: 1px solid rgba(20,20,20,.16);
        }
        .exp20-stage aside::before {
          content: "szkice";
          display: inline-block;
          margin-bottom: 12px;
          padding: 3px 12px;
          background: var(--amber-faint);
          border: 1px solid rgba(20,20,20,.20);
          border-radius: 999px;
          font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
        }
        .exp20-stage aside a {
          margin-bottom: 10px !important;
          border: 1px solid rgba(20,20,20,.15) !important;
          border-radius: clamp(8px, 1.2vw, 14px) !important;
          background: var(--paper) !important;
        }
        .exp20-stage footer {
          background: transparent !important;
          border-radius: 0 0 clamp(12px, 1.8vw, 24px) clamp(12px, 1.8vw, 24px);
        }

        @media (max-width: 768px) {
          .experiment20-skin { padding: 0; }
          .exp20-stage { border-radius: 0; border-inline: 0; box-shadow: none; }
          .exp20-caption { display: none; }
          .exp20-deco { display: none; }
          .exp20-stage aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
