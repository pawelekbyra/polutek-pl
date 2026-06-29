"use client";

import React, { useEffect, useRef, useState } from "react";
import { annotate, annotationGroup } from "rough-notation";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { Toggle, ColorPicker, Slider, PillSelect } from "../components/Controls";

type AnnotationType = "underline" | "box" | "circle" | "highlight" | "strike-through" | "crossed-off" | "bracket";

interface AnnotatedProps {
  type: AnnotationType;
  color?: string;
  animate?: boolean;
  strokeWidth?: number;
  padding?: number;
  multiline?: boolean;
  brackets?: ("left" | "right" | "top" | "bottom")[];
  children: React.ReactNode;
  key?: number;
}

function Annotated({ type, color = "#1a1a1a", animate = false, strokeWidth = 1.5, padding = 3, multiline = false, brackets, children }: AnnotatedProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ann = annotate(ref.current, {
      type,
      color,
      animate,
      strokeWidth,
      padding,
      multiline,
      brackets: brackets as any,
    });
    ann.show();
    return () => ann.remove();
  }, [type, color, animate, strokeWidth, padding, multiline, brackets]);

  return <span ref={ref}>{children}</span>;
}

const ANNOTATION_TYPES: { type: AnnotationType; label: string; desc: string; useCase: string; defaultColor: string }[] = [
  { type: "underline", label: "underline", desc: "Odręczne podkreślenie — imituje pióro", useCase: "linki, akcenty, definicje", defaultColor: "#1a1a1a" },
  { type: "box", label: "box", desc: "Ramka wokół słowa lub frazy", useCase: "ważne pojęcia, tagi, kody", defaultColor: "#1a1a1a" },
  { type: "circle", label: "circle", desc: "Zakreślenie kółkiem — jak na tablicy", useCase: "liczby, daty, punkty do zapamiętania", defaultColor: "#ef4444" },
  { type: "highlight", label: "highlight", desc: "Marker zakreślacza — klasyczne żółte zakreślenie", useCase: "kluczowe frazy w tekście, CTA", defaultColor: "#fde047" },
  { type: "strike-through", label: "strike-through", desc: "Skreślenie tekstu — jak korekta w notatce", useCase: "stare ceny, błędy, zmiany", defaultColor: "#ef4444" },
  { type: "crossed-off", label: "crossed-off", desc: "Przekreślenie X — silniejsza negacja", useCase: "odrzucone opcje, anulowane elementy", defaultColor: "#ef4444" },
  { type: "bracket", label: "bracket [left]", desc: "Pionowy nawias z lewej strony tekstu", useCase: "cytaty, notatki boczne", defaultColor: "#1a1a1a" },
];

