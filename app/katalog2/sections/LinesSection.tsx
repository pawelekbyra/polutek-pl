"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { Slider, PillSelect, SeedControl, Toggle, ColorPicker } from "../components/Controls";

function getSvgPath(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    return acc;
  }, ["M", ...stroke[0], "Q"] as (string | number)[]);
  d.push("Z");
  return d.join(" ");
}

interface RoughLineProps {
  width?: number;
  height?: number;
  roughness?: number;
  strokeWidth?: number;
  bowing?: number;
  seed?: number;
  color?: string;
  dashed?: boolean;
}

function RoughLine({ width = 300, height = 40, roughness = 1, strokeWidth = 1.5, bowing = 1, seed = 42, color = "#1a1a1a", dashed = false }: RoughLineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const rc = rough.svg(svgRef.current);
    svgRef.current.innerHTML = "";
    const line = rc.line(10, height / 2, width - 10, height / 2, {
      stroke: color,
      roughness,
      strokeWidth,
      bowing,
      seed,
      strokeLineDash: dashed ? [8, 6] : undefined,
    });
    svgRef.current.appendChild(line);
  }, [width, height, roughness, strokeWidth, bowing, seed, color, dashed]);

  return <svg ref={svgRef} width={width} height={height} />;
}

interface FreehandLineProps {
  width?: number;
  height?: number;
  size?: number;
  thinning?: number;
  smoothing?: number;
  color?: string;
}

function FreehandLine({ width = 300, height = 40, size = 4, thinning = 0.5, smoothing = 0.5, color = "#1a1a1a" }: FreehandLineProps) {
  const points: [number, number, number][] = [
    [10, height / 2, 0.2],
    [width * 0.25, height / 2 + 3, 0.6],
    [width * 0.5, height / 2 - 2, 0.9],
    [width * 0.75, height / 2 + 4, 0.7],
    [width - 10, height / 2, 0.3],
  ];
  const stroke = getStroke(points, { size, thinning, smoothing });
  const pathData = getSvgPath(stroke);

  return (
    <svg width={width} height={height}>
      <path d={pathData} fill={color} />
    </svg>
  );
}

interface CustomSvgLineProps {
  width?: number;
  height?: number;
  color?: string;
  jitter?: number;
  double?: boolean;
}

function CustomSvgLine({ width = 300, height = 40, color = "#1a1a1a", jitter = 2, double: isDouble = false }: CustomSvgLineProps) {
  const mid = height / 2;
  const path = `M 10 ${mid} Q ${width * 0.25} ${mid + jitter} ${width * 0.5} ${mid - jitter} Q ${width * 0.75} ${mid + jitter * 0.5} ${width - 10} ${mid}`;
  const path2 = `M 10 ${mid + 3} Q ${width * 0.25} ${mid + jitter + 3} ${width * 0.5} ${mid - jitter + 3} Q ${width * 0.75} ${mid + jitter * 0.5 + 3} ${width - 10} ${mid + 3}`;

  return (
    <svg width={width} height={height} fill="none">
      <path d={path} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {isDouble && <path d={path2} stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />}
    </svg>
  );
}

