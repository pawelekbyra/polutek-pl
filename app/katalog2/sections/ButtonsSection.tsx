"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { Slider, Toggle, ColorPicker, PillSelect } from "../components/Controls";

function RoughButton({ label = "Kliknij", roughness = 1.2, strokeWidth = 1.5, fill = "none", color = "#1a1a1a" }: {
  label?: string;
  roughness?: number;
  strokeWidth?: number;
  fill?: string;
  color?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const rc = rough.svg(svgRef.current);
    svgRef.current.innerHTML = "";
    const rect = rc.rectangle(2, 2, 126, 38, {
      stroke: color,
      roughness,
      strokeWidth,
      fill: fill !== "none" ? fill : undefined,
      fillStyle: "solid",
      seed: 42,
    });
    svgRef.current.appendChild(rect);
  }, [roughness, strokeWidth, fill, color]);

  return (
    <button className="relative px-6 py-2 text-sm font-semibold" style={{ color: fill !== "none" ? "white" : color }}>
      <svg ref={svgRef} className="absolute inset-0" width={130} height={42} />
      <span className="relative">{label}</span>
    </button>
  );
}

function PillButton({ label = "Subskrybuj", filled = false }: { label?: string; filled?: boolean }) {
  return (
    <button className={`px-4 py-1.5 text-sm font-semibold rounded-full border-2 border-neutral-900 transition-all ${
      filled ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 hover:bg-neutral-900 hover:text-white"
    }`}>
      {label}
    </button>
  );
}

function HighlightButton({ label = "Kliknij" }: { label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, { type: "box", color: "#2563eb", strokeWidth: 2, animate: false });
    ann.show();
    return () => ann.remove();
  }, [label]);
  return (
    <button className="px-4 py-2 text-sm font-semibold text-neutral-900">
      <span ref={ref}>{label}</span>
    </button>
  );
}

function TrapezoidButton({ label = "WEJŚCIE" }: { label?: string }) {
  return (
    <button className="relative px-8 py-2.5 text-sm font-bold uppercase tracking-wider">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 140 44" preserveAspectRatio="none">
        <path d="M 6 5 L 135 7 L 133 39 L 8 37 Z" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="relative">→ {label}</span>
    </button>
  );
}

function BlueCTAButton({ label = "Wesprzyj POLUTEK.PL" }: { label?: string }) {
  return (
    <button className="relative px-8 py-3 text-sm font-bold uppercase tracking-wider text-white">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 46" preserveAspectRatio="none">
        <path d="M 5 5 L 216 7 L 214 40 L 7 38 Z" fill="#2563EB" stroke="#1d4ed8" strokeWidth="1.5" />
      </svg>
      <span className="relative">{label}</span>
    </button>
  );
}

