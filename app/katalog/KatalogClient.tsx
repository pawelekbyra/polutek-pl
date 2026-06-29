"use client";

import React, { useState } from 'react';
import { sections, KatalogItem } from './katalog-data';
import { AllDemos } from './katalog-demos';
import { AnnotatedText } from './components/AnnotatedText';

export default function KatalogClient() {
  const [filterTech, setFilterTech] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (filterTech && item.tech !== filterTech) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      return true;
    })
  })).filter(section => section.items.length > 0);

  const allTechs = Array.from(new Set(sections.flatMap(s => s.items.map(i => i.tech))));
  const allStatuses = Array.from(new Set(sections.flatMap(s => s.items.map(i => i.status))));

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-slate-900 font-sans selection:bg-yellow-200 relative overflow-hidden">
      {/* Global Paper Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}
      />

      {/* Sticky Header / Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-blue-600">POLUTEK</span>
            <span className="text-slate-400">/</span>
            <span>Katalog Stylu</span>
          </h1>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="hover:text-blue-600 transition-colors uppercase tracking-wider">
              {s.id}. {s.title}
            </a>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-20 text-center md:text-left">
          <div className="max-w-3xl">
            <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Katalog stylu <AnnotatedText type="box" color="#2563eb">POLUTEK</AnnotatedText>:<br />
              papier, cienkopis, kreska
            </h2>
            <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
              Eksperymentalna biblioteka przykładów do wyboru kierunku wizualnego.
              To laboratorium nie wpływa na główny UI strony — służy do podejmowania decyzji o charakterze kreski i adnotacji.
            </p>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
               <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-100">
                 Laboratorium wizualne
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-bold border border-slate-200">
                 Publiczna podstrona
               </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-12 p-6 bg-white border-2 border-slate-200 rounded-2xl shadow-sm">
           <div className="flex flex-wrap gap-8">
              <div>
                <span className="block text-xs font-bold uppercase text-slate-400 mb-3 tracking-widest">Filtruj po technologii</span>
                <div className="flex flex-wrap gap-2">
                   <button
                    onClick={() => setFilterTech(null)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${!filterTech ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                   >
                     WSZYSTKO
                   </button>
                   {allTechs.map(t => (
                     <button
                      key={t}
                      onClick={() => setFilterTech(t)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${filterTech === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                     >
                       {t.toUpperCase()}
                     </button>
                   ))}
                </div>
              </div>
              <div>
                <span className="block text-xs font-bold uppercase text-slate-400 mb-3 tracking-widest">Status</span>
                <div className="flex flex-wrap gap-2">
                   <button
                    onClick={() => setFilterStatus(null)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${!filterStatus ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                   >
                     WSZYSTKO
                   </button>
                   {allStatuses.map(s => (
                     <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${filterStatus === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                     >
                       {s.toUpperCase()}
                     </button>
                   ))}
                </div>
              </div>
           </div>
        </section>

        {/* Sections */}
        <div className="space-y-24">
          {filteredSections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="flex items-center gap-4 mb-8">
                 <span className="text-4xl font-black text-blue-600/20">{section.id}</span>
                 <h3 className="text-3xl font-bold">{section.title}</h3>
                 <div className="flex-1 h-[2px] bg-slate-100"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {section.items.map((item) => (
                  <ExampleCard key={item.id} item={item} sectionId={section.id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-white py-20 mt-32 px-6">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
            <div>
              <h2 className="text-2xl font-bold mb-4">POLUTEK LABS</h2>
              <p className="text-slate-400 max-w-sm">Eksperymenty nad stylem papierowego UI dla polskiej społeczności twórców.</p>
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-2 border border-white hover:bg-white hover:text-slate-900 transition-all font-bold">WRÓĆ DO GŁÓWNEJ</button>
            </div>
         </div>
      </footer>
    </div>
  );
}

function ExampleCard({ item, sectionId }: { item: KatalogItem, sectionId: string }) {
  const DemoComponent = AllDemos[sectionId]?.[item.id] || (() => <div className="text-red-500">Demo not found: {item.id}</div>);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Example Visual */}
      <div className="p-8 bg-[#f8fafc] border-b border-slate-100 min-h-[160px] flex items-center justify-center relative overflow-hidden">
        {/* Fine grid background for detail */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <DemoComponent />
      </div>

      {/* Info */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-widest">{item.id}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyles(item.status)}`}>
            {item.status.toUpperCase()}
          </span>
        </div>
        <h4 className="font-bold text-slate-900 mb-1">{item.name}</h4>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed flex-1">{item.description}</p>

        <div className="space-y-3">
          <div className="flex justify-between text-[10px]">
             <span className="text-slate-400 font-bold uppercase tracking-widest">Technika</span>
             <span className="text-slate-700 font-medium">{item.tech}</span>
          </div>
          <div className="flex justify-between text-[10px]">
             <span className="text-slate-400 font-bold uppercase tracking-widest">Użycie</span>
             <span className="text-slate-700 font-medium">{item.useCase}</span>
          </div>
          <div className="pt-2 border-t border-slate-50 overflow-hidden">
             <span className="block text-[8px] font-bold uppercase text-slate-400 mb-1 tracking-widest">Parametry</span>
             <code className="text-[9px] text-blue-600 block bg-blue-50/50 p-1 rounded truncate">
               {JSON.stringify(item.params)}
             </code>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'kandydat': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'inspiracja': return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'eksperyment': return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'raczej nie': return 'bg-slate-50 text-slate-400 border-slate-100';
    default: return 'bg-slate-50 text-slate-700 border-slate-100';
  }
}
