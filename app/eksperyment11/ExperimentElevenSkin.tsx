"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "wired-button": any;
      "wired-card": any;
      "wired-divider": any;
      "wired-progress": any;
      "wired-slider": any;
      "wired-toggle": any;
    }
  }
}

function WiredToolPanel() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    import("wired-elements").then(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="exp11-wired-panel loading" aria-hidden="true">loading wired-elements…</div>;
  }

  return (
    <div className="exp11-wired-panel" aria-hidden="true">
      <wired-card elevation={2} style={{ display: "block", padding: "14px" }}>
        <strong>wired-elements</strong>
        <p>prototyp web components</p>
        <wired-divider />
        <div className="exp11-wire-row">
          <wired-button elevation={2}>watch</wired-button>
          <wired-toggle checked />
        </div>
        <wired-progress value={72} max={100} style={{ width: "100%" }} />
        <wired-slider value={46} style={{ width: "100%" }} />
      </wired-card>
    </div>
  );
}

export default function ExperimentElevenSkin({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      router.push(`/eksperyment11?v=${encodeURIComponent(url.searchParams.get("v") || "")}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="experiment11-skin">
      <section className="exp11-board" aria-label="Eksperyment 11 — wired-elements prototype">
        <WiredToolPanel />
        <div className="exp11-badge" aria-hidden="true">wired prototype · /eksperyment11</div>
        {children}
      </section>

      <style jsx global>{`
        .experiment11-skin {
          --paper: #f6efe2;
          --ink: #171411;
          --ink-soft: rgba(23,20,17,.66);
          --wire: #24201b;
          --accent: #df9b46;
          --blue: #2f63c7;
          min-height: 100vh;
          padding: clamp(10px, 2.5vw, 38px);
          color: var(--ink);
          background:
            radial-gradient(circle at 16% 10%, rgba(223,155,70,.20), transparent 30vw),
            radial-gradient(circle at 90% 18%, rgba(47,99,199,.12), transparent 30vw),
            repeating-linear-gradient(0deg, rgba(23,20,17,.032) 0 1px, transparent 1px 18px),
            var(--paper);
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive;
          overflow-x: hidden;
        }

        .experiment11-skin *,
        .experiment11-skin *::before,
        .experiment11-skin *::after { box-sizing: border-box; }

        .experiment11-skin * {
          font-family: "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive !important;
        }

        .exp11-board {
          position: relative;
          width: min(100%, 1500px);
          min-height: 100vh;
          margin-inline: auto;
          overflow: hidden;
          border: 2px solid rgba(23,20,17,.34);
          border-radius: 18px;
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M14 42 C40 28 74 58 112 34 S166 42 170 70' fill='none' stroke='%23171411' stroke-opacity='.055' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M10 122 C42 142 76 110 114 132 S154 124 174 142' fill='none' stroke='%23171411' stroke-opacity='.05' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E"),
            rgba(246,239,226,.90);
          box-shadow: 0 28px 80px rgba(65,45,20,.15), inset 0 0 0 8px rgba(255,255,255,.18);
          isolation: isolate;
        }

        .exp11-badge {
          position: absolute;
          right: 22px;
          top: 20px;
          z-index: 1002;
          padding: 8px 12px;
          color: var(--ink);
          background: rgba(246,239,226,.82);
          border: 1.5px dashed rgba(23,20,17,.48);
          border-radius: 7px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
          transform: rotate(.45deg);
          pointer-events: none;
        }

        .exp11-wired-panel {
          position: absolute;
          left: 24px;
          top: 96px;
          z-index: 40;
          width: 230px;
          color: var(--ink);
          pointer-events: none;
          opacity: .96;
        }

        .exp11-wired-panel.loading {
          padding: 12px;
          border: 1px dashed rgba(23,20,17,.40);
          background: rgba(246,239,226,.84);
          font-size: 12px;
          font-weight: 800;
        }

        .exp11-wired-panel strong {
          display: block;
          margin-bottom: 4px;
          font-size: 12px;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .exp11-wired-panel p {
          margin: 0 0 8px;
          font-size: 11px;
        }

        .exp11-wire-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 8px 0 10px;
        }

        .exp11-board > .exp11-wired-panel + .exp11-badge + div {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          overflow: visible !important;
          background: rgba(246, 239, 226, .92) !important;
          border-bottom: 2px solid rgba(23,20,17,.22) !important;
          box-shadow: 0 12px 34px rgba(65,45,20,.08) !important;
          backdrop-filter: blur(10px);
        }

        .exp11-board main[class*="bg-neutral-50"],
        .exp11-board .bg-neutral-50,
        .exp11-board .bg-white,
        .exp11-board .bg-background\/80,
        .exp11-board .bg-secondary { background: transparent !important; }

        .exp11-board .text-neutral-900,
        .exp11-board .text-foreground,
        .exp11-board .text-black,
        .exp11-board h1,
        .exp11-board h2,
        .exp11-board h3,
        .exp11-board strong { color: var(--ink) !important; }

        .exp11-board .text-neutral-700,
        .exp11-board .text-neutral-600,
        .exp11-board .text-muted-foreground,
        .exp11-board p,
        .exp11-board span { color: var(--ink-soft); }

        .exp11-board .border,
        .exp11-board .border-border,
        .exp11-board .border-input,
        .exp11-board .border-neutral-100,
        .exp11-board .border-neutral-200,
        .exp11-board .border-neutral-300 { border-color: rgba(23,20,17,.34) !important; }

        .exp11-board [class*="shadow"] { box-shadow: 0 14px 36px rgba(65,45,20,.10) !important; }

        .exp11-board input,
        .exp11-board textarea {
          background: rgba(255,250,238,.90) !important;
          border: 1.5px solid rgba(23,20,17,.46) !important;
          border-radius: 9px !important;
          box-shadow: 4px 5px 0 rgba(23,20,17,.08) !important;
        }

        .exp11-board section.bg-transparent > div > div.relative.aspect-video {
          position: relative;
          overflow: hidden;
          border: 2px solid var(--wire) !important;
          border-radius: 12px !important;
          background: #151515 !important;
          box-shadow: 12px 14px 0 rgba(223,155,70,.24) !important;
        }

        .exp11-board section.bg-transparent h1 {
          display: inline;
          text-decoration-line: underline;
          text-decoration-style: wavy;
          text-decoration-thickness: 2px;
          text-decoration-color: var(--accent);
          text-underline-offset: 6px;
        }

        .exp11-board section.bg-transparent div[class*="rounded-[14px]"] {
          border: 1.5px dashed rgba(23,20,17,.42) !important;
          border-radius: 10px !important;
          background: rgba(255,250,238,.70) !important;
        }

        .exp11-board button[class*="bg-[#171717]"],
        .exp11-board aside button.w-full,
        .exp11-board aside button[class*="bg-primary"],
        .exp11-board [class*="bg-primary"] {
          color: white !important;
          border: 1.5px solid var(--ink) !important;
          border-radius: 10px !important;
          background: var(--ink) !important;
          box-shadow: 5px 6px 0 rgba(47,99,199,.22) !important;
        }

        .exp11-board [class*="bg-black/62"] { background-color: rgba(23,20,17,.72) !important; }

        .exp11-board aside {
          position: relative;
          padding-left: 22px;
          border-left: 2px dashed rgba(23,20,17,.34);
        }

        .exp11-board aside::before {
          content: "wired queue";
          display: inline-block;
          margin-bottom: 10px;
          color: var(--blue);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .exp11-board aside a[href^="/?v="] {
          position: relative;
          margin-bottom: 13px !important;
          overflow: visible;
          border: 1.5px solid rgba(23,20,17,.36) !important;
          border-radius: 11px !important;
          background: rgba(255,250,238,.78) !important;
        }

        .exp11-board aside a[href^="/?v="]:hover {
          transform: translateY(-2px) rotate(-.15deg);
          box-shadow: 6px 6px 0 rgba(223,155,70,.20) !important;
        }

        .exp11-board aside a[aria-current="page"] {
          background: rgba(223,155,70,.20) !important;
          border-color: rgba(23,20,17,.62) !important;
        }

        .exp11-board aside a[href^="/?v="] > div:first-child {
          border-radius: 8px !important;
          filter: saturate(.95) contrast(1.05);
        }

        .exp11-board div[class*="rounded-[16px]"],
        .exp11-board div[class*="rounded-2xl"],
        .exp11-board [role="menu"] {
          background: rgba(255,250,238,.96) !important;
          border-color: rgba(23,20,17,.36) !important;
          border-radius: 11px !important;
        }

        .exp11-board footer {
          background: transparent !important;
          border-color: rgba(23,20,17,.18) !important;
        }

        @media (max-width: 980px) {
          .exp11-wired-panel { display: none; }
        }

        @media (max-width: 768px) {
          .experiment11-skin { padding: 0; }
          .exp11-board { border-inline: 0; border-radius: 0; box-shadow: none; }
          .exp11-badge { display: none; }
          .exp11-board aside { padding-left: 0; border-left: 0; }
        }
      `}</style>
    </div>
  );
}
