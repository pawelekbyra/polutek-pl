"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExperimentThirteenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment13?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment13-skin">
      <section className="exp13-app" aria-label="Eksperyment 13 — tactile app UI">
        <div className="exp13-status" aria-hidden="true">
          <span>13</span>
          <b>tactile app mode</b>
          <em>tap / active / safe-area</em>
        </div>
        {children}
      </section>

      <style jsx global>{`
        .experiment13-skin {
          --bg: #eef1e8;
          --surface: rgba(255,255,249,.82);
          --ink: #111312;
          --ink-soft: rgba(17,19,18,.62);
          --accent: #4f6f52;
          --accent-2: #d98242;
          --line: rgba(17,19,18,.12);
          min-height: 100vh;
          padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
          color: var(--ink);
          background:
            radial-gradient(circle at 20% 8%, rgba(79,111,82,.18), transparent 32vw),
            radial-gradient(circle at 86% 20%, rgba(217,130,66,.16), transparent 32vw),
            linear-gradient(180deg, #f6f4ea, var(--bg));
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-tap-highlight-color: transparent;
        }

        .experiment13-skin *,
        .experiment13-skin *::before,
        .experiment13-skin *::after { box-sizing: border-box; }

        .experiment13-skin * {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        .experiment13-skin button,
        .experiment13-skin a,
        .experiment13-skin [role="button"] {
          touch-action: manipulation;
          user-select: none;
          -webkit-user-drag: none;
          transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease;
        }

        .experiment13-skin button:active,
        .experiment13-skin a:active,
        .experiment13-skin [role="button"]:active {
          transform: scale(.975);
        }

        .exp13-app {
          position: relative;
          width: min(100%, 1500px);
          min-height: calc(100vh - 20px);
          margin-inline: auto;
          overflow: hidden;
          border: 1px solid rgba(17,19,18,.10);
          border-radius: clamp(22px, 3vw, 42px);
          background:
            linear-gradient(180deg, rgba(255,255,249,.82), rgba(238,241,232,.78)),
            radial-gradient(circle at 18px 18px, rgba(17,19,18,.055) 1px, transparent 1.2px) 0 0 / 24px 24px;
          box-shadow: 0 30px 90px rgba(48,55,43,.16), inset 0 0 0 1px rgba(255,255,255,.55);
          isolation: isolate;
        }

        .exp13-app::before {
          content: "";
          position: absolute;
          inset: 12px;
          z-index: 1;
          pointer-events: none;
          border-radius: clamp(18px, 2.4vw, 34px);
          border: 1px solid rgba(255,255,255,.48);
        }

        .exp13-status {
          position: absolute;
          top: max(18px, env(safe-area-inset-top));
          right: max(18px, env(safe-area-inset-right));
          z-index: 1002;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px 8px 8px;
          color: var(--ink);
          background: rgba(255,255,249,.82);
          border: 1px solid rgba(17,19,18,.10);
          border-radius: 999px;
          box-shadow: 0 14px 34px rgba(48,55,43,.12), inset 0 0 0 1px rgba(255,255,255,.64);
          backdrop-filter: blur(14px) saturate(1.25);
          pointer-events: none;
        }

        .exp13-status span {
          display: inline-grid;
          place-items: center;
          width: 30px;
          height: 30px;
          color: white !important;
          border-radius: 999px;
          background: var(--accent);
          font-size: 12px;
          font-weight: 900;
        }

        .exp13-status b,
        .exp13-status em {
          color: var(--ink) !important;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .10em;
          text-transform: uppercase;
          font-style: normal;
        }

        .exp13-status em { opacity: .55; }

        .exp13-app > .exp13-status + div {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(255, 255, 249, .72) !important;
          border-bottom: 1px solid rgba(17,19,18,.08) !important;
          box-shadow: 0 16px 42px rgba(48,55,43,.08) !important;
          backdrop-filter: blur(18px) saturate(1.28);
        }

        .exp13-app main[class*="bg-neutral-50"],
        .exp13-app .bg-neutral-50,
        .exp13-app .bg-white,
        .exp13-app .bg-background\/80,
        .exp13-app .bg-secondary { background: transparent !important; }

        .exp13-app .text-neutral-900,
        .exp13-app .text-foreground,
        .exp13-app .text-black,
        .exp13-app h1,
        .exp13-app h2,
        .exp13-app h3,
        .exp13-app strong { color: var(--ink) !important; }

        .exp13-app .text-neutral-700,
        .exp13-app .text-neutral-600,
        .exp13-app .text-muted-foreground,
        .exp13-app p,
        .exp13-app span { color: var(--ink-soft); }

        .exp13-app .border,
        .exp13-app .border-border,
        .exp13-app .border-input,
        .exp13-app .border-neutral-100,
        .exp13-app .border-neutral-200,
        .exp13-app .border-neutral-300 { border-color: rgba(17,19,18,.12) !important; }

        .exp13-app [class*="shadow"] { box-shadow: 0 18px 52px rgba(48,55,43,.13) !important; }

        .exp13-app input,
        .exp13-app textarea {
          color: var(--ink) !important;
          background: rgba(255,255,249,.86) !important;
          border: 1px solid rgba(17,19,18,.10) !important;
          border-radius: 999px !important;
          min-height: 44px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.68), 0 10px 28px rgba(48,55,43,.08) !important;
        }

        .exp13-app input:focus,
        .exp13-app textarea:focus {
          outline: none !important;
          box-shadow: 0 0 0 4px rgba(79,111,82,.16), inset 0 0 0 1px rgba(255,255,255,.70) !important;
        }

        .exp13-app section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(17,19,18,.12) !important;
          border-radius: clamp(22px, 2.6vw, 36px) !important;
          background: #121312 !important;
          box-shadow: 0 24px 70px rgba(17,19,18,.22), inset 0 0 0 1px rgba(255,255,255,.08) !important;
        }

        .exp13-app section.bg-transparent > div > div.relative.aspect-video::after {
          content: "swipe-safe video surface";
          position: absolute;
          left: 14px;
          bottom: 14px;
          z-index: 36;
          padding: 6px 10px;
          color: white;
          background: rgba(17,19,18,.54);
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
          pointer-events: none;
          backdrop-filter: blur(12px);
        }

        .exp13-app section.bg-transparent h1 {
          display: inline;
          letter-spacing: -.055em !important;
          background: linear-gradient(transparent 60%, rgba(79,111,82,.18) 60% 86%, transparent 86%);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }

        .exp13-app section.bg-transparent div[class*="rounded-[14px]"] {
          border: 1px solid rgba(17,19,18,.10) !important;
          border-radius: 22px !important;
          background: rgba(255,255,249,.68) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.62), 0 12px 34px rgba(48,55,43,.09) !important;
        }

        .exp13-app button[class*="bg-[#171717]"],
        .exp13-app aside button.w-full,
        .exp13-app aside button[class*="bg-primary"],
        .exp13-app [class*="bg-primary"] {
          color: white !important;
          border: 0 !important;
          border-radius: 999px !important;
          min-height: 44px;
          background: linear-gradient(135deg, var(--accent), #364f39) !important;
          box-shadow: 0 14px 34px rgba(79,111,82,.24) !important;
        }

        .exp13-app [class*="bg-black/62"] { background-color: rgba(17,19,18,.64) !important; }

        .exp13-app aside {
          position: relative;
          padding-left: 18px;
          border-left: 1px solid rgba(17,19,18,.08);
        }

        .exp13-app aside::before {
          content: "mobile queue";
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          margin-bottom: 10px;
          padding: 0 12px;
          color: var(--accent);
          background: rgba(255,255,249,.62);
          border: 1px solid rgba(17,19,18,.08);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .exp13-app aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 12px !important;
          overflow: hidden;
          border: 1px solid rgba(17,19,18,.08) !important;
          border-radius: 22px !important;
          background: rgba(255,255,249,.72) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.62), 0 12px 30px rgba(48,55,43,.08) !important;
        }

        .exp13-app aside a[href^="/?v="]:hover {
          transform: translateY(-2px);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.64), 0 16px 38px rgba(48,55,43,.13) !important;
        }

        .exp13-app aside a[aria-current="page"] {
          background: rgba(79,111,82,.14) !important;
          border-color: rgba(79,111,82,.22) !important;
        }

        .exp13-app aside a[href^="/?v="] > div:first-child {
          border-radius: 18px !important;
          filter: saturate(1.02) contrast(1.03);
        }

        .exp13-app div[class*="rounded-[16px]"],
        .exp13-app div[class*="rounded-2xl"],
        .exp13-app [role="menu"] {
          background: rgba(255,255,249,.94) !important;
          border-color: rgba(17,19,18,.10) !important;
          border-radius: 22px !important;
        }

        .exp13-app footer {
          background: transparent !important;
          border-color: rgba(17,19,18,.08) !important;
        }

        @media (max-width: 768px) {
          .experiment13-skin {
            padding: 0;
          }

          .exp13-app {
            min-height: 100vh;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .exp13-status {
            display: none;
          }

          .exp13-app aside {
            padding-left: 0;
            border-left: 0;
          }

          .exp13-app section.bg-transparent > div > div.relative.aspect-video {
            border-radius: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
