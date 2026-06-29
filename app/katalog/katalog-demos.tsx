"use client";

import React, { useEffect, useRef, useState } from 'react';
import rough from 'roughjs';
import { getStroke } from 'perfect-freehand';
import { AnnotatedText } from './components/AnnotatedText';
import { WiredButton, WiredInput, WiredCheckbox, WiredRadio, WiredCard, WiredSlider } from './components/WiredWrappers';

// --- Helpers for Perfect Freehand ---
function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}

// --- Basic Components ---

interface BaseDemoProps {
  width?: number;
  height?: number;
  params?: Record<string, unknown>;
}

export const RoughLine = ({ width = 200, height = 20, params = {} }: BaseDemoProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      const rc = rough.svg(svgRef.current);
      svgRef.current.innerHTML = '';
      const line = rc.line(10, height / 2, width - 10, height / 2, {
        stroke: 'currentColor',
        ...params as any // intentional experimental style override
      });
      svgRef.current.appendChild(line);
    }
  }, [width, height, params]);

  return <svg ref={svgRef} width={width} height={height} className="text-slate-900" />;
};

export const RoughRect = ({ width = 200, height = 100, params = {} }: BaseDemoProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      const rc = rough.svg(svgRef.current);
      svgRef.current.innerHTML = '';
      const rect = rc.rectangle(5, 5, width - 10, height - 10, {
        stroke: 'currentColor',
        ...params as any // intentional experimental style override
      });
      svgRef.current.appendChild(rect);
    }
  }, [width, height, params]);

  return <svg ref={svgRef} width={width} height={height} className="text-slate-900" />;
};

export const FreehandLine = ({ width = 200, height = 40, params = {} }: BaseDemoProps) => {
  const points: [number, number, number][] = [
    [10, height / 2, 0.5],
    [width / 2, height / 2 + (Math.random() - 0.5) * 10, 0.8],
    [width - 10, height / 2, 0.3],
  ];

  const stroke = getStroke(points, params as any); // intentional experimental style override
  const pathData = getSvgPathFromStroke(stroke);

  return (
    <svg width={width} height={height} className="text-slate-900 fill-current">
      <path d={pathData} />
    </svg>
  );
};

export const CustomPath = ({ width = 200, height = 40, path = 'M 10 20 Q 100 25 190 20', params = {} }: BaseDemoProps & { path?: string }) => {
  return (
    <svg width={width} height={height} className="text-slate-900 fill-none stroke-current stroke-2">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
      {params.iterations === 2 && (
        <path d={path.replace(/20/g, '22').replace(/25/g, '27')} opacity="0.5" />
      )}
    </svg>
  );
};

// --- Section Demos ---

export const SectionLDemos: Record<string, React.FC<BaseDemoProps>> = {
  L1: (p) => <RoughLine {...p} params={{ roughness: 1, strokeWidth: 1 }} />,
  L2: (p) => <RoughLine {...p} params={{ roughness: 1.5, strokeWidth: 3 }} />,
  L3: (p) => <RoughLine {...p} params={{ roughness: 4, strokeWidth: 2 }} />,
  L4: (p) => <RoughLine {...p} params={{ bowing: 6, strokeWidth: 2 }} />,
  L5: (p) => <RoughLine {...p} params={{ seed: 42, roughness: 1.5 }} />,
  L6: (p) => <FreehandLine {...p} params={{ size: 4, thinning: 0.5, smoothing: 0.5 }} />,
  L7: (p) => <FreehandLine {...p} params={{ size: 12, thinning: 0.7, smoothing: 0.5 }} />,
  L8: (p) => <FreehandLine {...p} params={{ size: 8, start: { taper: 20 }, end: { taper: 20 } }} />,
  L9: (p) => <CustomPath {...p} path="M 10 20 Q 100 22 190 20" />,
  L10: (p) => <CustomPath {...p} path="M 10 20 Q 100 22 190 20" params={{ iterations: 2 }} />,
  L11: (p) => <CustomPath {...p} path="M 10 20 L 30 25 L 60 15 L 90 25 L 120 18 L 150 22 L 190 20" />,
  L12: (p) => (
    <div className="flex flex-col gap-2">
      <RoughLine {...p} params={{ roughness: 1 }} />
      <FreehandLine {...p} params={{ size: 4 }} />
      <CustomPath {...p} />
    </div>
  ),
};

