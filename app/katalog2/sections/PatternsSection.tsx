"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { PillSelect, Slider, Toggle } from "../components/Controls";

function useRoughRect(roughness = 1, strokeWidth = 1.5, seed = 42) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    if (w === 0 || h === 0) return;
    setDims({ w, h });
    const rc = rough.svg(el);
    el.innerHTML = "";
    const rect = rc.rectangle(3, 3, w - 6, h - 6, { roughness, strokeWidth, stroke: "#1a1a1a", seed });
    el.appendChild(rect);
  }, [roughness, strokeWidth, seed]);

  return svgRef;
}

type VideoCardStyle = "current" | "rough-subtle" | "rough-strong" | "svg-open";

function VideoCard({ style = "current" }: { style?: VideoCardStyle }) {
  const roughSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = roughSvgRef.current;
    if (!el || style !== "rough-subtle" && style !== "rough-strong") return;
    const rc = rough.svg(el);
    el.innerHTML = "";
    const rect = rc.rectangle(2, 2, 252, 140, {
      roughness: style === "rough-subtle" ? 0.8 : 2,
      strokeWidth: style === "rough-subtle" ? 1 : 1.5,
      stroke: "#1a1a1a",
      seed: 42,
    });
    el.appendChild(rect);
  }, [style]);

  const badge = (
    <span
      className="absolute top-2 left-2 text-[10px] font-black uppercase px-1.5 py-0.5 tracking-widest z-20 text-white rounded"
      style={{ background: style.startsWith("rough") ? undefined : "#1a1a1a" }}
    >
      {style.startsWith("rough") ? (
        <span className="relative">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 75 18" preserveAspectRatio="none">
            <path d="M 2 2 L 73 3 L 72 16 L 3 15 Z" fill="#1a1a1a" />
          </svg>
          <span className="relative px-1">PUBLICZNE</span>
        </span>
      ) : "PUBLICZNE"}
    </span>
  );

  return (
    <div className="w-64 group cursor-pointer">
      <div className="relative aspect-video mb-2">
        {style === "current" && (
          <div className="absolute inset-0 border border-neutral-300 rounded-md overflow-hidden bg-neutral-200 flex items-center justify-center text-neutral-400 text-xs">
            miniaturka
          </div>
        )}
        {(style === "rough-subtle" || style === "rough-strong") && (
          <div className="relative w-full h-full">
            <svg ref={roughSvgRef} className="absolute inset-0 w-full h-full z-10" />
            <div className="absolute inset-[4px] bg-neutral-200 flex items-center justify-center text-neutral-400 text-xs">
              miniaturka
            </div>
          </div>
        )}
        {style === "svg-open" && (
          <div className="relative w-full h-full">
            <svg className="absolute inset-0 w-full h-full z-10" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round">
              <path d="M 20 4 L 252 5 L 253 139 M 235 140 L 4 140 L 3 22" />
            </svg>
            <div className="absolute inset-[4px] bg-neutral-200 flex items-center justify-center text-neutral-400 text-xs">
              miniaturka
            </div>
          </div>
        )}
        <div className="absolute top-2 left-2 text-[10px] font-black uppercase px-1.5 py-0.5 tracking-widest z-20 text-white bg-black/70 backdrop-blur-sm rounded">
          PUBLICZNE
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1 z-20">
          12:34
        </div>
      </div>
      <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-tight leading-tight">Cześć Słońce</h3>
      <p className="text-xs text-neutral-500 mt-0.5">Paweł Polutek · 7 wyświetleń · 3 dni temu</p>
    </div>
  );
}

function SidebarPanel({ style = "current" }: { style?: "current" | "rough" }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (style !== "rough" || !svgRef.current) return;
    const rc = rough.svg(svgRef.current);
    svgRef.current.innerHTML = "";
    const rect = rc.rectangle(3, 3, 314, 174, { roughness: 1, strokeWidth: 1, stroke: "#1a1a1a", seed: 55 });
    svgRef.current.appendChild(rect);
  }, [style]);

  const noiseUrl = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

  return (
    <div
      className="relative w-80 p-5 rounded"
      style={{
        backgroundColor: style === "rough" ? "#fdfbf7" : "white",
        border: style === "current" ? "1px solid #e5e7eb" : "none",
        borderRadius: style === "current" ? "12px" : 0,
      }}
    >
      {style === "rough" && (
        <>
          <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <div className="absolute inset-0 rounded pointer-events-none" style={{ backgroundImage: noiseUrl, opacity: 0.05 }} />
        </>
      )}
      <div className="relative z-10">
        <h3 className="font-bold text-neutral-900 mb-1">Wspieraj rozwój POLUTEK.PL</h3>
        <p className="text-xs text-neutral-500 mb-3">Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze.</p>
        <div className="border border-neutral-200 rounded p-3 mb-3 text-center">
          <div className="text-xs text-neutral-500 uppercase tracking-widest">DO PREMIERY</div>
          <div className="text-2xl font-black text-blue-600 my-1">105</div>
          <div className="text-xs text-neutral-500">dni 19:57:35</div>
        </div>
        <button className="w-full py-2.5 bg-blue-600 text-white font-bold text-sm rounded">
          Wesprzyj POLUTEK.PL
        </button>
      </div>
    </div>
  );
}

