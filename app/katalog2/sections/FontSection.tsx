"use client";

import React, { useState } from "react";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { Slider, PillSelect, TextInput } from "../components/Controls";

const FONTS = [
  {
    id: "caveat",
    name: "Caveat",
    var: "--font-caveat",
    cssName: "var(--font-caveat)",
    desc: "Odręczna, ciepła, czytelna. Ma polskie znaki. Dobra do nagłówków i podpisów.",
    polish: "✓ polskie znaki",
    license: "OFL",
    feel: "ciepła / przyjazna",
    tag: "Google Fonts",
  },
  {
    id: "patrick",
    name: "Patrick Hand",
    var: "--font-patrick",
    cssName: "var(--font-patrick)",
    desc: "Czysta, techniczna odręczność. Świetna do ciągłego tekstu. Polskie znaki.",
    polish: "✓ polskie znaki",
    license: "OFL",
    feel: "techniczna / neutralna",
    tag: "Google Fonts",
  },
  {
    id: "schoolbell",
    name: "Schoolbell",
    var: "--font-schoolbell",
    cssName: "var(--font-schoolbell)",
    desc: "Dziecinny, tablicowy klimat. Ograniczone polskie znaki — ostrożnie.",
    polish: "⚠ ograniczone",
    license: "OFL",
    feel: "zabawna / dziecinna",
    tag: "Google Fonts",
  },
  {
    id: "dancing",
    name: "Dancing Script",
    var: "--font-dancing",
    cssName: "var(--font-dancing)",
    desc: "Kursywa, elegancka. Dobra do cytatów i podpisów. Ma polskie znaki.",
    polish: "✓ polskie znaki",
    license: "OFL",
    feel: "elegancka / kursywa",
    tag: "Google Fonts",
  },
  {
    id: "virgil",
    name: "Virgil",
    var: "--font-virgil",
    cssName: "'Virgil'",
    desc: "Oryginalny font Excalidraw (poprzednik Excalifontu). Minimalna, techniczna odręczność. Sprawdź polskie znaki przed użyciem.",
    polish: "⚠ sprawdź",
    license: "OFL",
    feel: "minimalna / techniczna",
    tag: "Excalidraw",
  },
  {
    id: "jakarta",
    name: "Plus Jakarta Sans",
    var: "--font-jakarta",
    cssName: "var(--font-jakarta)",
    desc: "Obecna czcionka Polutek (systemowa / UI). Dla porównania — nie jest odręczna.",
    polish: "✓ polskie znaki",
    license: "OFL",
    feel: "sans-serif (aktualny)",
    tag: "Aktualny",
  },
];

const SAMPLE_SENTENCES = [
  "Polutek.pl — platforma video",
  "Cześć Słońce — film o rynkach",
  "Ąą Ćć Ęę Łł Ńń Óó Śś Źź Żż",
  "Wesprzyj POLUTEK.PL już dziś!",
  "0 1 2 3 4 5 6 7 8 9 • 105 dni",
  "A B C D E F G H I J K L Ł M N O P Q R S T U V W X Y Z",
];

export default function FontSection() {
  const [fontSize, setFontSize] = useState(24);
  const [customText, setCustomText] = useState("Polutek.pl — platforma video");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [view, setView] = useState<"grid" | "compare">("grid");

  const displayText = customText || SAMPLE_SENTENCES[sampleIndex];

  return (
    <div>
      <SectionHeader
        title="Czcionki & Typografia"
        subtitle="Porównanie fontów odręcznych dostępnych dla projektu Polutek. Wszystkie mają licencję OFL (bezpłatna, komercyjna)."
        icon="✍️"
      />

      <div className="mb-6 p-4 border border-neutral-200 rounded-xl bg-white space-y-4">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Globalne ustawienia podglądu</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Slider label="Rozmiar fontu" value={fontSize} min={12} max={72} step={2} onChange={setFontSize} unit="px" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-neutral-500">przykładowy tekst</span>
            <select
              value={sampleIndex}
              onChange={(e) => { setSampleIndex(Number(e.target.value)); setCustomText(""); }}
              className="text-xs border border-neutral-200 rounded px-2 py-1"
            >
              {SAMPLE_SENTENCES.map((s, i) => (
                <option key={i} value={i}>{s.slice(0, 35)}…</option>
              ))}
            </select>
          </div>
          <TextInput label="własny tekst" value={customText} onChange={setCustomText} placeholder="wpisz cokolwiek..." />
        </div>
        <PillSelect
          label="widok"
          value={view}
          options={[{ value: "grid", label: "siatka" }, { value: "compare", label: "porównanie" }]}
          onChange={(v) => setView(v as "grid" | "compare")}
        />
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FONTS.map((font) => (
            <DemoBox
              key={font.id}
              title={font.name}
              status={font.tag === "Aktualny" ? "kandydat" : "inspiracja"}
              tech={font.tag}
              description={font.desc}
              useCase={`${font.feel} · ${font.polish}`}
            >
              <div className="w-full text-center py-2">
                <div
                  style={{
                    fontFamily: font.cssName,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.3,
                  }}
                  className="text-neutral-900 break-words"
                >
                  {displayText}
                </div>
                <div
                  style={{ fontFamily: font.cssName, fontSize: "14px" }}
                  className="text-neutral-400 mt-3"
                >
                  Ąą Ćć Ęę Łł Ńń Óó Śś Źź Żż · 0–9
                </div>
              </div>
            </DemoBox>
          ))}
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
          <div className="border-b border-neutral-100 px-4 py-3 bg-neutral-50">
            <span className="text-sm font-semibold text-neutral-700">Porównanie fontów — ten sam tekst</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {FONTS.map((font) => (
              <div key={font.id} className="flex items-center px-6 py-4 hover:bg-neutral-50 transition-colors">
                <div className="w-32 shrink-0">
                  <div className="text-[11px] font-semibold text-neutral-700">{font.name}</div>
                  <div className="text-[10px] text-neutral-400">{font.polish}</div>
                </div>
                <div
                  style={{ fontFamily: font.cssName, fontSize: `${fontSize}px` }}
                  className="flex-1 text-neutral-900 leading-tight"
                >
                  {displayText}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <DemoBox
          title="Alfabety polskie — wszystkie fonty"
          description="Test polskich znaków specjalnych na wszystkich fontach"
          tech="Google Fonts"
        >
          <div className="space-y-3 w-full">
            {FONTS.filter(f => f.id !== "jakarta").map(font => (
              <div key={font.id} className="flex items-baseline gap-3">
                <span className="text-[10px] font-mono text-neutral-400 w-20 shrink-0">{font.name}</span>
                <span style={{ fontFamily: font.cssName, fontSize: "18px" }} className="text-neutral-800">
                  Ą ą Ć ć Ę ę Ł ł Ń ń Ó ó Ś ś Ź ź Ż ż
                </span>
              </div>
            ))}
          </div>
        </DemoBox>

        <DemoBox
          title="Nagłówki H1–H4 w Caveat"
          description="Caveat w różnych rozmiarach — proporcje nagłówków"
          tech="Google Fonts"
          status="kandydat"
        >
          <div className="space-y-1 w-full" style={{ fontFamily: "var(--font-caveat)" }}>
            <div className="text-4xl leading-tight text-neutral-900">Polutek.pl</div>
            <div className="text-2xl text-neutral-700">Cześć Słońce</div>
            <div className="text-xl text-neutral-600">Wesprzyj platformę</div>
            <div className="text-base text-neutral-500">105 dni do premiery</div>
          </div>
        </DemoBox>
      </div>
    </div>
  );
}