export const SectionBDemos: Record<string, React.FC<BaseDemoProps>> = {
  B1: (p) => <RoughRect width={150} height={100} params={{ roughness: 1.2 }} />,
  B2: (p) => <RoughRect width={250} height={150} params={{ roughness: 0.8, strokeWidth: 1.5 }} />,
  B3: (p) => <RoughRect width={120} height={50} params={{ bowing: 2, roughness: 2 }} />,
  B4: (p) => <RoughRect width={160} height={90} params={{ roughness: 1 }} />,
  B5: (p) => <RoughRect width={150} height={100} params={{ fill: 'rgba(37,99,235,0.2)', fillStyle: 'hachure', fillWeight: 3 }} />,
  B6: (p) => <RoughRect width={150} height={100} params={{ fill: 'rgba(37,99,235,0.2)', fillStyle: 'dots' }} />,
  B7: (p) => (
    <svg width={200} height={100} className="fill-none stroke-current stroke-2">
      <path d="M 10 12 L 190 8 L 195 90 L 5 95 Z" />
    </svg>
  ),
  B8: (p) => (
    <svg width={200} height={100} className="fill-none stroke-current stroke-1">
      <rect x="10" y="10" width="180" height="80" />
      <rect x="12" y="12" width="176" height="76" opacity="0.5" />
    </svg>
  ),
  B9: (p) => (
    <svg width={200} height={100} className="fill-none stroke-current stroke-2">
      <path d="M 10 10 L 190 10 L 190 90 M 170 90 L 10 90 L 10 30" />
    </svg>
  ),
  B10: (p) => (
    <div className="flex flex-wrap gap-4">
      <div className="border-2 border-slate-900 w-24 h-16 flex items-center justify-center text-xs">CSS</div>
      <RoughRect width={100} height={64} />
      <svg width={100} height={64} className="fill-none stroke-current stroke-2"><path d="M 5 5 L 95 7 L 92 59 L 8 55 Z"/></svg>
    </div>
  ),
};

export const SectionSDemos: Record<string, React.FC<BaseDemoProps>> = {
  S1: (p) => <RoughLine {...p} params={{ roughness: 0.5 }} />,
  S2: (p) => <CustomPath {...p} path="M 10 20 C 50 10, 150 30, 190 20" />,
  S3: (p) => (
    <div className="flex flex-col gap-1">
      <RoughLine {...p} params={{ roughness: 0.5 }} />
      <RoughLine {...p} params={{ roughness: 1.5 }} />
    </div>
  ),
  S4: (p) => (
    <div className="relative w-[200px] h-[40px] flex items-center justify-center">
      <RoughLine width={200} height={40} params={{ roughness: 0.8 }} />
      <div className="absolute bg-white px-2 text-blue-600">✦</div>
    </div>
  ),
  S5: (p) => <RoughLine {...p} params={{ roughness: 1.5 }} />,
  S6: (p) => <FreehandLine {...p} params={{ size: 6 }} />,
  S7: (p) => <CustomPath {...p} path="M 10 20 Q 100 15 190 20" />,
  S8: (p) => (
    <div className="flex items-center gap-2">
      <RoughLine width={60} height={20} />
      <span className="font-bold text-[10px] tracking-widest uppercase">Polutek</span>
      <RoughLine width={60} height={20} />
    </div>
  ),
  S9: (p) => <RoughLine width={400} height={20} params={{ roughness: 1.2 }} />,
  S10: (p) => (
    <div className="flex flex-col gap-4">
      <RoughLine width={200} height={20} params={{ roughness: 0.8 }} />
      <CustomPath width={200} height={20} path="M 10 10 Q 100 12 190 10" />
    </div>
  ),
};