function SeparatorDemo() {
  const ref = useRef<SVGSVGElement>(null);
  const [style, setStyle] = useState<"current" | "rough" | "freehand">("current");

  useEffect(() => {
    if (style !== "rough" || !ref.current) return;
    const rc = rough.svg(ref.current);
    ref.current.innerHTML = "";
    const line = rc.line(0, 10, 600, 10, { roughness: 1.2, strokeWidth: 1, stroke: "#d1d5db", seed: 42 });
    ref.current.appendChild(line);
  }, [style]);

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        {(["current", "rough", "freehand"] as const).map(s => (
          <button key={s} onClick={() => setStyle(s)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${style === s ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 hover:bg-neutral-50"}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="py-4">
        <p className="text-sm text-neutral-600 mb-3">Tekst przed separatorem</p>
        {style === "current" && <hr className="border-neutral-200" />}
        {style === "rough" && <svg ref={ref} width="100%" height="20" />}
        {style === "freehand" && (
          <svg width="100%" height="20" fill="none">
            <path d="M 0 10 Q 150 8 300 11 Q 450 13 600 10" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        <p className="text-sm text-neutral-600 mt-3">Tekst po separatorze</p>
      </div>
    </div>
  );
}

export default function PatternsSection() {
  const [cardStyle, setCardStyle] = useState<VideoCardStyle>("current");

  return (
    <div>
      <SectionHeader
        title="Złożone Wzorce"
        subtitle="Jak techniki wyglądają na rzeczywistych komponentach Polutek — karta wideo, panel boczny, separatory, nagłówki."
        icon="🎨"
      />

      <div className="space-y-4">
        <DemoBox
          id="ZW-CARD"
          title="Karta wideo — 4 style porównanie"
          status="kandydat"
          tech="roughjs"
          description="Ten sam komponent karty wideo w różnych stylach ramki. Wybierz styl."
          fullWidth
          controls={
            <div className="space-y-2">
              <PillSelect
                label="styl ramki"
                value={cardStyle}
                options={[
                  { value: "current", label: "obecny (CSS)" },
                  { value: "rough-subtle", label: "rough subtelny" },
                  { value: "rough-strong", label: "rough mocny" },
                  { value: "svg-open", label: "SVG otwarty" },
                ]}
                onChange={(v) => setCardStyle(v as VideoCardStyle)}
              />
            </div>
          }
        >
          <VideoCard style={cardStyle} />
        </DemoBox>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["current", "rough-subtle", "rough-strong", "svg-open"] as VideoCardStyle[]).map(s => (
            <DemoBox
              key={s}
              title={s === "current" ? "Obecny (CSS)" : s === "rough-subtle" ? "Rough subtelny" : s === "rough-strong" ? "Rough mocny" : "SVG otwarty"}
              status={s === "current" ? "kandydat" : s === "rough-subtle" ? "kandydat" : s === "rough-strong" ? "inspiracja" : "eksperyment"}
              tech={s === "current" ? "CSS/SVG" : "roughjs"}
            >
              <VideoCard style={s} />
            </DemoBox>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DemoBox
            id="ZW-SIDEBAR-NOW"
            title='Panel "Wesprzyj" — obecny styl'
            status="kandydat"
            tech="CSS/SVG"
            description="Aktualny wygląd panelu z polutek.pl"
          >
            <SidebarPanel style="current" />
          </DemoBox>

          <DemoBox
            id="ZW-SIDEBAR-ROUGH"
            title='Panel "Wesprzyj" — rough styl'
            status="inspiracja"
            tech="roughjs"
            description="Ten sam panel z RoughJS border + papierowe tło"
          >
            <SidebarPanel style="rough" />
          </DemoBox>
        </div>

        <DemoBox
          id="ZW-SEP"
          title="Separator — trzy warianty"
          status="kandydat"
          tech="roughjs"
          description="Separator między sekcjami w trzech technikach: CSS border, RoughJS line, custom SVG path"
          fullWidth
        >
          <SeparatorDemo />
        </DemoBox>

        <DemoBox
          id="ZW-HEADER"
          title="Nagłówek strony — kompozycja"
          status="kandydat"
          tech="CSS/SVG"
          description="Navbar z odręcznymi elementami: logo rough, search box, przyciski"
          fullWidth
        >
          <div className="w-full border-b border-neutral-200 px-4 py-3 flex items-center gap-4 bg-white">
            <div className="font-black text-lg tracking-tight uppercase">
              POLUTEK<span className="relative">
                <svg className="absolute bottom-0 left-0 w-full" height="4" viewBox="0 0 60 4" preserveAspectRatio="none">
                  <path d="M 0 3 Q 30 1 60 3" stroke="#2563eb" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
                .PL
              </span>
            </div>
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Szukaj..."
                className="w-full pl-3 pr-8 py-1.5 text-sm"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cpath d='M4,4 L96%25,5 L95%25,95%25 L5,96%25 Z' fill='none' stroke='%23d1d5db' stroke-width='1.5'/%3E%3C/svg%3E")`,
                  backgroundSize: "100% 100%",
                  outline: "none",
                }}
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <button className="relative px-3 py-1 text-xs font-bold">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 60 28" preserveAspectRatio="none">
                  <path d="M 3 4 L 57 5 L 56 24 L 4 23 Z" fill="none" stroke="#1a1a1a" strokeWidth="1.5" />
                </svg>
                <span className="relative">PL</span>
              </button>
              <button className="relative px-4 py-1 text-xs font-bold">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 28" preserveAspectRatio="none">
                  <path d="M 3 4 L 77 5 L 76 24 L 4 23 Z" fill="none" stroke="#1a1a1a" strokeWidth="1.5" />
                </svg>
                <span className="relative">→ WEJŚCIE</span>
              </button>
            </div>
          </div>
        </DemoBox>
      </div>
    </div>
  );
}
