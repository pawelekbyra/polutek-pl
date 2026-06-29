"use client";

import React, { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import { annotate } from "rough-notation";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { Slider, PillSelect, SeedControl, ColorPicker, Toggle, TextInput } from "../components/Controls";

type Tech = "roughjs" | "freehand" | "notation" | "csvg";
type Element = "line" | "rect" | "button" | "card";

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

interface PlaygroundParams {
  roughness: number;
  strokeWidth: number;
  bowing: number;
  seed: number;
  color: string;
  fillEnabled: boolean;
  fillColor: string;
  fillStyle: string;
  animate: boolean;
  notationType: string;
  size: number;
  thinning: number;
  text: string;
}

export default function PlaygroundSection() {
  const [tech, setTech] = useState<Tech>("roughjs");
  const [element, setElement] = useState<Element>("rect");
  const [params, setParams] = useState<PlaygroundParams>({
    roughness: 1.5,
    strokeWidth: 1.5,
    bowing: 1,
    seed: 42,
    color: "#1a1a1a",
    fillEnabled: false,
    fillColor: "#bfdbfe",
    fillStyle: "hachure",
    animate: false,
    notationType: "highlight",
    size: 6,
    thinning: 0.5,
    text: "Polutek.pl",
  });

  const setParam = <K extends keyof PlaygroundParams>(key: K, value: PlaygroundParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || tech === "notation" || tech === "freehand") return;

    const rc = rough.svg(el);
    el.innerHTML = "";
    const w = 320, h = element === "line" ? 40 : 160;

    const opts = {
      roughness: params.roughness,
      strokeWidth: params.strokeWidth,
      bowing: params.bowing,
      seed: params.seed,
      stroke: params.color,
      fill: params.fillEnabled ? params.fillColor : undefined,
      fillStyle: params.fillEnabled ? (params.fillStyle as any) : undefined,
    };

    if (element === "line") {
      el.appendChild(rc.line(10, h / 2, w - 10, h / 2, opts));
    } else if (element === "rect" || element === "card" || element === "button") {
      el.appendChild(rc.rectangle(6, 6, w - 12, h - 12, opts));
    }
  }, [tech, element, params, renderKey]);

  useEffect(() => {
    if (tech !== "notation" || !textRef.current) return;
    const ann = annotate(textRef.current, {
      type: params.notationType as any,
      color: params.color,
      animate: params.animate,
      strokeWidth: params.strokeWidth,
    });
    ann.show();
    return () => ann.remove();
  }, [tech, params.notationType, params.color, params.animate, params.strokeWidth, params.text, renderKey]);

  const freehandPath = React.useMemo(() => {
    if (tech !== "freehand") return "";
    const points: [number, number, number][] = [
      [10, 20, 0.2], [80, 18, 0.6], [160, 22, 0.9], [240, 19, 0.7], [310, 20, 0.3],
    ];
    const stroke = getStroke(points, { size: params.size, thinning: params.thinning, smoothing: 0.5 });
    return getSvgPath(stroke);
  }, [tech, params.size, params.thinning]);

  const codeSnippet = {
    roughjs: `rc.${element === "line" ? "line(10, 20, 310, 20" : "rectangle(6, 6, 308, 148"}, {\n  roughness: ${params.roughness},\n  strokeWidth: ${params.strokeWidth},\n  bowing: ${params.bowing},\n  seed: ${params.seed},\n  stroke: '${params.color}',${params.fillEnabled ? `\n  fill: '${params.fillColor}',\n  fillStyle: '${params.fillStyle}',` : ""}\n})`,
    freehand: `getStroke(points, {\n  size: ${params.size},\n  thinning: ${params.thinning},\n  smoothing: 0.5,\n})`,
    notation: `annotate(el, {\n  type: '${params.notationType}',\n  color: '${params.color}',\n  animate: ${params.animate},\n  strokeWidth: ${params.strokeWidth},\n})`,
    csvg: `<path d="M 3 4 L 317 5 L 316 155 L 4 154 Z"\n  fill="none" stroke="${params.color}"\n  strokeWidth="${params.strokeWidth}" />`,
  }[tech];

  return (
    <div>
      <SectionHeader
        title="Playground"
        subtitle="Swobodny edytor — wybierz technikę i element, ustaw wszystkie parametry, skopiuj wygenerowany kod."
        icon="🎮"
      />

      <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-6 py-4 bg-neutral-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PillSelect
              label="technika"
              value={tech}
              options={[
                { value: "roughjs", label: "RoughJS" },
                { value: "freehand", label: "Perfect Freehand" },
                { value: "notation", label: "Rough Notation" },
                { value: "csvg", label: "Custom SVG" },
              ]}
              onChange={(v) => setTech(v as Tech)}
            />
            {tech !== "notation" && tech !== "freehand" && (
              <PillSelect
                label="element"
                value={element}
                options={[
                  { value: "line", label: "linia" },
                  { value: "rect", label: "prostokąt" },
                  { value: "button", label: "przycisk" },
                  { value: "card", label: "karta" },
                ]}
                onChange={(v) => setElement(v as Element)}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row">
          <div className="flex-1 flex items-center justify-center p-8 min-h-[200px]"
            style={{ background: "repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(0,0,0,.02) 10px,rgba(0,0,0,.02) 11px)" }}>
            {tech === "notation" ? (
              <div className="text-2xl font-medium text-neutral-800">
                <span ref={textRef} key={renderKey}>{params.text}</span>
              </div>
            ) : tech === "freehand" ? (
              <svg width={320} height={40}>
                <path d={freehandPath} fill={params.color} />
              </svg>
            ) : tech === "csvg" ? (
              <div className={`relative ${element === "line" ? "w-80 h-10" : "w-80 h-40"}`}>
                <svg className="absolute inset-0 w-full h-full" viewBox={element === "line" ? "0 0 320 40" : "0 0 320 160"} preserveAspectRatio="none">
                  {element === "line" ? (
                    <path d={`M 3 20 Q 80 18 160 21 Q 240 19 317 20`} stroke={params.color} strokeWidth={params.strokeWidth} fill="none" strokeLinecap="round" />
                  ) : (
                    <path d="M 4 5 L 316 7 L 314 154 L 6 152 Z"
                      fill={params.fillEnabled ? params.fillColor : "none"}
                      stroke={params.color}
                      strokeWidth={params.strokeWidth}
                    />
                  )}
                </svg>
                {(element === "card" || element === "button") && (
                  <div className="absolute inset-4 flex items-center justify-center text-sm text-neutral-500">
                    {params.text}
                  </div>
                )}
              </div>
            ) : (
              <svg
                ref={svgRef}
                width={320}
                height={element === "line" ? 40 : 160}
              />
            )}
          </div>

          <div className="w-full md:w-60 border-t md:border-t-0 md:border-l border-neutral-100 bg-neutral-50/50 p-4 space-y-3">
            {tech === "notation" ? (
              <>
                <TextInput label="tekst" value={params.text} onChange={(v) => setParam("text", v)} />
                <PillSelect
                  label="typ"
                  value={params.notationType}
                  options={["underline","box","circle","highlight","strike-through","crossed-off"].map(t => ({ value: t, label: t }))}
                  onChange={(v) => setParam("notationType", v)}
                />
                <ColorPicker label="kolor" value={params.color} onChange={(v) => { setParam("color", v); setRenderKey(k => k+1); }} />
                <Slider label="strokeWidth" value={params.strokeWidth} min={0.5} max={5} step={0.5} onChange={(v) => { setParam("strokeWidth", v); setRenderKey(k => k+1); }} />
                <Toggle label="animacja" value={params.animate} onChange={(v) => { setParam("animate", v); setRenderKey(k => k+1); }} />
                <button onClick={() => setRenderKey(k => k+1)} className="w-full text-xs border border-neutral-200 rounded py-1 hover:bg-white">↺ odśwież</button>
              </>
            ) : tech === "freehand" ? (
              <>
                <Slider label="size" value={params.size} min={1} max={30} step={1} onChange={(v) => setParam("size", v)} />
                <Slider label="thinning" value={params.thinning} min={-1} max={1} step={0.1} onChange={(v) => setParam("thinning", v)} />
                <ColorPicker label="kolor" value={params.color} onChange={(v) => setParam("color", v)} />
              </>
            ) : (
              <>
                <Slider label="roughness" value={params.roughness} min={0} max={5} step={0.1} onChange={(v) => setParam("roughness", v)} />
                <Slider label="strokeWidth" value={params.strokeWidth} min={0.5} max={8} step={0.5} onChange={(v) => setParam("strokeWidth", v)} />
                {tech === "roughjs" && (
                  <>
                    <Slider label="bowing" value={params.bowing} min={0} max={10} step={0.5} onChange={(v) => setParam("bowing", v)} />
                    <SeedControl value={params.seed} onChange={(v) => setParam("seed", v)} />
                  </>
                )}
                <ColorPicker label="stroke" value={params.color} onChange={(v) => setParam("color", v)} />
                {element !== "line" && (
                  <>
                    <Toggle label="wypełnienie" value={params.fillEnabled} onChange={(v) => setParam("fillEnabled", v)} />
                    {params.fillEnabled && (
                      <>
                        <ColorPicker label="fill" value={params.fillColor} onChange={(v) => setParam("fillColor", v)} />
                        {tech === "roughjs" && (
                          <PillSelect
                            label="fillStyle"
                            value={params.fillStyle}
                            options={["hachure","cross-hatch","dots","solid","dashed"].map(s => ({ value: s, label: s }))}
                            onChange={(v) => setParam("fillStyle", v)}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="border-t border-neutral-100">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-950">
            <span className="text-[10px] font-mono text-neutral-400">wygenerowany kod</span>
            <button
              onClick={() => navigator.clipboard?.writeText(codeSnippet)}
              className="text-[10px] font-mono text-neutral-400 hover:text-white transition-colors"
            >
              kopiuj
            </button>
          </div>
          <pre className="text-[11px] font-mono text-green-400 bg-neutral-950 px-4 pb-4 overflow-x-auto leading-relaxed">
            {codeSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