export const SectionNDemos: Record<string, React.FC<BaseDemoProps>> = {
  N1: () => <AnnotatedText type="underline">Podkreślony tekst</AnnotatedText>,
  N2: () => <AnnotatedText type="box">Tekst w pudełku</AnnotatedText>,
  N3: () => <AnnotatedText type="circle">Zakreślone kółkiem</AnnotatedText>,
  N4: () => <AnnotatedText type="highlight" color="#fef08a">Markerem zakreślone</AnnotatedText>,
  N5: () => <AnnotatedText type="strike-through">Skreślony tekst</AnnotatedText>,
  N6: () => <AnnotatedText type="crossed-off">Przekreślony X</AnnotatedText>,
  N7: () => <AnnotatedText type="bracket" brackets={['left']}>Nawias z lewej</AnnotatedText>,
  N8: () => <AnnotatedText type="bracket" brackets={['left', 'right']}>Nawiasy z obu stron</AnnotatedText>,
  N9: () => (
    <div className="w-48 leading-relaxed">
      <AnnotatedText type="highlight" color="#fef08a" multiline={true}>
        To jest bardzo długi tekst, który powinien zostać zakreślony w wielu liniach przez marker.
      </AnnotatedText>
    </div>
  ),
  N10: () => (
    <div>
      <AnnotatedText type="highlight" color="#fef08a">Wiele</AnnotatedText>{' '}
      <AnnotatedText type="underline">różnych</AnnotatedText>{' '}
      <AnnotatedText type="circle">efektów</AnnotatedText>
    </div>
  ),
  N11: () => <AnnotatedText type="box" animate={true}>Animowane rysowanie</AnnotatedText>,
  N12: () => <AnnotatedText type="box" animate={false}>Statyczny szkic</AnnotatedText>,
};

export const SectionZDemos: Record<string, React.FC<BaseDemoProps>> = {
  Z1: () => (
    <div className="flex flex-col items-center">
      <AnnotatedText type="underline">Nagłówek sekcji</AnnotatedText>
      <RoughLine width={150} height={20} />
    </div>
  ),
  Z2: () => (
    <div className="relative">
      <div className="absolute inset-0 bg-yellow-200 opacity-30 h-4 top-2 -rotate-1"></div>
      <RoughLine width={150} height={20} params={{ strokeWidth: 3 }} />
    </div>
  ),
  Z3: () => (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4"><RoughRect width={16} height={16} params={{ fill: 'currentColor' }} /></div>
      <RoughLine width={100} height={20} />
    </div>
  ),
  Z4: () => (
    <div className="flex items-center gap-2">
      <RoughLine width={100} height={20} />
      <span className="text-[10px] border border-slate-900 px-1 rotate-2">OPIS</span>
    </div>
  ),
  Z5: () => (
    <div className="flex gap-4 items-center">
      <RoughLine width={100} height={20} />
      <div className="h-12 w-4"><AnnotatedText type="bracket" brackets={['left']}> </AnnotatedText></div>
    </div>
  ),
  Z6: () => <FreehandLine width={200} height={60} params={{ size: 30 }} />,
  Z7: () => (
    <div className="flex flex-col items-center gap-1">
      <button className="px-4 py-2 relative">
        <div className="absolute inset-0"><RoughRect width={100} height={40} /></div>
        <span className="relative z-10">Kupuję</span>
      </button>
      <AnnotatedText type="underline" color="red">Ostatnie sztuki!</AnnotatedText>
    </div>
  ),
  Z8: () => (
    <div className="flex flex-col">
      <h3 className="text-xl font-bold">Wielki Tytuł</h3>
      <div className="mt-[-10px]"><RoughLine width={150} height={20} params={{ strokeWidth: 4, roughness: 2 }} /></div>
    </div>
  ),
  Z9: () => <AnnotatedText type="highlight" animate={true}>Animowane Z9</AnnotatedText>,
  Z10: () => <AnnotatedText type="highlight" animate={false}>Statyczne Z10</AnnotatedText>,
};

export const SectionPDemos: Record<string, React.FC<BaseDemoProps>> = {
  P1: () => (
    <button className="px-4 py-2 relative">
      <div className="absolute inset-0"><RoughRect width={100} height={40} params={{ roughness: 1 }} /></div>
      <span className="relative">Przycisk</span>
    </button>
  ),
  P2: () => (
    <button className="px-6 py-3 relative">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 50" preserveAspectRatio="none">
        <path d="M 5 5 L 115 7 L 112 45 L 8 42 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="relative font-bold">Główny CTA</span>
    </button>
  ),
  P3: () => <button className="hover:text-blue-600 transition-colors"><AnnotatedText type="underline">Link tekstowy</AnnotatedText></button>,
  P4: () => (
    <button className="px-4 py-2">
      <AnnotatedText type="highlight" color="#fef08a">Kliknij mnie</AnnotatedText>
    </button>
  ),
  P5: () => (
    <button className="px-4 py-2 group relative">
      <div className="absolute inset-0"><RoughRect width={100} height={40} /></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 translate-y-1">
        <RoughRect width={100} height={40} params={{ stroke: 'blue' }} />
      </div>
      <span className="relative">Hover Me</span>
    </button>
  ),
  P6: () => <button className="px-4 py-2 border-2 border-slate-900 focus:ring-4 ring-blue-200 outline-none">Focus Test</button>,
  P7: () => (
    <button disabled className="px-4 py-2 relative opacity-50 cursor-not-allowed">
      <div className="absolute inset-0"><RoughRect width={100} height={40} /></div>
      <span className="relative">Zablokowany</span>
    </button>
  ),
  P8: () => <WiredButton>Wired Button</WiredButton>,
};

