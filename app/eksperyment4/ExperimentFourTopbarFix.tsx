"use client";

export default function ExperimentFourTopbarFix() {
  return (
    <style jsx global>{`
      .exp4-drawing .relative.min-h-screen.overflow-x-hidden {
        padding-top: 82px !important;
      }

      .exp4-drawing .relative.min-h-screen.overflow-x-hidden > nav {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 1000 !important;
        width: 100% !important;
        background: rgba(248, 243, 231, 0.92) !important;
        box-shadow: none !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
      }

      .exp4-drawing .relative.min-h-screen.overflow-x-hidden > nav > div:first-child,
      .exp4-drawing .relative.min-h-screen.overflow-x-hidden > nav > div:last-child {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      .exp4-drawing .relative.min-h-screen.overflow-x-hidden > nav > div:first-child > div.relative {
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      .exp4-drawing .relative.min-h-screen.overflow-x-hidden > nav input {
        background: transparent !important;
        border: 0 !important;
        border-radius: 999px !important;
        box-shadow: none !important;
        outline: none !important;
      }

      .exp4-drawing .relative.min-h-screen.overflow-x-hidden > nav input:focus {
        box-shadow: none !important;
      }

      .exp4-drawing .relative.min-h-screen.overflow-x-hidden > nav a[href="/"] svg.absolute {
        display: none !important;
      }

      @media (max-width: 768px) {
        .exp4-drawing .relative.min-h-screen.overflow-x-hidden {
          padding-top: 76px !important;
        }
      }
    `}</style>
  );
}