export default function NotationSection() {
  const [color, setColor] = useState("#1a1a1a");
  const [animate, setAnimate] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [padding, setPadding] = useState(3);
  const [activeType, setActiveType] = useState<AnnotationType>("highlight");
  const [rerenderKey, setRerenderKey] = useState(0);
  const [multilineText, setMultilineText] = useState(false);

  const rerender = () => setRerenderKey(k => k + 1);

  return (
    <div>
      <SectionHeader
        title="Rough Notation"
        subtitle="Biblioteka do dodawania odręcznych adnotacji na istniejącym tekście. Animowane lub statyczne, 7 typów, pełna kontrola koloru i grubości."
        icon="🖊️"
      />

      <div className="space-y-4">
        <DemoBox
          id="N-MAIN"
          title="Interaktywny konfiguratorowy"
          status="kandydat"
          tech="rough-notation"
          description="Wybierz typ adnotacji i dostosuj parametry. Każda zmiana aplikuje efekt na żywo."
          useCase="eksperymentuj przed wdrożeniem"
          code={`annotate(el, {\n  type: '${activeType}',\n  color: '${color}',\n  animate: ${animate},\n  strokeWidth: ${strokeWidth},\n  padding: ${padding},\n})`}
          controls={
            <div className="space-y-3">
              <PillSelect
                label="typ"
                value={activeType}
                options={ANNOTATION_TYPES.map(t => ({ value: t.type, label: t.label.replace("bracket [left]", "bracket") }))}
                onChange={(v) => { setActiveType(v as AnnotationType); rerender(); }}
              />
              <ColorPicker label="kolor" value={color} onChange={(v) => { setColor(v); rerender(); }} />
              <Slider label="strokeWidth" value={strokeWidth} min={0.5} max={5} step={0.5} onChange={(v) => { setStrokeWidth(v); rerender(); }} />
              <Slider label="padding" value={padding} min={0} max={15} step={1} onChange={(v) => { setPadding(v); rerender(); }} />
              <Toggle label="animacja" value={animate} onChange={(v) => { setAnimate(v); rerender(); }} />
              <button
                onClick={rerender}
                className="w-full text-[11px] border border-neutral-200 rounded py-1 hover:bg-neutral-50"
              >
                ↺ odśwież
              </button>
            </div>
          }
        >
          <div className="text-xl font-medium text-neutral-800 leading-loose">
            <Annotated
              key={rerenderKey}
              type={activeType}
              color={color}
              animate={animate}
              strokeWidth={strokeWidth}
              padding={padding}
              brackets={activeType === "bracket" ? ["left"] : undefined}
            >
              Cześć Słońce
            </Annotated>
            {" "}— film o rynkach
          </div>
        </DemoBox>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ANNOTATION_TYPES.map(({ type, label, desc, useCase, defaultColor }) => (
            <DemoBox
              key={type}
              id={`N-${type.slice(0, 2).toUpperCase()}`}
              title={label}
              status="kandydat"
              tech="rough-notation"
              description={desc}
              useCase={useCase}
            >
              <div className="text-lg font-medium text-neutral-800 py-2">
                <Annotated
                  type={type}
                  color={defaultColor}
                  animate={false}
                  brackets={type === "bracket" ? ["left"] : undefined}
                >
                  Polutek.pl
                </Annotated>
              </div>
            </DemoBox>
          ))}

          <DemoBox
            id="N-HL-MULTI"
            title="highlight multiline"
            status="kandydat"
            tech="rough-notation"
            description="Marker przechodzi przez wiele linii tekstu"
            useCase="długie cytaty, bloki wprowadzające"
          >
            <div className="text-base text-neutral-800 leading-relaxed w-48">
              <Annotated type="highlight" color="#fde047" multiline={true} animate={false}>
                Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze.
              </Annotated>
            </div>
          </DemoBox>

          <DemoBox
            id="N-COMBO"
            title="kombinacja adnotacji"
            status="inspiracja"
            tech="rough-notation"
            description="Kilka różnych efektów na tym samym zdaniu"
            useCase="landing page, hero section"
          >
            <div className="text-base font-medium text-neutral-800 leading-loose flex flex-wrap gap-1 items-baseline">
              <Annotated type="underline" color="#2563eb">Wesprzyj</Annotated>
              {" "}
              <Annotated type="highlight" color="#fde047">POLUTEK.PL</Annotated>
              {" "}i{" "}
              <Annotated type="circle" color="#ef4444">odblokuj</Annotated>
              {" "}wszystko
            </div>
          </DemoBox>

          <DemoBox
            id="N-ANIM"
            title="animowane rysowanie"
            status="inspiracja"
            tech="rough-notation"
            description="Efekt rysowania na żywo — świetny na wejście sekcji"
            useCase="scroll-trigger, landing page hero"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="text-xl font-bold text-neutral-800">
                <Annotated type="box" color="#2563eb" animate={true} strokeWidth={2}>
                  Premiera za 105 dni
                </Annotated>
              </div>
              <p className="text-xs text-neutral-400">efekt rysowania aktywny przy załadowaniu</p>
            </div>
          </DemoBox>

          <DemoBox
            id="N-BRACKET-BOTH"
            title="bracket [left + right]"
            status="inspiracja"
            tech="rough-notation"
            description="Nawiasy z obu stron — blok cytatu"
            useCase="cytaty, komentarze"
          >
            <div className="text-base text-neutral-700 py-2 px-4">
              <Annotated type="bracket" brackets={["left", "right"]} color="#6b7280" strokeWidth={2}>
                Wesprzyj platformę
              </Annotated>
            </div>
          </DemoBox>

          <DemoBox
            id="N-COLORS"
            title="paleta kolorów highlight"
            status="kandydat"
            tech="rough-notation"
            description="Ten sam efekt w różnych kolorach — wybór dla brandingu"
            useCase="zakreślenia tematyczne"
          >
            <div className="space-y-2">
              {[
                { color: "#fde047", label: "żółty (klasyczny)" },
                { color: "#86efac", label: "zielony" },
                { color: "#93c5fd", label: "niebieski" },
                { color: "#f9a8d4", label: "różowy" },
              ].map(({ color: c, label }) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-neutral-400 w-28">{label}</span>
                  <span className="text-base text-neutral-800">
                    <Annotated type="highlight" color={c} animate={false}>Polutek</Annotated>
                  </span>
                </div>
              ))}
            </div>
          </DemoBox>
        </div>
      </div>
    </div>
  );
}
