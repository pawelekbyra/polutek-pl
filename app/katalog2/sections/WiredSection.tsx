"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader, DemoBox } from "../components/DemoBox";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "wired-button": any;
      "wired-input": any;
      "wired-checkbox": any;
      "wired-radio": any;
      "wired-card": any;
      "wired-slider": any;
      "wired-progress": any;
      "wired-textarea": any;
      "wired-toggle": any;
      "wired-tab": any;
      "wired-tabs": any;
      "wired-item": any;
      "wired-listbox": any;
      "wired-combo": any;
      "wired-search-input": any;
      "wired-spinner": any;
      "wired-divider": any;
      "wired-icon-button": any;
      "wired-link": any;
    }
  }
}

function useWired() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import("wired-elements").then(() => setLoaded(true));
  }, []);
  return loaded;
}

function WiredShowcase() {
  const loaded = useWired();
  const [checkVal, setCheckVal] = useState(false);
  const [inputVal, setInputVal] = useState("");

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-neutral-400 text-sm">
        <span className="animate-spin">⟳</span> Ładowanie wired-elements...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full">
      <div className="flex flex-col gap-2 items-start">
        <span className="text-[10px] font-mono text-neutral-400 uppercase">button</span>
        <wired-button>Kliknij mnie</wired-button>
        <wired-button elevation="3">Elevation 3</wired-button>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <span className="text-[10px] font-mono text-neutral-400 uppercase">input</span>
        <wired-input placeholder="Szukaj..." style={{ width: "140px" }} />
        <wired-input placeholder="Email..." type="email" style={{ width: "140px" }} />
      </div>

      <div className="flex flex-col gap-2 items-start">
        <span className="text-[10px] font-mono text-neutral-400 uppercase">checkbox</span>
        <div className="flex items-center gap-2">
          <wired-checkbox checked />
          <span className="text-sm">Zaznaczone</span>
        </div>
        <div className="flex items-center gap-2">
          <wired-checkbox />
          <span className="text-sm">Nie zaznaczone</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <span className="text-[10px] font-mono text-neutral-400 uppercase">radio</span>
        <div className="flex items-center gap-2"><wired-radio name="r1" checked /><span className="text-sm">Opcja A</span></div>
        <div className="flex items-center gap-2"><wired-radio name="r1" /><span className="text-sm">Opcja B</span></div>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <span className="text-[10px] font-mono text-neutral-400 uppercase">slider</span>
        <wired-slider value={40} style={{ width: "140px" }} />
        <wired-slider value={70} style={{ width: "140px" }} />
      </div>

      <div className="flex flex-col gap-2 items-start">
        <span className="text-[10px] font-mono text-neutral-400 uppercase">progress</span>
        <wired-progress value={40} max={100} style={{ width: "140px" }} />
        <wired-progress value={75} max={100} style={{ width: "140px" }} />
      </div>
    </div>
  );
}

function WiredCard() {
  const loaded = useWired();
  if (!loaded) return <div className="text-neutral-400 text-sm">Ładowanie...</div>;
  return (
    <wired-card elevation={2} style={{ padding: "16px", display: "block", maxWidth: "280px" }}>
      <div className="font-bold text-neutral-900 mb-1">Cześć Słońce</div>
      <div className="text-sm text-neutral-500 mb-3">Paweł Polutek · 7 wyświetleń</div>
      <wired-button>Obejrzyj</wired-button>
    </wired-card>
  );
}

function WiredForm() {
  const loaded = useWired();
  if (!loaded) return <div className="text-neutral-400 text-sm">Ładowanie...</div>;
  return (
    <div className="space-y-4 max-w-xs">
      <div>
        <label className="text-xs font-mono text-neutral-500 block mb-1">Imię</label>
        <wired-input placeholder="Twoje imię" style={{ width: "100%" }} />
      </div>
      <div>
        <label className="text-xs font-mono text-neutral-500 block mb-1">Email</label>
        <wired-input placeholder="twoj@email.pl" type="email" style={{ width: "100%" }} />
      </div>
      <div className="flex items-center gap-2">
        <wired-checkbox />
        <span className="text-sm">Zgadzam się z regulaminem</span>
      </div>
      <wired-button elevation="2">Wyślij</wired-button>
    </div>
  );
}

