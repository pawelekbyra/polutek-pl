"use client";

import React from "react";

export default function MainIllustratedSkin({ children }: { children: React.ReactNode }) {
  return (
    <div className="main-illustrated-skin min-h-screen text-neutral-950">
      {children}
      <style jsx global>{`
        .main-illustrated-skin {
          --paper: #f8f3e7;
          --ink: #171717;
          --ink-soft: rgba(23, 23, 23, 0.68);
          --line: rgba(23, 23, 23, 0.42);
          --blue: #2563eb;
          background:
            linear-gradient(rgba(23,23,23,.035) 1px, transparent 1px) 0 0 / 38px 38px,
            linear-gradient(90deg, rgba(23,23,23,.035) 1px, transparent 1px) 0 0 / 38px 38px,
            var(--paper) !important;
          font-family: "Comic Sans MS", "Comic Sans", "Segoe Print", "Bradley Hand", "Chalkboard SE", system-ui, sans-serif;
        }

        .main-illustrated-skin *,
        .main-illustrated-skin *::before,
        .main-illustrated-skin *::after {
          box-sizing: border-box;
        }

        .main-illustrated-skin * {
          font-family: inherit;
        }

        .main-illustrated-skin .bg-neutral-50,
        .main-illustrated-skin .bg-white,
        .main-illustrated-skin .bg-background,
        .main-illustrated-skin .bg-secondary,
        .main-illustrated-skin [class*="bg-background"],
        .main-illustrated-skin [class*="bg-secondary"] {
          background-color: transparent !important;
        }

        .main-illustrated-skin > div:first-child {
          height: 58px !important;
          min-height: 58px !important;
          background: rgba(248, 243, 231, .94) !important;
          border-bottom: 1.5px solid var(--ink) !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .main-illustrated-skin > div:first-child::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -6px;
          height: 10px;
          pointer-events: none;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 600 18' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'%3E%3Cpath d='M 0 8 Q 75 3 150 8 T 300 8 T 450 8 T 600 8' fill='none' stroke='%23171717' stroke-width='1.25' stroke-linecap='round' opacity='.55'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
        }

        .main-illustrated-skin input,
        .main-illustrated-skin textarea {
          background: rgba(248, 243, 231, .86) !important;
          border-color: var(--ink-soft) !important;
          box-shadow: none !important;
        }

        .main-illustrated-skin input:focus,
        .main-illustrated-skin textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, .16) !important;
        }

        .main-illustrated-skin button,
        .main-illustrated-skin a {
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
        }

        .main-illustrated-skin button[class*="rounded-full"],
        .main-illustrated-skin a[class*="rounded-full"],
        .main-illustrated-skin div[class*="rounded-full"] {
          border-radius: 7px !important;
        }

        .main-illustrated-skin .rounded-\[14px\],
        .main-illustrated-skin .rounded-\[16px\],
        .main-illustrated-skin .rounded-2xl,
        .main-illustrated-skin .rounded-xl {
          border-radius: 7px !important;
        }

        .main-illustrated-skin .border,
        .main-illustrated-skin .border-border,
        .main-illustrated-skin .border-input,
        .main-illustrated-skin .border-neutral-100,
        .main-illustrated-skin .border-neutral-200,
        .main-illustrated-skin .border-neutral-300 {
          border-color: var(--ink-soft) !important;
        }

        .main-illustrated-skin [class*="shadow"] {
          box-shadow: none !important;
        }

        .main-illustrated-skin .relative.aspect-video > div,
        .main-illustrated-skin .relative.aspect-video {
          border-color: var(--ink) !important;
        }

        .main-illustrated-skin h1,
        .main-illustrated-skin h2,
        .main-illustrated-skin h3 {
          color: var(--ink) !important;
        }

        .main-illustrated-skin h1 {
          letter-spacing: -0.035em !important;
        }

        .main-illustrated-skin aside h3,
        .main-illustrated-skin aside h2 {
          border-bottom: 2px solid var(--ink);
          display: inline-block;
        }

        .main-illustrated-skin svg path,
        .main-illustrated-skin svg circle,
        .main-illustrated-skin svg line,
        .main-illustrated-skin svg polyline {
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .main-illustrated-skin footer {
          background: transparent !important;
          border-color: var(--line) !important;
        }
      `}</style>
    </div>
  );
}