export const SectionKDemos: Record<string, React.FC<BaseDemoProps>> = {
  K1: () => (
    <div className="p-6 relative w-64 h-40">
      <div className="absolute inset-0"><RoughRect width={256} height={160} params={{ roughness: 1.5, iterations: 3 }} /></div>
      <h4 className="relative font-bold">Karta Wideo</h4>
      <p className="relative text-sm text-slate-600 mt-2">Opis odcinka Polutek...</p>
    </div>
  ),
  K2: () => (
    <div className="p-6 relative w-64 h-40">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 160" preserveAspectRatio="none">
        <path d="M 10 5 L 250 15 L 245 150 L 5 155 Z" fill="white" stroke="currentColor" strokeWidth="2" />
      </svg>
      <h4 className="relative font-bold">Karta Custom SVG</h4>
    </div>
  ),
  K3: () => (
    <div className="p-8 bg-[#fdfbf7] shadow-lg border-b-4 border-r-4 border-slate-200 relative w-64 h-40 overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      <h4 className="relative font-bold">Papierowy Panel</h4>
      <p className="relative text-sm">Faktura papieru i cień.</p>
    </div>
  ),
  K4: () => (
    <div className="w-64 border-2 border-slate-900 p-4">
      <div className="mb-2"><AnnotatedText type="highlight" color="#bfdbfe">Tytuł Karty</AnnotatedText></div>
      <p className="text-sm">Zawartość karty...</p>
    </div>
  ),
  K5: () => (
    <div className="w-64 border border-slate-300 p-4 relative">
      <div className="absolute -top-3 -right-3 w-8 h-8 rotate-12 bg-white"><RoughRect width={32} height={32} params={{ fill: 'yellow' }} /></div>
      <p>Karta z doodlem</p>
    </div>
  ),
  K6: () => (
    <div className="w-64 border-2 border-slate-900 flex flex-col items-center p-4 gap-4">
      <div className="w-full h-24 bg-slate-100 flex items-center justify-center">Obrazek</div>
      <button className="w-full py-2 bg-blue-600 text-white font-bold">Akcja</button>
    </div>
  ),
  K7: () => (
    <div className="w-full p-12 relative max-w-2xl">
      <div className="absolute inset-0"><RoughRect width={600} height={200} params={{ strokeWidth: 3, roughness: 1 }} /></div>
      <h2 className="relative text-3xl font-bold">Wielka Sekcja</h2>
    </div>
  ),
  K8: () => <div className="flex gap-4"><SectionKDemos.K1 /><SectionKDemos.K3 /></div>,
};

export const SectionVDemos: Record<string, React.FC<BaseDemoProps>> = {
  V1: () => (
    <div className="w-64 aspect-video relative">
      <div className="absolute inset-0"><RoughRect width={256} height={144} /></div>
      <div className="absolute inset-2 bg-slate-200"></div>
    </div>
  ),
  V2: () => (
    <div className="w-64 aspect-video relative">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 144" preserveAspectRatio="none">
        <path d="M 5 5 L 250 8 L 253 140 L 8 138 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <div className="absolute inset-2 bg-slate-200"></div>
    </div>
  ),
  V3: () => (
    <div className="w-full max-w-2xl aspect-video relative p-4">
       <div className="absolute inset-0"><RoughRect width={672} height={378} params={{ strokeWidth: 2, roughness: 1.2 }} /></div>
       <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
          <span className="text-4xl">▶</span>
       </div>
    </div>
  ),
  V4: () => (
    <div className="flex flex-col items-center">
       <div className="w-64 h-36 bg-slate-200"></div>
       <div className="mt-2 text-xl font-handwriting">Mój pierwszy film - odręcznie</div>
    </div>
  ),
  V5: () => (
    <div className="relative p-12">
      <button className="px-8 py-4 bg-blue-600 text-white rounded-full">PLAY</button>
      <svg className="absolute top-0 right-0 w-12 h-12 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M 2 2 Q 10 2, 20 20 M 20 20 L 15 20 M 20 20 L 20 15" />
      </svg>
    </div>
  ),
  V6: () => (
    <div className="flex flex-col items-center gap-2">
      <div className="w-64 h-36 bg-slate-200"></div>
      <AnnotatedText type="highlight" color="#fef08a">Wspieraj Polutek!</AnnotatedText>
    </div>
  ),
  V7: () => <div className="border border-slate-300 p-1"><div className="w-64 h-36 bg-slate-200"></div></div>,
  V8: () => (
    <div className="border-4 border-slate-900 p-2 rotate-1 shadow-xl">
      <div className="w-64 h-36 bg-slate-900"></div>
    </div>
  ),
};