export default function LinesSection() {
  const [roughness, setRoughness] = useState(1.2);
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [bowing, setBowing] = useState(1);
  const [seed, setSeed] = useState(42);
  const [color, setColor] = useState("#1a1a1a");
  const [dashed, setDashed] = useState(false);
  const [fhSize, setFhSize] = useState(4);
  const [fhThinning, setFhThinning] = useState(0.5);
  const [jitter, setJitter] = useState(2);
  const [double_, setDouble] = useState(false);

  return (
    <div>
      <SectionHeader
        title="Linie & Kreski"
        subtitle="Trzy techniki rysowania linii: RoughJS (SVG generowany), Perfect Freehand (symulacja nacisku), Custom SVG path (ręcznie pisany). Każda daje inne poczucie."
        icon="📏"
      />

      <div className="space-y-4">
        <DemoBox
          id="L-R"
          title="RoughJS — interaktywna linia"
          status="kandydat"
          tech="roughjs"
          description="Silnik RoughJS generuje linię z losowością kontrolowaną przez seed. Zmień parametry i obserwuj efekt na żywo."
          useCase="separator, obrys sekcji, podkreślenie"
          code={`import rough from 'roughjs';\n\nconst rc = rough.svg(svgEl);\nrc.line(10, 20, 290, 20, {\n  roughness: ${roughness},\n  strokeWidth: ${strokeWidth},\n  bowing: ${bowing},\n  seed: ${seed},\n  stroke: '${color}',\n});`}
          controls={
            <div className="space-y-3">
              <Slider label="roughness" value={roughness} min={0} max={5} step={0.1} onChange={setRoughness} />
              <Slider label="strokeWidth" value={strokeWidth} min={0.5} max={8} step={0.5} onChange={setStrokeWidth} />
              <Slider label="bowing" value={bowing} min={0} max={10} step={0.5} onChange={setBowing} />
              <SeedControl value={seed} onChange={setSeed} />
              <ColorPicker label="kolor" value={color} onChange={setColor} />
              <Toggle label="przerywana" value={dashed} onChange={setDashed} />
            </div>
          }
        >
          <RoughLine roughness={roughness} strokeWidth={strokeWidth} bowing={bowing} seed={seed} color={color} dashed={dashed} />
        </DemoBox>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DemoBox id="L1" title="roughness: 0.5" status="kandydat" tech="roughjs" description="Prawie prosta — minimalny efekt">
            <RoughLine roughness={0.5} strokeWidth={1} seed={42} />
          </DemoBox>
          <DemoBox id="L2" title="roughness: 2" status="kandydat" tech="roughjs" description="Wyraźna odręczność">
            <RoughLine roughness={2} strokeWidth={1.5} seed={42} />
          </DemoBox>
          <DemoBox id="L3" title="roughness: 4.5" status="inspiracja" tech="roughjs" description="Ekspresyjna, chaotyczna">
            <RoughLine roughness={4.5} strokeWidth={2} seed={42} />
          </DemoBox>
          <DemoBox id="L4" title="bowing: 6" status="eksperyment" tech="roughjs" description="Wygięta w łuk">
            <RoughLine roughness={0.8} bowing={6} strokeWidth={1.5} seed={42} />
          </DemoBox>
          <DemoBox id="L5" title="dashed" status="kandydat" tech="roughjs" description="Przerywana linia">
            <RoughLine roughness={1} strokeWidth={1.5} seed={42} dashed={true} />
          </DemoBox>
          <DemoBox id="L6" title="gruba (strokeWidth: 5)" status="inspiracja" tech="roughjs" description="Mocny akcent">
            <RoughLine roughness={1.5} strokeWidth={5} seed={42} color="#2563EB" />
          </DemoBox>
        </div>

        <DemoBox
          id="L-PF"
          title="Perfect Freehand — symulacja pióra"
          status="kandydat"
          tech="perfect-freehand"
          description="Symuluje naturalny nacisk pióra — zwężające się końce, organiczny kształt wypełniony kolorem (nie stroke)."
          useCase="doodle, podpis, dekoracja"
          code={`import { getStroke } from 'perfect-freehand';\n\nconst stroke = getStroke(points, {\n  size: ${fhSize},\n  thinning: ${fhThinning},\n  smoothing: 0.5,\n});\n// stroke -> SVG path fill`}
          controls={
            <div className="space-y-3">
              <Slider label="size" value={fhSize} min={1} max={30} step={1} onChange={setFhSize} />
              <Slider label="thinning" value={fhThinning} min={-1} max={1} step={0.1} onChange={setFhThinning} />
            </div>
          }
        >
          <FreehandLine size={fhSize} thinning={fhThinning} color={color} />
        </DemoBox>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DemoBox id="PF1" title="size: 2 (cieńkopis)" status="kandydat" tech="perfect-freehand">
            <FreehandLine size={2} thinning={0.5} />
          </DemoBox>
          <DemoBox id="PF2" title="size: 8 (marker)" status="inspiracja" tech="perfect-freehand">
            <FreehandLine size={8} thinning={0.7} />
          </DemoBox>
          <DemoBox id="PF3" title="size: 25 (marker szeroki)" status="eksperyment" tech="perfect-freehand">
            <FreehandLine size={25} thinning={0.3} color="#fde047" />
          </DemoBox>
        </div>

        <DemoBox
          id="L-CSV"
          title="Custom SVG path — precyzyjna kontrola"
          status="kandydat"
          tech="custom SVG"
          description="Ręcznie pisany path SVG z kontrolowaną niedoskonałością. Zero zależności, statyczny, deterministyczny."
          useCase="separator, branding, separator z tekstem"
          controls={
            <div className="space-y-3">
              <Slider label="jitter" value={jitter} min={0} max={10} step={0.5} onChange={setJitter} />
              <Toggle label="podwójna" value={double_} onChange={setDouble} />
            </div>
          }
        >
          <CustomSvgLine jitter={jitter} double={double_} color={color} />
        </DemoBox>

        <DemoBox
          id="L-CMP"
          title="Porównanie trzech technik — ta sama długość"
          status="kandydat"
          tech="CSS/SVG"
          description="RoughJS vs Perfect Freehand vs Custom SVG side-by-side. Każda technika daje inne poczucie."
        >
          <div className="space-y-4 w-full">
            {[
              { label: "RoughJS", el: <RoughLine roughness={1.5} strokeWidth={1.5} seed={42} /> },
              { label: "Perfect Freehand", el: <FreehandLine size={4} thinning={0.5} /> },
              { label: "Custom SVG", el: <CustomSvgLine jitter={3} /> },
            ].map(({ label, el }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-neutral-400 w-28 shrink-0">{label}</span>
                {el}
              </div>
            ))}
          </div>
        </DemoBox>
      </div>
    </div>
  );
}
