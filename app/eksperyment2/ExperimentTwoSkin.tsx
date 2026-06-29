"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentTwoSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment2?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment2-skin">
      {children}
      <style jsx global>{`
        .experiment2-skin {
          --paper: #f8f3e7;
          --paper-soft: rgba(248, 243, 231, 0.94);
          --ink: #151515;
          --ink-soft: rgba(21, 21, 21, 0.72);
          --n4-active: #cfcfcf;
          --n4-idle: #eeeeee;
          --b5: #2563eb;
          --b5-dark: #1748b8;
          min-height: 100vh;
          color: var(--ink);
          background-color: var(--paper);
          background-image:
            radial-gradient(rgba(21, 21, 21, 0.032) 0.72px, transparent 0.72px),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' opacity='0.10' filter='url(%23paper)'/%3E%3C/svg%3E");
          background-size: 22px 22px, 240px 240px;
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive;
        }

        .experiment2-skin * {
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive !important;
        }

        .experiment2-skin > div:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          height: 58px !important;
          min-height: 58px !important;
          overflow: visible !important;
          background: rgba(248, 243, 231, 0.92) !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          backdrop-filter: blur(10px);
        }

        .experiment2-skin > div:first-child::after {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: -1px;
          height: 4px;
          background: var(--ink);
          opacity: 0.82;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 640 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 7 Q155 2 320 7 T637 6' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
          pointer-events: none;
        }

        .experiment2-skin main.bg-neutral-50,
        .experiment2-skin .bg-neutral-50 {
          background: transparent !important;
        }

        .experiment2-skin .bg-white,
        .experiment2-skin .bg-background\/80,
        .experiment2-skin .bg-secondary {
          background-color: var(--paper-soft) !important;
        }

        .experiment2-skin .border,
        .experiment2-skin .border-border,
        .experiment2-skin .border-input,
        .experiment2-skin .border-neutral-200,
        .experiment2-skin .border-neutral-300 {
          border-color: var(--ink-soft) !important;
        }

        .experiment2-skin [class*="shadow"] {
          box-shadow: none !important;
        }

        .experiment2-skin input,
        .experiment2-skin textarea {
          background: rgba(248, 243, 231, 0.93) !important;
          border-color: rgba(21, 21, 21, 0.74) !important;
          box-shadow: none !important;
        }

        .experiment2-skin input:focus,
        .experiment2-skin textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18) !important;
        }

        .experiment2-skin section.bg-transparent > div > div.relative.aspect-video {
          border-color: var(--ink) !important;
          border-radius: 15px !important;
          position: relative;
        }

        .experiment2-skin section.bg-transparent > div > div.relative.aspect-video::after {
          content: "";
          position: absolute;
          inset: -3px;
          border: 1.6px solid rgba(21, 21, 21, 0.96);
          border-radius: 18px;
          transform: rotate(-0.12deg);
          pointer-events: none;
          z-index: 30;
        }

        .experiment2-skin h1,
        .experiment2-skin h2,
        .experiment2-skin h3,
        .experiment2-skin h4,
        .experiment2-skin .font-heading,
        .experiment2-skin .font-brand {
          letter-spacing: 0.01em;
        }

        .experiment2-skin section.bg-transparent h1 {
          font-size: 28px !important;
          line-height: 1.12 !important;
        }

        .experiment2-skin section.bg-transparent a[href^="/channel/"] img,
        .experiment2-skin section.bg-transparent a[href^="/channel/"] {
          border-radius: 999px !important;
        }

        .experiment2-skin section.bg-transparent div[class*="rounded-[14px]"] {
          position: relative;
          background: rgba(238, 238, 238, 0.66) !important;
          border-color: rgba(21, 21, 21, 0.62) !important;
        }

        .experiment2-skin section.bg-transparent div[class*="rounded-[14px]"]::after {
          content: "";
          position: absolute;
          inset: -2px;
          border: 1px solid rgba(21, 21, 21, 0.72);
          border-radius: 15px;
          transform: rotate(0.08deg);
          pointer-events: none;
        }

        .experiment2-skin aside a[href^="/?v="] {
          position: relative;
          overflow: hidden;
          border: 1.15px solid rgba(21, 21, 21, 0.68) !important;
          border-radius: 14px !important;
          background: transparent !important;
        }

        .experiment2-skin aside a[href^="/?v="]::before {
          content: "";
          position: absolute;
          inset: 4px 5px;
          border-radius: 12px;
          background: var(--n4-idle);
          opacity: 0.58;
          transform: rotate(0.08deg);
          clip-path: polygon(2% 12%, 48% 2%, 98% 10%, 96% 88%, 52% 98%, 3% 89%);
          z-index: 0;
          pointer-events: none;
        }

        .experiment2-skin aside a[aria-current="page"]::before {
          background: var(--n4-active);
          opacity: 0.86;
        }

        .experiment2-skin aside a[href^="/?v="] > * {
          position: relative;
          z-index: 1;
        }

        .experiment2-skin aside [class*="border-b"] {
          border-color: rgba(21, 21, 21, 0.72) !important;
        }

        .experiment2-skin [class*="bg-black/62"],
        .experiment2-skin [class*="bg-primary"] {
          background-color: var(--ink) !important;
        }

        .experiment2-skin button[class*="bg-[#171717]"],
        .experiment2-skin button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"] {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          min-height: 40px !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
          border-radius: 999px !important;
          border: 0 !important;
          color: #fff !important;
          background: transparent !important;
          transform: rotate(-0.25deg);
        }

        .experiment2-skin button[class*="bg-[#171717]"]::before,
        .experiment2-skin button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"]::before {
          content: "";
          position: absolute;
          inset: 2px 4px;
          z-index: -2;
          border-radius: 999px;
          background:
            repeating-linear-gradient(-15deg, rgba(255,255,255,.16) 0 1px, transparent 1px 4px),
            #151515;
          clip-path: polygon(3% 18%, 18% 7%, 50% 3%, 82% 7%, 97% 20%, 96% 78%, 83% 94%, 50% 98%, 16% 93%, 3% 78%);
        }

        .experiment2-skin button[class*="bg-[#171717]"]::after,
        .experiment2-skin button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"]::after {
          content: "";
          position: absolute;
          inset: 1px 2px;
          z-index: -1;
          border: 1.6px solid var(--ink);
          border-radius: 999px;
          transform: rotate(0.45deg);
          pointer-events: none;
        }

        .experiment2-skin button[class*="bg-[#171717]"] svg,
        .experiment2-skin button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"] svg {
          filter: drop-shadow(0 0 0 currentColor);
          transform: rotate(-4deg);
        }

        .experiment2-skin button[class*="bg-[#171717]"] span,
        .experiment2-skin button[class*="bg-secondary"][class*="rounded-full"][class*="h-[38px]"] span {
          position: relative;
          top: -0.5px;
          color: #fff !important;
          font-size: 14px !important;
          letter-spacing: 0.01em;
        }

        .experiment2-skin aside button.w-full,
        .experiment2-skin aside button[class*="bg-primary"] {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          height: 50px !important;
          border: 0 !important;
          border-radius: 13px !important;
          color: white !important;
          background: transparent !important;
          font-size: 17px !important;
          letter-spacing: 0.01em;
          transform: rotate(-0.18deg);
        }

        .experiment2-skin aside button.w-full::before,
        .experiment2-skin aside button[class*="bg-primary"]::before {
          content: "";
          position: absolute;
          inset: 3px 4px;
          z-index: -3;
          border-radius: 12px;
          background:
            repeating-linear-gradient(-18deg, rgba(255,255,255,.25) 0 1.4px, transparent 1.4px 4.6px),
            var(--b5);
          clip-path: polygon(2% 13%, 16% 5%, 50% 2%, 84% 5%, 98% 13%, 97% 86%, 84% 95%, 50% 98%, 16% 95%, 2% 86%);
        }

        .experiment2-skin aside button.w-full::after,
        .experiment2-skin aside button[class*="bg-primary"]::after {
          content: "";
          position: absolute;
          inset: 1px 2px;
          z-index: -2;
          border: 1.6px solid var(--b5-dark);
          border-radius: 13px;
          transform: rotate(0.38deg);
          pointer-events: none;
        }

        .experiment2-skin aside button.w-full:hover,
        .experiment2-skin aside button[class*="bg-primary"]:hover,
        .experiment2-skin button[class*="bg-[#171717]"]:hover {
          filter: brightness(1.04);
          transform: translateY(-1px) rotate(-0.18deg);
        }

        .experiment2-skin aside button.w-full:active,
        .experiment2-skin aside button[class*="bg-primary"]:active,
        .experiment2-skin button[class*="bg-[#171717]"]:active {
          transform: translateY(0) scale(0.985) rotate(0deg) !important;
        }

        .experiment2-skin div[class*="rounded-[16px]"],
        .experiment2-skin div[class*="rounded-2xl"],
        .experiment2-skin [role="menu"] {
          background: rgba(248, 243, 231, 0.96) !important;
          border-color: rgba(21,21,21,.68) !important;
        }

        .experiment2-skin [role="menu"] {
          box-shadow: 0 8px 24px rgba(21,21,21,.08) !important;
        }

        .experiment2-skin footer {
          background: transparent !important;
          border-color: rgba(21,21,21,.45) !important;
        }
      `}</style>
    </div>
  );
}