export const SectionWDemos: Record<string, React.FC<BaseDemoProps>> = {
  W1: () => <WiredButton>Wired Button</WiredButton>,
  W2: () => <WiredInput placeholder="Twój e-mail" />,
  W3: () => <div className="flex items-center gap-2"><WiredCheckbox /><span>Zgadzam się</span></div>,
  W4: () => <div className="flex flex-col gap-1"><WiredRadio name="r" /><span>Opcja A</span><WiredRadio name="r" /><span>Opcja B</span></div>,
  W5: () => <WiredCard elevation={3}><div className="p-4">Wired Card Content</div></WiredCard>,
  W6: () => <div className="w-48"><WiredSlider value={40} /></div>,
  W7: () => (
    <div className="flex gap-4">
      <WiredButton>Wired</WiredButton>
      <button className="px-4 py-2 relative"><div className="absolute inset-0"><RoughRect width={100} height={40} /></div><span className="relative">Custom</span></button>
    </div>
  ),
};

export const SectionTDemos: Record<string, React.FC<BaseDemoProps>> = {
  T1: () => (
    <div className="w-full h-32 bg-[#fdfbf7] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      <p className="p-4">Subtelny papier</p>
    </div>
  ),
  T2: () => (
    <div className="w-full h-32 bg-[#f4f1ea] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      <p className="p-4">Mocniejszy papier</p>
    </div>
  ),
  T3: () => (
    <div className="w-full h-32 bg-[#fdfbf7] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.05)_100%)]"></div>
      <p className="p-4">Papier z gradientem</p>
    </div>
  ),
  T4: () => (
    <div className="w-full h-32 relative overflow-hidden border border-slate-200">
      <svg className="absolute inset-0 w-full h-full opacity-10">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
      <p className="p-4 relative">Dynamiczny szum SVG</p>
    </div>
  ),
  T5: () => (
    <div className="w-full p-6 bg-[#fdfbf7] relative overflow-hidden border border-slate-100">
       <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
       <h5 className="relative font-bold mb-2">Czytelność tekstu</h5>
       <p className="relative text-sm leading-relaxed text-slate-700">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
       </p>
    </div>
  ),
  T6: () => (
    <div className="w-full h-48 bg-[#fdfbf7] relative overflow-y-auto border border-slate-100 p-4">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      <div className="h-[400px]">Scrolluj mnie... tło powinno być stałe.</div>
    </div>
  ),
};

export const SectionCDemos: Record<string, React.FC<BaseDemoProps>> = {
  C1: () => <SectionLDemos.L1 />,
  C2: () => <SectionBDemos.B1 />,
  C3: () => <SectionSDemos.S1 />,
  C4: () => <SectionNDemos.N4 />,
  C5: () => <SectionPDemos.P2 />,
  C6: () => <SectionKDemos.K3 />,
  C7: () => <SectionVDemos.V3 />,
};

export const AllDemos: Record<string, Record<string, React.FC<BaseDemoProps>>> = {
  L: SectionLDemos,
  B: SectionBDemos,
  S: SectionSDemos,
  N: SectionNDemos,
  Z: SectionZDemos,
  P: SectionPDemos,
  K: SectionKDemos,
  V: SectionVDemos,
  W: SectionWDemos,
  T: SectionTDemos,
  C: SectionCDemos,
};
