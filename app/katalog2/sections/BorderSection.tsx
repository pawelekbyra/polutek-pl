"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { Slider, PillSelect, SeedControl, ColorPicker, Toggle } from "../components/Controls";

interface RoughRectProps {
  width?: number;
  height?: number;
  roughness?: number;
  strokeWidth?: number;
  bowing?: number;
  seed?: number;
  stroke?: string;
  fill?: string;
  fillStyle?: string;
  fillWeight?: number;
  hachureAngle?: number;
}

function RoughRect({
  width = 200,
  height = 120,
  roughness = 1.2,
  strokeWidth = 1.5,
  bowing = 1,
  seed = 42,
  stroke = "#1a1a1a",
  fill = "none",
  fillStyle = "hachure",
  fillWeight = 2,
  hachureAngle = -41,
}: RoughRectProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const rc = rough.svg(svgRef.current);
    svgRef.current.innerHTML = "";
    const rect = rc.rectangle(6, 6, width - 12, height - 12, {
      stroke,
      roughness,
      strokeWidth,
      bowing,
      seed,
      fill: fill !== "none" ? fill : undefined,
      fillStyle: fill !== "none" ? (fillStyle as any) : undefined,
      fillWeight: fill !== "none" ? fillWeight : undefined,
      hachureAngle: fill !== "none" ? hachureAngle : undefined,
    });
    svgRef.current.appendChild(rect);
  }, [width, height, roughness, strokeWidth, bowing, seed, stroke, fill, fillStyle, fillWeight, hachureAngle]);

  return <svg ref={svgRef} width={width} height={height} />;
}

function CssInlineSvgBorder() {
  const svgBorder = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Cpath d='M6 8 L196 5 L198 115 L4 118 Z' fill='none' stroke='%231a1a1a' stroke-width='1.5'/%3E%3C/svg%3E")`;
  return (
    <div
      className="flex items-center justify-center text-sm text-neutral-600 font-medium"
      style={{
        width: 200,
        height: 120,
        backgroundImage: svgBorder,
        backgroundSize: "100% 100%",
      }}
    >
      CSS border-image
    </div>
  );
}

function OpenCornerBorder({ width = 200, height = 120, color = "#1a1a1a" }: { width?: number; height?: number; color?: string }) {
  return (
    <svg width={width} height={height} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <path d={`M 20 8 L ${width - 8} 8 L ${width - 8} ${height - 8} M ${width - 35} ${height - 8} L 8 ${height - 8} L 8 25`} />
    </svg>
  );
}

function DoubleBorder({ width = 200, height = 120, color = "#1a1a1a" }: { width?: number; height?: number; color?: string }) {
  return (
    <svg width={width} height={height} fill="none">
      <path d={`M 6 7 L ${width - 5} 5 L ${width - 7} ${height - 6} L 5 ${height - 7} Z`} stroke={color} strokeWidth="1.5" />
      <path d={`M 10 10 L ${width - 9} 9 L ${width - 11} ${height - 10} L 9 ${height - 11} Z`} stroke={color} strokeWidth="0.8" opacity="0.35" />
    </svg>
  );
}