export default function ButtonsSection() {
  const [roughness, setRoughness] = useState(1.2);
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [color, setColor] = useState("#1a1a1a");
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fillColor, setFillColor] = useState("#2563EB");

  return (
    <div>
      <SectionHeader
        title="Przyciski"
        subtitle="Przyciski w stylu odręcznym — od RoughJS przez custom SVG po Rough Notation. Każda technika daje inny efekt i stopień kontroli."
        icon="🔲"
      />

      <div className="space-y-4">
        <DemoBox
          id="P-MAIN"
          title="RoughJS button — interaktywny"
          status="kandydat"
          tech="roughjs"
          description="Ramka RoughJS jako border przycisku. Seed=42 = deterministyczny (zawsze tak samo wygląda)."
          controls={
            <div className="space-y-3">
              <Slider label="roughness" value={roughness} min={0} max={4} step={0.1} onChange={setRoughness} />
              <Slider label="strokeWidth" value={strokeWidth} min={0.5} max={5} step={0.5} onChange={setStrokeWidth} />
              <ColorPicker label="kolor" value={color} onChange={setColor} />
              <Toggle label="wypełnienie" value={fillEnabled} onChange={setFillEnabled} />
              {fillEnabled && <ColorPicker label="fill" value={fillColor} onChange={setFillColor} />}
            </div>
          }
        >
          <RoughButton roughness={roughness} strokeWidth={strokeWidth} fill={fillEnabled ? fillColor : "none"} color={color} />
        </DemoBox>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <DemoBox id="P1" title="RoughJS — outline" status="kandydat" tech="roughjs" description="Ciemna ramka, białe tło">
            <RoughButton roughness={1.2} strokeWidth={1.5} />
          </DemoBox>
          <DemoBox id="P2" title="RoughJS — filled blue" status="kandydat" tech="roughjs" description="Niebieski CTA">
            <RoughButton roughness={1} strokeWidth={1} fill="#2563EB" color="#2563EB" label="Wesprzyj" />
          </DemoBox>
          <DemoBox id="P3" title="Trapezoid SVG" status="kandydat" tech="custom SVG" description="Lekko trapezowy — charakterystyczny kształt">
            <TrapezoidButton />
          </DemoBox>
          <DemoBox id="P4" title="Blue CTA — filled" status="kandydat" tech="custom SVG" description="Niebieski CTA z custom SVG fill">
            <BlueCTAButton />
          </DemoBox>
          <DemoBox id="P5" title="Rough Notation box" status="inspiracja" tech="rough-notation" description="Ramka adnotacyjna wokół tekstu">
            <HighlightButton label="Wesprzyj" />
          </DemoBox>
          <DemoBox id="P6" title="Pill — obecny styl" status="kandydat" tech="CSS/SVG" description="Aktualny styl Polutek — dla porównania">
            <div className="flex gap-2">
              <PillButton label="Subskrybuj" />
              <PillButton label="Wejście" filled />
            </div>
          </DemoBox>
        </div>

        <DemoBox
          id="P-STATES"
          title="Stany interakcji"
          status="kandydat"
          tech="roughjs"
          description="Jak przyciski wyglądają w różnych stanach: domyślny, hover, aktywny, disabled"
          fullWidth
        >
          <div className="flex flex-wrap gap-6 items-center justify-center py-2">
            <div className="flex flex-col items-center gap-1">
              <RoughButton label="Domyślny" roughness={1.2} />
              <span className="text-[10px] text-neutral-400">default</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <RoughButton label="Hover" roughness={2} color="#2563eb" />
              <span className="text-[10px] text-neutral-400">hover (rougher)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="opacity-40 cursor-not-allowed">
                <RoughButton label="Disabled" roughness={0.5} color="#999" />
              </div>
              <span className="text-[10px] text-neutral-400">disabled</span>
            </div>
          </div>
        </DemoBox>

        <DemoBox
          id="P-BADGES"
          title="Badges / Chipy — PUBLICZNE, ODBLOKOWANE"
          status="kandydat"
          tech="CSS/SVG"
          description="Etykiety statusu w stylu odręcznym vs obecny styl Polutek"
          fullWidth
        >
          <div className="flex flex-wrap gap-6 items-center justify-center py-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-neutral-400">obecny styl</span>
              <div className="flex gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-1 bg-black text-white rounded-md tracking-widest">Publiczne</span>
                <span className="text-[10px] font-black uppercase px-2 py-1 bg-blue-600 text-white rounded-md tracking-widest">Odblokowane</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-neutral-400">rough SVG</span>
              <div className="flex gap-3">
                {["PUBLICZNE", "ODBLOKOWANE"].map((t, i) => (
                  <span key={t} className="relative text-[10px] font-bold uppercase px-3 py-1.5 tracking-wider">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 90 28" preserveAspectRatio="none">
                      <path
                        d="M 3 4 L 87 5 L 86 24 L 4 23 Z"
                        fill={i === 0 ? "#1a1a1a" : "#2563EB"}
                        stroke={i === 0 ? "#000" : "#1d4ed8"}
                        strokeWidth="1"
                      />
                    </svg>
                    <span className="relative text-white">{t}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </DemoBox>
      </div>
    </div>
  );
}
