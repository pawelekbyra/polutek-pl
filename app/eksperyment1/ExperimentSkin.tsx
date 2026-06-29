"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment1?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment1-skin">
      {children}
      <style jsx global>{`
        .experiment1-skin {
          --paper: #f8f3e7;
          --ink: #171717;
          --n4-active: #cfcfcf;
          --n4-idle: #eeeeee;
          --b5: #2563eb;
          --b5-dark: #1748b8;
          min-height: 100vh;
          color: var(--ink);
          background-color: var(--paper);
          background-image:
            radial-gradient(rgba(23, 23, 23, 0.035) 0.7px, transparent 0.7px),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' opacity='0.09' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 22px 22px, 200px 200px;
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
        }

        .experiment1-skin * {
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important;
        }

        .experiment1-skin > div:first-child {
          position: sticky !important;
          top: 0 !important;
          background: rgba(248, 243, 231, 0.92) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .experiment1-skin > div:first-child::after {
          content: "";
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: -1px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(23,23,23,.88), transparent);
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 600 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 5 Q145 2 300 5 T598 4' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .experiment1-skin input,
        .experiment1-skin textarea {
          background: rgba(248, 243, 231, 0.9) !important;
          border-color: rgba(23, 23, 23, 0.75) !important;
          box-shadow: none !important;
        }

        .experiment1-skin button,
        .experiment1-skin a {
          text-decoration: none;
        }

        .experiment1-skin main.bg-neutral-50,
        .experiment1-skin .bg-neutral-50 {
          background-color: transparent !important;
        }

        .experiment1-skin .bg-white {
          background-color: rgba(248, 243, 231, 0.92) !important;
        }

        .experiment1-skin .bg-secondary {
          background-color: rgba(238, 238, 238, 0.7) !important;
        }

        .experiment1-skin .border,
        .experiment1-skin .border-border,
        .experiment1-skin .border-input,
        .experiment1-skin .border-neutral-200,
        .experiment1-skin .border-neutral-300 {
          border-color: rgba(23, 23, 23, 0.72) !important;
        }

        .experiment1-skin [class*="shadow"] {
          box-shadow: none !important;
        }

        .experiment1-skin section.bg-transparent > div > div.relative.aspect-video,
        .experiment1-skin div.relative.aspect-video.w-full {
          border-color: var(--ink) !important;
          border-radius: 15px !important;
          box-shadow: 0 0 0 1px rgba(23,23,23,.22) !important;
        }

        .experiment1-skin section.bg-transparent > div > div.relative.aspect-video::after,
        .experiment1-skin div.relative.aspect-video.w-full::after {
          content: "";
          position: absolute;
          inset: -3px;
          border: 1.4px solid rgba(23,23,23,.9);
          border-radius: 17px;
          transform: rotate(-0.12deg);
          pointer-events: none;
          z-index: 20;
        }

        .experiment1-skin h1,
        .experiment1-skin h2,
        .experiment1-skin h3,
        .experiment1-skin h4,
        .experiment1-skin .font-heading,
        .experiment1-skin .font-brand {
          letter-spacing: 0.01em;
        }

        .experiment1-skin aside a[aria-current],
        .experiment1-skin aside a[href^="/?v="] {
          position: relative;
          border: 1px solid rgba(23,23,23,.65);
          border-radius: 13px !important;
          background: transparent !important;
          overflow: hidden;
        }

        .experiment1-skin aside a[href^="/?v="]::before {
          content: "";
          position: absolute;
          inset: 3px 4px;
          border-radius: 11px;
          background: var(--n4-idle);
          opacity: 0.58;
          transform: rotate(0.08deg);
          pointer-events: none;
          z-index: 0;
          clip-path: polygon(2% 11%, 50% 2%, 98% 10%, 96% 88%, 50% 98%, 3% 89%);
        }

        .experiment1-skin aside a[aria-current="page"]::before {
          background: var(--n4-active);
          opacity: 0.84;
        }

        .experiment1-skin aside a[href^="/?v="] > * {
          position: relative;
          z-index: 1;
        }

        .experiment1-skin aside button[class*="bg-primary"],
        .experiment1-skin aside button[class*="bg-blue"],
        .experiment1-skin aside button.w-full {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          background: var(--b5) !important;
          border: 1.4px solid var(--b5-dark) !important;
          color: white !important;
          border-radius: 12px !important;
        }

        .experiment1-skin aside button[class*="bg-primary"]::before,
        .experiment1-skin aside button[class*="bg-blue"]::before,
        .experiment1-skin aside button.w-full::before {
          content: "";
          position: absolute;
          inset: 3px 4px;
          z-index: -1;
          border-radius: 10px;
          background:
            repeating-linear-gradient(-18deg, rgba(255,255,255,.22) 0 1px, transparent 1px 4px),
            var(--b5);
          clip-path: polygon(2% 12%, 51% 2%, 98% 11%, 96% 88%, 48% 98%, 3% 89%);
        }

        .experiment1-skin aside button[class*="bg-primary"]::after,
        .experiment1-skin aside button[class*="bg-blue"]::after,
        .experiment1-skin aside button.w-full::after {
          content: "";
          position: absolute;
          inset: 1px;
          z-index: -1;
          border: 1px solid rgba(23, 72, 184, .75);
          border-radius: 12px;
          transform: rotate(-0.16deg);
        }

        .experiment1-skin div[class*="rounded-[14px]"],
        .experiment1-skin div[class*="rounded-[16px]"],
        .experiment1-skin div[class*="rounded-2xl"] {
          border-color: rgba(23,23,23,.62) !important;
        }

        .experiment1-skin [role="menu"] {
          background: rgba(248, 243, 231, 0.98) !important;
          border-color: rgba(23,23,23,.7) !important;
        }

        .experiment1-skin footer {
          background: transparent !important;
          border-color: rgba(23,23,23,.45) !important;
        }
      `}</style>
    </div>
  );
}