export default function BorderSection() {
  const [roughness, setRoughness] = useState(1.2);
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [bowing, setBowing] = useState(1);
  const [seed, setSeed] = useState(42);
  const [color, setColor] = useState("#1a1a1a");
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fillColor, setFillColor] = useState("#bfdbfe");
  const [fillStyle, setFillStyle] = useState("hachure");
  const [fillWeight, setFillWeight] = useState(2);
  const [hachureAngle, setHachureAngle] = useState(-41);

  return (
    <div>
      <SectionHeader
        title="Ramki & Obrysy"
        subtitle="Ramki (prostokąty) rysowane różnymi technikami. Podstawowy element — obrysowuje karty, panele, przyciski."
        icon="⬜"
      />

      <div className="space-y-4">
        <DemoBox
          id="B-MAIN"
          title="RoughJS — interaktywna ramka"
          status="kandydat"
          tech="roughjs"
          description="Pełny zestaw parametrów. Zmieniaj i obserwuj jak parametry wpływają na charakter ramki."
          useCase="karta wideo, panel boczny, przycisk CTA"
          code={`rc.rectangle(6, 6, 188, 108, {\n  roughness: ${roughness},\n  strokeWidth: ${strokeWidth},\n  bowing: ${bowing},\n  seed: ${seed},\n  stroke: '${color}',\n  fill: ${fillEnabled ? `'${fillColor}'` : 'undefined'},\n  fillStyle: '${fillStyle}',\n});`}
          controls={
            <div className="space-y-3">
              <Slider label="roughness" value={roughness} min={0} max={5} step={0.1} onChange={setRoughness} />
              <Slider label="strokeWidth" value={strokeWidth} min={0.5} max={8} step={0.5} onChange={setStrokeWidth} />
              <Slider label="bowing" value={bowing} min={0} max={8} step={0.5} onChange={setBowing} />
              <SeedControl value={seed} onChange={setSeed} />
              <ColorPicker label="stroke" value={color} onChange={setColor} />
              <Toggle label="wypełnienie" value={fillEnabled} onChange={setFillEnabled} />
              {fillEnabled && (
                <>
                  <ColorPicker label="fill" value={fillColor} onChange={setFillColor} />
                  <PillSelect label="fillStyle" value={fillStyle} options={[
                    { value: "hachure", label: "kreskow." },
                    { value: "cross-hatch", label: "kratka" },
                    { value: "dots", label: "kropki" },
                    { value: "solid", label: "pełne" },
                    { value: "dashed", label: "kresk." },
                  ]} onChange={setFillStyle} />
                  <Slider label="fillWeight" value={fillWeight} min={0.5} max={8} step={0.5} onChange={setFillWeight} />
                  <Slider label="kąt kreskow." value={hachureAngle} min={-90} max={90} step={5} onChange={setHachureAngle} unit="°" />
                </>
              )}
            </div>
          }
        >
          <RoughRect
            roughness={roughness}
            strokeWidth={strokeWidth}
            bowing={bowing}
            seed={seed}
            stroke={color}
            fill={fillEnabled ? fillColor : "none"}
            fillStyle={fillStyle}
            fillWeight={fillWeight}
            hachureAngle={hachureAngle}
          />
        </DemoBox>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DemoBox id="B1" title="subtelna (0.8)" status="kandydat" tech="roughjs" description="Minimalna odręczność">
            <RoughRect roughness={0.8} strokeWidth={1} seed={42} />
          </DemoBox>
          <DemoBox id="B2" title="wyraźna (2.0)" status="kandydat" tech="roughjs" description="Klasyczny szkic">
            <RoughRect roughness={2} strokeWidth={1.5} seed={42} />
          </DemoBox>
          <DemoBox id="B3" title="ekspresyjna (4)" status="inspiracja" tech="roughjs" description="Mocna odręczność">
            <RoughRect roughness={4} strokeWidth={2} seed={42} />
          </DemoBox>
          <DemoBox id="B4" title="hachure fill" status="inspiracja" tech="roughjs" description="Kreskowane wypełnienie">
            <RoughRect roughness={1.5} fill="rgba(37,99,235,0.2)" fillStyle="hachure" fillWeight={2} seed={42} />
          </DemoBox>
          <DemoBox id="B5" title="cross-hatch" status="eksperyment" tech="roughjs" description="Kratka — podwójna kreska">
            <RoughRect roughness={1} fill="rgba(37,99,235,0.15)" fillStyle="cross-hatch" fillWeight={1.5} seed={42} />
          </DemoBox>
          <DemoBox id="B6" title="dots fill" status="eksperyment" tech="roughjs" description="Wypełnienie kropkami">
            <RoughRect roughness={1} fill="rgba(239,68,68,0.15)" fillStyle="dots" fillWeight={3} seed={42} />
          </DemoBox>
          <DemoBox id="B7" title="solid fill" status="inspiracja" tech="roughjs" description="Pełne wypełnienie z rough edges">
            <RoughRect roughness={1.5} fill="rgba(254,240,138,0.8)" fillStyle="solid" seed={42} />
          </DemoBox>
          <DemoBox id="B8" title="bowing: 4" status="eksperyment" tech="roughjs" description="Wypukłe boki">
            <RoughRect roughness={1} bowing={4} seed={42} />
          </DemoBox>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DemoBox
            id="B-CSS"
            title="CSS border-image + inline SVG"
            status="kandydat"
            tech="CSS/SVG"
            description="Bez JS! SVG osadzony w CSS. Statyczny, zero overhead. Ograniczona elastyczność."
            useCase="statyczne elementy, bez re-renderów"
            code={`style={{ backgroundImage: \`url("data:image/svg+xml,...)\`, backgroundSize: "100% 100%" }}`}
          >
            <CssInlineSvgBorder />
          </DemoBox>

          <DemoBox
            id="B-OC"
            title="Niedomknięty róg (custom SVG)"
            status="kandydat"
            tech="custom SVG"
            description="Przerwana linia w rogu — minimalistyczny, lekki efekt."
            useCase="lekkość, notatnikowy klimat"
          >
            <OpenCornerBorder />
          </DemoBox>

          <DemoBox
            id="B-DBL"
            title="Podwójna ramka (custom SVG)"
            status="eksperyment"
            tech="custom SVG"
            description="Dwie nakładające się ramki — efekt retro szkicu."
            useCase="wyróżniony panel, artykuł"
          >
            <DoubleBorder />
          </DemoBox>
        </div>

        <DemoBox
          id="B-CARD"
          title="Ramka na prawdziwej karcie video"
          status="kandydat"
          tech="roughjs"
          description="Jak wygląda ramka RoughJS na komponencie karty wideo — z miniaturką, tytułem i metadanymi."
          useCase="lista filmów, sidebar playlist"
        >
          <div className="relative w-64">
            <div className="relative aspect-video">
              <div className="absolute inset-0">
                <RoughRect width={256} height={144} roughness={1} strokeWidth={1} seed={42} />
              </div>
              <div className="absolute inset-[6px] bg-neutral-200 flex items-center justify-center text-neutral-400 text-xs">
                miniaturka 16:9
              </div>
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1 rounded">12:34</div>
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold text-neutral-900 leading-tight">Cześć Słońce</p>
              <p className="text-xs text-neutral-500 mt-1">Paweł Polutek · 7 wyświetleń · 3 dni temu</p>
            </div>
          </div>
        </DemoBox>
      </div>
    </div>
  );
}
