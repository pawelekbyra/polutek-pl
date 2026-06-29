"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentFiveSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment5?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment5-skin">
      <div className="exp5-halo" aria-hidden="true" />
      <div className="exp5-frame-label" aria-hidden="true">
        <span>POLUTEK</span>
        <b>late night channel</b>
        <span>/eksperyment5</span>
      </div>
      <section className="exp5-stage" aria-label="Eksperyment 5 — nocne kino">
        {children}
      </section>

      <style jsx global>{`
        .experiment5-skin {
          --night: #06070d;
          --panel: rgba(10, 14, 28, 0.82);
          --panel-strong: rgba(16, 21, 40, 0.96);
          --ink: #f7f8ff;
          --ink-soft: rgba(247, 248, 255, 0.72);
          --line: rgba(143, 167, 255, 0.28);
          --hot: #ff4fd8;
          --cyan: #27e6ff;
          --violet: #8b5cf6;
          --amber: #ffd166;
          min-height: 100vh;
          padding: clamp(10px, 2.4vw, 34px);
          color: var(--ink);
          background:
            radial-gradient(circle at 15% 8%, rgba(255, 79, 216, .22), transparent 31vw),
            radial-gradient(circle at 88% 18%, rgba(39, 230, 255, .18), transparent 32vw),
            radial-gradient(circle at 50% 100%, rgba(139, 92, 246, .22), transparent 34vw),
            linear-gradient(180deg, #070912 0%, #05060b 54%, #02030a 100%);
          font-family: "Inter", "Segoe UI", Arial, sans-serif;
          isolation: isolate;
          overflow-x: hidden;
        }

        .experiment5-skin *,
        .experiment5-skin *::before,
        .experiment5-skin *::after {
          box-sizing: border-box;
        }

        .experiment5-skin * {
          font-family: "Inter", "Segoe UI", Arial, sans-serif !important;
        }

        .exp5-halo {
          position: fixed;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background:
            repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 5px),
            linear-gradient(90deg, rgba(39,230,255,.05), transparent 28%, rgba(255,79,216,.06) 72%, transparent);
          mix-blend-mode: screen;
          opacity: .72;
        }

        .exp5-halo::after {
          content: "";
          position: absolute;
          inset: -40%;
          background: conic-gradient(from 180deg, transparent, rgba(39,230,255,.13), transparent, rgba(255,79,216,.14), transparent);
          filter: blur(48px);
          animation: exp5-spin 24s linear infinite;
        }

        @keyframes exp5-spin {
          to { transform: rotate(1turn); }
        }

        .exp5-frame-label {
          position: relative;
          z-index: 2;
          width: min(100%, 1500px);
          margin: 0 auto 12px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          color: rgba(247,248,255,.78);
          font-size: clamp(10px, 1vw, 12px);
          font-weight: 900;
          letter-spacing: .22em;
          text-transform: uppercase;
        }

        .exp5-frame-label b {
          padding: 7px 16px;
          border: 1px solid rgba(39,230,255,.36);
          border-radius: 999px;
          color: white;
          background: linear-gradient(90deg, rgba(255,79,216,.24), rgba(39,230,255,.18));
          box-shadow: 0 0 28px rgba(39,230,255,.12), inset 0 0 14px rgba(255,255,255,.06);
        }

        .exp5-frame-label span:last-child { text-align: right; }

        .exp5-stage {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          border: 1px solid rgba(143,167,255,.30);
          border-radius: clamp(18px, 2vw, 34px);
          background:
            linear-gradient(180deg, rgba(10,14,28,.88), rgba(5,7,16,.93)),
            radial-gradient(circle at 40px 40px, rgba(39,230,255,.10) 0 1px, transparent 1px) 0 0 / 24px 24px;
          box-shadow:
            0 28px 90px rgba(0,0,0,.64),
            0 0 0 1px rgba(255,255,255,.04) inset,
            0 0 70px rgba(39,230,255,.10);
          isolation: isolate;
        }

        .exp5-stage::before {
          content: "REC  ●  16:9  SIGNAL OK";
          position: absolute;
          top: 16px;
          right: 22px;
          z-index: 1002;
          color: rgba(255,79,216,.82);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .18em;
          text-transform: uppercase;
          text-shadow: 0 0 12px rgba(255,79,216,.70);
          pointer-events: none;
        }

        .exp5-stage::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          border-radius: inherit;
          box-shadow: inset 0 0 78px rgba(0,0,0,.82), inset 0 0 0 1px rgba(255,255,255,.05);
        }

        .exp5-stage > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(5, 7, 16, 0.80) !important;
          border-bottom: 1px solid rgba(39,230,255,.22) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,.34), 0 0 24px rgba(39,230,255,.08) !important;
          backdrop-filter: blur(18px) saturate(1.35);
        }

        .exp5-stage main[class*="bg-neutral-50"],
        .exp5-stage .bg-neutral-50,
        .exp5-stage .bg-white,
        .exp5-stage .bg-background\/80,
        .exp5-stage .bg-secondary {
          background: transparent !important;
        }

        .exp5-stage .text-neutral-900,
        .exp5-stage .text-foreground,
        .exp5-stage .text-black,
        .exp5-stage h1,
        .exp5-stage h2,
        .exp5-stage h3,
        .exp5-stage strong {
          color: var(--ink) !important;
        }

        .exp5-stage .text-neutral-700,
        .exp5-stage .text-neutral-600,
        .exp5-stage .text-muted-foreground,
        .exp5-stage p,
        .exp5-stage span {
          color: var(--ink-soft);
        }

        .exp5-stage .border,
        .exp5-stage .border-border,
        .exp5-stage .border-input,
        .exp5-stage .border-neutral-100,
        .exp5-stage .border-neutral-200,
        .exp5-stage .border-neutral-300 {
          border-color: var(--line) !important;
        }

        .exp5-stage [class*="shadow"] {
          box-shadow: 0 18px 55px rgba(0,0,0,.34) !important;
        }

        .exp5-stage input,
        .exp5-stage textarea {
          color: var(--ink) !important;
          background: rgba(6, 8, 18, .88) !important;
          border: 1px solid rgba(39,230,255,.32) !important;
          border-radius: 999px !important;
          box-shadow: 0 0 0 1px rgba(255,255,255,.03) inset !important;
        }

        .exp5-stage input::placeholder,
        .exp5-stage textarea::placeholder {
          color: rgba(247,248,255,.42) !important;
        }

        .exp5-stage input:focus,
        .exp5-stage textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(39,230,255,.16), 0 0 28px rgba(39,230,255,.16) !important;
        }

        .exp5-stage section.bg-transparent {
          position: relative;
        }

        .exp5-stage section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(39,230,255,.42) !important;
          border-radius: clamp(18px, 2vw, 30px) !important;
          background: #02030a !important;
          box-shadow:
            0 28px 90px rgba(0,0,0,.74),
            0 0 0 1px rgba(255,255,255,.06) inset,
            0 0 46px rgba(255,79,216,.14) !important;
        }

        .exp5-stage section.bg-transparent > div > div.relative.aspect-video::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 35;
          pointer-events: none;
          background:
            linear-gradient(90deg, transparent, rgba(39,230,255,.11), transparent),
            repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 4px);
          opacity: .7;
          mix-blend-mode: screen;
        }

        .exp5-stage section.bg-transparent h1 {
          display: inline;
          letter-spacing: -.04em !important;
          text-shadow: 0 0 22px rgba(39,230,255,.32), 0 0 34px rgba(255,79,216,.20);
          background: linear-gradient(90deg, var(--cyan), #fff, var(--hot));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent !important;
        }

        .exp5-stage section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 1px solid rgba(143,167,255,.26) !important;
          border-radius: 18px !important;
          background: linear-gradient(180deg, rgba(16,21,40,.72), rgba(9,12,25,.80)) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.035), 0 12px 36px rgba(0,0,0,.26) !important;
        }

        .exp5-stage section.bg-transparent a[href^="/channel/"] {
          border: 1px solid rgba(255,79,216,.44) !important;
          border-radius: 999px !important;
          background: linear-gradient(135deg, rgba(255,79,216,.25), rgba(39,230,255,.18)) !important;
          box-shadow: 0 0 28px rgba(255,79,216,.14) !important;
        }

        .exp5-stage section.bg-transparent a[href^="/channel/"] img {
          border-radius: 999px !important;
          filter: saturate(1.22) contrast(1.06);
        }

        .exp5-stage button[class*="bg-[#171717]"],
        .exp5-stage aside button.w-full,
        .exp5-stage aside button[class*="bg-primary"],
        .exp5-stage [class*="bg-primary"] {
          color: #05060b !important;
          border: 0 !important;
          background: linear-gradient(135deg, var(--cyan), #b8f7ff 48%, var(--hot)) !important;
          box-shadow: 0 0 28px rgba(39,230,255,.22), 0 12px 34px rgba(0,0,0,.35) !important;
        }

        .exp5-stage button[class*="bg-[#171717]"]:hover,
        .exp5-stage aside button.w-full:hover,
        .exp5-stage aside button[class*="bg-primary"]:hover {
          filter: brightness(1.08) saturate(1.1);
          transform: translateY(-1px);
        }

        .exp5-stage [class*="bg-black/62"] {
          background-color: rgba(3, 4, 10, .72) !important;
        }

        .exp5-stage aside {
          position: relative;
          padding-left: 18px;
          border-left: 1px solid rgba(39,230,255,.26);
        }

        .exp5-stage aside::before {
          content: "QUEUE";
          position: sticky;
          top: 86px;
          display: inline-block;
          margin-bottom: 10px;
          color: rgba(39,230,255,.72);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .26em;
          text-shadow: 0 0 12px rgba(39,230,255,.52);
        }

        .exp5-stage aside h3 {
          color: white !important;
          border-bottom: 0 !important;
          text-shadow: 0 0 16px rgba(255,79,216,.36);
        }

        .exp5-stage aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 12px !important;
          overflow: hidden;
          border: 1px solid rgba(143,167,255,.24) !important;
          border-radius: 18px !important;
          background: linear-gradient(135deg, rgba(18,24,47,.82), rgba(9,12,24,.90)) !important;
          box-shadow: 0 16px 42px rgba(0,0,0,.28) !important;
        }

        .exp5-stage aside a[href^="/?v="]:hover {
          border-color: rgba(39,230,255,.48) !important;
          box-shadow: 0 0 30px rgba(39,230,255,.12), 0 20px 50px rgba(0,0,0,.34) !important;
          transform: translateY(-2px);
        }

        .exp5-stage aside a[aria-current="page"] {
          border-color: rgba(255,79,216,.66) !important;
          background: linear-gradient(135deg, rgba(255,79,216,.22), rgba(39,230,255,.14)) !important;
        }

        .exp5-stage aside a[href^="/?v="] > div:first-child {
          border-radius: 14px !important;
          border-color: rgba(39,230,255,.38) !important;
          filter: saturate(1.18) contrast(1.04);
        }

        .exp5-stage aside a[href^="/?v="] > div:first-child::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 24;
          pointer-events: none;
          background: linear-gradient(90deg, rgba(39,230,255,.15), transparent 38%, rgba(255,79,216,.12));
          mix-blend-mode: screen;
        }

        .exp5-stage div[class*="rounded-[16px]"],
        .exp5-stage div[class*="rounded-2xl"],
        .exp5-stage [role="menu"] {
          color: var(--ink) !important;
          background: rgba(10,14,28,.96) !important;
          border-color: rgba(143,167,255,.30) !important;
          border-radius: 18px !important;
        }

        .exp5-stage footer {
          color: var(--ink-soft) !important;
          background: transparent !important;
          border-color: rgba(143,167,255,.24) !important;
        }

        @media (max-width: 768px) {
          .experiment5-skin {
            padding: 0;
          }

          .exp5-frame-label {
            display: none;
          }

          .exp5-stage {
            border-radius: 0;
            border-inline: 0;
          }

          .exp5-stage::before {
            display: none;
          }

          .exp5-stage aside {
            padding-left: 0;
            border-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
