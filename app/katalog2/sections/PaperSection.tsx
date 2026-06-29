"use client";

import React, { useState } from "react";
import { SectionHeader, DemoBox } from "../components/DemoBox";
import { Slider, ColorPicker, Toggle } from "../components/Controls";

function PaperBg({ opacity = 0.05, bgColor = "#fdfbf7", frequency = 0.65, fixed = false }: {
  opacity?: number;
  bgColor?: string;
  frequency?: number;
  fixed?: boolean;
}) {
  const noiseUrl = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

  return (
    <div className="relative w-full h-32 rounded overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: noiseUrl,
          opacity,
          backgroundAttachment: fixed ? "fixed" : "scroll",
        }}
      />
      <div className="relative z-10 p-4 text-sm">
        <p className="font-bold">Nagłówek sekcji</p>
        <p className="text-neutral-600 text-xs mt-1">Tekst treści na papierowym tle — sprawdź czytelność.</p>
      </div>
    </div>
  );
}

export default function PaperSection() {
  const [opacity, setOpacity] = useState(0.06);
  const [bgColor, setBgColor] = useState("#fdfbf7");
  const [frequency, setFrequency] = useState(0.65);
  const [fixed, setFixed] = useState(false);

  return (
    <div>
      <SectionHeader
        title="Tła Papierowe"
        subtitle="Faktura papieru generowana przez SVG feTurbulence — zero zewnętrznych obrazków, skaluje się do każdego rozmiaru."
        icon="📄"
      />

      <div className="space-y-4">
        <DemoBox
          id="T-MAIN"
          title="Interaktywna faktura papieru"
          status="kandydat"
          tech="CSS/SVG"
          description="SVG feTurbulence generuje szum. Frequency kontroluje ziarnistość, opacity — natężenie efektu."
          useCase="tło całej strony, sekcje, panele"
          code={`<div style={{ backgroundImage: \`url("data:image/svg+xml,...)\`, opacity: ${opacity} }} />`}
          controls={
            <div className="space-y-3">
              <Slider label="opacity" value={opacity} min={0.01} max={0.3} step={0.01} onChange={setOpacity} />
              <Slider label="frequency" value={frequency} min={0.1} max={2} step={0.05} onChange={setFrequency} />
              <ColorPicker label="bg color" value={bgColor} onChange={setBgColor} />
              <Toggle label="fixed (scroll)" value={fixed} onChange={setFixed} />
            </div>
          }
          fullWidth
        >
          <PaperBg opacity={opacity} bgColor={bgColor} frequency={frequency} fixed={fixed} />
        </DemoBox>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "subtelny (0.03)", opacity: 0.03, freq: 0.65, bg: "#fdfbf7", status: "kandydat" },
            { label: "papier (0.06)", opacity: 0.06, freq: 0.65, bg: "#fdfbf7", status: "kandydat" },
            { label: "mocny (0.15)", opacity: 0.15, freq: 0.65, bg: "#f4f1ea", status: "inspiracja" },
            { label: "drobny szum", opacity: 0.08, freq: 1.2, bg: "#fdfbf7", status: "eksperyment" },
            { label: "gruby szum", opacity: 0.1, freq: 0.3, bg: "#fdfbf7", status: "eksperyment" },
            { label: "kremowy", opacity: 0.08, freq: 0.65, bg: "#f5f0e8", status: "inspiracja" },
            { label: "ciepły żółty", opacity: 0.06, freq: 0.65, bg: "#fefce8", status: "inspiracja" },
            { label: "chłodny biały", opacity: 0.04, freq: 0.9, bg: "#f8fafc", status: "kandydat" },
          ].map(({ label, opacity: op, freq, bg, status }) => (
            <DemoBox key={label} title={label} status={status as any} tech="CSS/SVG">
              <PaperBg opacity={op} bgColor={bg} frequency={freq} />
            </DemoBox>
          ))}
        </div>

        <DemoBox
          id="T-TEXT"
          title="Test czytelności tekstu"
          status="kandydat"
          tech="CSS/SVG"
          description="Długi blok tekstu na papierowym tle — czy czytelność jest zachowana?"
          fullWidth
        >
          <div className="relative rounded overflow-hidden w-full" style={{ backgroundColor: "#fdfbf7" }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                opacity: 0.06,
              }}
            />
            <div className="relative z-10 p-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-3 text-neutral-900">Cześć Słońce</h2>
              <p className="text-sm text-neutral-700 leading-relaxed mb-2">
                Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze. Bez subskrypcji, bez powtarzających się opłat.
                Po dokonaniu wpłaty wszystkie filmy dla zalogowanych stają się dostępne natychmiast.
              </p>
              <p className="text-xs text-neutral-400 mt-4">Czytelność: dobra ✓ · Kontrast: zachowany ✓ · Rozmiar tekstu: 14px</p>
            </div>
          </div>
        </DemoBox>

        <DemoBox
          id="T-VIGNETTE"
          title="Papier z winietą"
          status="inspiracja"
          tech="CSS/SVG"
          description="Faktura + radialny gradient cieniujący krawędzie — efekt starego papieru"
          fullWidth
        >
          <div className="relative rounded overflow-hidden w-full h-40" style={{ backgroundColor: "#fdfbf7" }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                opacity: 0.08,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.1) 100%)" }}
            />
            <div className="relative z-10 flex items-center justify-center h-full">
              <p className="text-lg font-bold text-neutral-800">Efekt starego papieru</p>
            </div>
          </div>
        </DemoBox>
      </div>
    </div>
  );
}
