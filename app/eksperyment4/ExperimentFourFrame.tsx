"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentFourFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment4?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment4-frame-skin">
      <main className="exp4-drawing" aria-label="Eksperyment 4">
        {children}
      </main>

      <style jsx global>{`
        .experiment4-frame-skin {
          --paper: #f7f1e4;
          --ink: #121212;
          --ink-soft: rgba(18, 18, 18, 0.68);
          --ink-faint: rgba(18, 18, 18, 0.13);
          --marker: rgba(250, 213, 103, 0.72);
          --green: rgba(191, 220, 190, 0.58);
          --blue: #1f5bd8;
          min-height: 100vh;
          padding-inline: clamp(12px, 3vw, 44px);
          color: var(--ink);
          background:
            linear-gradient(90deg, var(--ink-faint) 1px, transparent 1px) 0 0 / 42px 42px,
            linear-gradient(var(--ink-faint) 1px, transparent 1px) 0 0 / 42px 42px,
            radial-gradient(rgba(18,18,18,.04) .8px, transparent .8px) 0 0 / 18px 18px,
            var(--paper);
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
        }

        .experiment4-frame-skin * {
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important;
        }

        .exp4-drawing {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: visible;
          background:
            linear-gradient(90deg, rgba(18,18,18,.05) 1px, transparent 1px) 0 0 / 34px 34px,
            linear-gradient(rgba(18,18,18,.05) 1px, transparent 1px) 0 0 / 34px 34px,
            rgba(247,241,228,.9);
          isolation: isolate;
        }

        .exp4-drawing > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(247, 241, 228, 0.94) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(8px);
        }

        .exp4-drawing > div:first-child::after {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: -3px;
          height: 7px;
          background: var(--ink);
          opacity: .82;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 760 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 9 C110 5 160 13 250 8 S420 3 520 9 S650 14 758 8' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M3 15 C140 12 260 16 381 13 S600 9 757 14' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' opacity='.5'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .exp4-drawing main[class*="bg-neutral-50"],
        .exp4-drawing .bg-neutral-50,
        .exp4-drawing .bg-white,
        .exp4-drawing .bg-background\/80,
        .exp4-drawing .bg-secondary {
          background: transparent !important;
        }

        .exp4-drawing .border,
        .exp4-drawing .border-border,
        .exp4-drawing .border-input,
        .exp4-drawing .border-neutral-100,
        .exp4-drawing .border-neutral-200,
        .exp4-drawing .border-neutral-300 {
          border-color: var(--ink-soft) !important;
        }

        .exp4-drawing [class*="shadow"] {
          box-shadow: none !important;
        }

        .exp4-drawing input,
        .exp4-drawing textarea {
          background: rgba(247, 241, 228, .94) !important;
          border: 1.8px solid rgba(18,18,18,.78) !important;
          border-radius: 3px !important;
          box-shadow: none !important;
        }

        .exp4-drawing input:focus,
        .exp4-drawing textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(250, 213, 103, .36) !important;
        }

        .exp4-drawing section.bg-transparent {
          position: relative;
        }

        .exp4-drawing section.bg-transparent::before,
        .exp4-drawing section.bg-transparent::after {
          content: "";
          position: absolute;
          top: 15px;
          bottom: 166px;
          width: 18px;
          border-color: var(--ink);
          pointer-events: none;
          z-index: 20;
          opacity: .65;
        }

        .exp4-drawing section.bg-transparent::before {
          left: -14px;
          border-left: 2px solid;
          border-top: 2px solid;
          border-bottom: 2px solid;
        }

        .exp4-drawing section.bg-transparent::after {
          right: -14px;
          border-right: 2px solid;
          border-top: 2px solid;
          border-bottom: 2px solid;
        }

        .exp4-drawing section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 2px solid var(--ink) !important;
          border-radius: 3px !important;
          background: #151515 !important;
        }

        .exp4-drawing section.bg-transparent > div > div.relative.aspect-video::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 28;
          background:
            linear-gradient(30deg, transparent 49.4%, rgba(247,241,228,.45) 49.4% 50.6%, transparent 50.6%),
            linear-gradient(-30deg, transparent 49.4%, rgba(247,241,228,.45) 49.4% 50.6%, transparent 50.6%);
          opacity: .48;
          pointer-events: none;
        }

        .exp4-drawing section.bg-transparent h1 {
          display: inline;
          letter-spacing: .005em !important;
          background:
            linear-gradient(transparent 49%, var(--marker) 49% 82%, transparent 82%);
        }

        .exp4-drawing section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          border: 1.6px solid rgba(18,18,18,.68) !important;
          border-radius: 3px !important;
          background: rgba(247,241,228,.74) !important;
        }

        .exp4-drawing section.bg-transparent a[href^="/channel/"] {
          border-radius: 0 !important;
          border: 1.8px solid var(--ink) !important;
          transform: rotate(-1deg);
        }

        .exp4-drawing section.bg-transparent a[href^="/channel/"] img {
          border-radius: 0 !important;
          filter: contrast(1.05) grayscale(.12);
        }

        .exp4-drawing button[class*="rounded-full"],
        .exp4-drawing a[class*="rounded-full"],
        .exp4-drawing div[class*="rounded-full"] {
          border-radius: 4px !important;
        }

        .exp4-drawing button[class*="bg-[#171717]"],
        .exp4-drawing aside button.w-full,
        .exp4-drawing aside button[class*="bg-primary"] {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 4px !important;
          background: transparent !important;
          color: white !important;
        }

        .exp4-drawing button[class*="bg-[#171717]"]::before,
        .exp4-drawing aside button.w-full::before,
        .exp4-drawing aside button[class*="bg-primary"]::before {
          content: "";
          position: absolute;
          inset: 3px 4px;
          z-index: -1;
          border-radius: 3px;
          background:
            repeating-linear-gradient(-18deg, rgba(255,255,255,.22) 0 1px, transparent 1px 4px),
            var(--ink);
          clip-path: polygon(2% 10%, 50% 2%, 98% 10%, 96% 90%, 48% 98%, 3% 91%);
        }

        .exp4-drawing aside button.w-full::before,
        .exp4-drawing aside button[class*="bg-primary"]::before {
          background:
            repeating-linear-gradient(-18deg, rgba(255,255,255,.24) 0 1px, transparent 1px 4px),
            var(--blue);
        }

        .exp4-drawing [class*="bg-primary"],
        .exp4-drawing [class*="bg-black/62"] {
          background-color: var(--ink) !important;
        }

        .exp4-drawing aside {
          position: relative;
          padding-left: 22px;
          border-left: 2px solid rgba(18,18,18,.62);
        }

        .exp4-drawing aside h3 {
          color: var(--ink) !important;
          border-bottom: 2px solid var(--ink);
        }

        .exp4-drawing aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 12px !important;
          overflow: visible;
          border: 1.6px solid rgba(18,18,18,.68) !important;
          border-radius: 3px !important;
          background: rgba(247,241,228,.82) !important;
        }

        .exp4-drawing aside a[href^="/?v="]::before {
          content: "";
          position: absolute;
          inset: -4px;
          border: 1px solid rgba(18,18,18,.32);
          border-radius: 4px;
          transform: rotate(.35deg);
          pointer-events: none;
        }

        .exp4-drawing aside a[href^="/?v="] > div:first-child {
          border-radius: 2px !important;
          border-color: var(--ink) !important;
          filter: grayscale(.25) contrast(1.08);
        }

        .exp4-drawing aside a[href^="/?v="] > div:first-child::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 24;
          background:
            linear-gradient(34deg, transparent 49%, rgba(247,241,228,.52) 49% 51%, transparent 51%),
            linear-gradient(-34deg, transparent 49%, rgba(247,241,228,.52) 49% 51%, transparent 51%);
          pointer-events: none;
        }

        .exp4-drawing div[class*="rounded-[16px]"],
        .exp4-drawing div[class*="rounded-2xl"],
        .exp4-drawing [role="menu"] {
          background: rgba(247,241,228,.96) !important;
          border-color: rgba(18,18,18,.66) !important;
          border-radius: 4px !important;
        }

        .exp4-drawing footer {
          background: transparent !important;
          border-color: rgba(18,18,18,.45) !important;
        }

        @media (max-width: 768px) {
          .experiment4-frame-skin {
            padding-inline: 0;
          }

          .exp4-drawing aside {
            padding-left: 0;
            border-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