export default function WiredSection() {
  return (
    <div>
      <SectionHeader
        title="Wired Elements"
        subtitle="Gotowa biblioteka Web Components z odręcznym wyglądem. Działa w React, Vue, Svelte. Pod spodem używa RoughJS — ale bez kontroli nad parametrami."
        icon="🔌"
      />

      <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
        <strong>Uwaga:</strong> Wired Elements to Web Components — ładują się asynchronicznie i wymagają JavaScript.
        Nie można kontrolować roughness, seed ani strokeWidth. Dobra opcja na szybki prototyp, słaba na produkcję z własnym brandingiem.
      </div>

      <div className="space-y-4">
        <DemoBox
          id="W-ALL"
          title="Wszystkie komponenty — przegląd"
          status="inspiracja"
          tech="wired-elements"
          description="Kompletna galeria gotowych komponentów z wired-elements v3."
          useCase="prototypy, mockupy, prezentacje"
          fullWidth
        >
          <WiredShowcase />
        </DemoBox>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DemoBox
            id="W-CARD"
            title="wired-card — karta"
            status="inspiracja"
            tech="wired-elements"
            description="Karta z elevation (głębokość cienia). Prosta w użyciu, ale wygląd niekontrolowalny."
          >
            <WiredCard />
          </DemoBox>

          <DemoBox
            id="W-FORM"
            title="Formularz z wired-elements"
            status="inspiracja"
            tech="wired-elements"
            description="Pełny formularz złożony z gotowych komponentów. Szybki do zbudowania."
          >
            <WiredForm />
          </DemoBox>
        </div>

        <DemoBox
          id="W-VS"
          title="Wired Elements vs Custom RoughJS — porównanie"
          status="kandydat"
          tech="CSS/SVG"
          description="Ten sam button w trzech wersjach. Wired = gotowiec bez kontroli. Custom RoughJS = pełna kontrola, więcej kodu."
          fullWidth
        >
          <div className="flex flex-wrap gap-8 items-center justify-center py-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-neutral-400">wired-elements</span>
              {React.createElement(() => {
                const loaded = useWired();
                if (!loaded) return <div className="text-neutral-400 text-xs">ładowanie...</div>;
                return <wired-button>Subskrybuj</wired-button>;
              })}
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-neutral-400">RoughJS custom</span>
              <button className="px-5 py-2 relative text-sm font-medium">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 38" preserveAspectRatio="none">
                  <path d="M 5 4 L 116 6 L 113 34 L 7 32 Z" fill="none" stroke="#1a1a1a" strokeWidth="1.5" />
                </svg>
                <span className="relative">Subskrybuj</span>
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-neutral-400">CSS border-image</span>
              <button
                className="px-5 py-2 text-sm font-medium relative"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='38'%3E%3Cpath d='M5,4 L116,6 L113,34 L7,32 Z' fill='none' stroke='%231a1a1a' stroke-width='1.5'/%3E%3C/svg%3E")`,
                  backgroundSize: "100% 100%",
                }}
              >
                Subskrybuj
              </button>
            </div>
          </div>
        </DemoBox>

        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
          <h3 className="text-sm font-bold text-neutral-800 mb-3">Kiedy używać Wired Elements?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-600">
            <div>
              <div className="font-semibold text-green-700 mb-1">✓ Tak — kiedy</div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Prototyp, mockup, demo</li>
                <li>Wewnętrzny tool / admin panel</li>
                <li>Chcesz mieć wszystko od razu</li>
                <li>Nie masz wymagań brandingowych</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-red-700 mb-1">✗ Nie — kiedy</div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Chcesz kontrolować roughness/seed</li>
                <li>Potrzebujesz SSR bez hydration issue</li>
                <li>Masz własny design system</li>
                <li>Polutek.pl — za mało kontroli</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
