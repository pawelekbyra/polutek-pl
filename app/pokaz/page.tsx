"use client";

import Link from "next/link";

const LAYOUTS = [
  {
    id: 1,
    name: "Margines Reportera",
    desc: "Minimalistyczny notes z marginesami, czerwona linia, spirala, ołówkowe notatki",
    emoji: "📓",
    color: "#fef9f0",
    accent: "#c8523b",
    technique: "roughjs + Caveat font",
  },
  {
    id: 2,
    name: "Neonowy Zeszyt",
    desc: "Kratka w stylu szkolnego zeszytu, neonowe kolory, marker highlights",
    emoji: "🟩",
    color: "#0a0a1a",
    accent: "#00ff88",
    technique: "CSS grid lines + neon glow",
  },
  {
    id: 3,
    name: "Pastelowy Warsztat",
    desc: "Ciepłe pastele, wyklejanka z papierów, kolaż z wycinek",
    emoji: "✂️",
    color: "#f8f0e8",
    accent: "#d4846a",
    technique: "roughjs cards + pastel palette",
  },
  {
    id: 4,
    name: "Szkicownik",
    desc: "Otwarty notatnik z dwiema stronami, spirala bindingowa, kartki w linie",
    emoji: "📖",
    color: "#faf6f0",
    accent: "#7bc8a4",
    technique: "framer-motion + SVG spiral",
  },
  {
    id: 5,
    name: "Wireframe Rysunkowy",
    desc: "Papier milimetrowy, każdy element narysowany roughjs, styl makiety UX",
    emoji: "📐",
    color: "#f8f6f0",
    accent: "#4a6741",
    technique: "roughjs everywhere + ResizeObserver",
  },
  {
    id: 6,
    name: "Tablica Kredowa",
    desc: "Zielona tablica szkolna, białe napisy kredą, rozmycie tekstury, chalk glow",
    emoji: "🖊️",
    color: "#1a3528",
    accent: "#f0ece0",
    technique: "SVG feTurbulence + perfect-freehand chalk",
  },
  {
    id: 7,
    name: "Papier Milimetrowy",
    desc: "Inżynierski papier kreślarski, wymiary z strzałkami, czerwone adnotacje",
    emoji: "📏",
    color: "#f0f4f8",
    accent: "#c84528",
    technique: "CSS grid 4-level + framer-motion draw reveal",
  },
  {
    id: 8,
    name: "Akwarela",
    desc: "Plamy akwareli, organiczne kształty, papier czerpany, rozlewające się barwy",
    emoji: "🎨",
    color: "#faf5ee",
    accent: "#4a9abb",
    technique: "perfect-freehand blobs + SVG displacement filters",
  },
  {
    id: 9,
    name: "Podarte Kartki",
    desc: "Warstwy podartych kartek na sobie, postrzępione krawędzie, cienie",
    emoji: "📄",
    color: "#f5ede0",
    accent: "#5b8a6e",
    technique: "CSS clip-path torn edges + sin() noise",
  },
  {
    id: 10,
    name: "Tablica Korkowa",
    desc: "Korek na ścianie, żółte karteczki post-it przypięte pinezkami, zakręcone taśmy",
    emoji: "📌",
    color: "#c8a878",
    accent: "#2a1a0a",
    technique: "CSS cork texture + framer-motion post-its",
  },
  {
    id: 11,
    name: "Znaczki Pocztowe",
    desc: "Kolekcja znaczków z perforowanymi krawędziami, stempel kasujący, lotnicze pasy",
    emoji: "✉️",
    color: "#f2ead8",
    accent: "#8b1a1a",
    technique: "SVG mask perforations + airmail stripes",
  },
  {
    id: 12,
    name: "Rysunek Techniczny",
    desc: "Niebieski blueprint, białe linie techniczne, ramka rysunku, żółte adnotacje",
    emoji: "🔧",
    color: "#001f3f",
    accent: "#ffd700",
    technique: "Blueprint CSS grid + framer-motion useInView",
  },
  {
    id: 13,
    name: "Riso Print",
    desc: "Druk risograficzny, rastrowanie punktowe, zniekształcenie koloru, 2-kolorowy druk",
    emoji: "🖨️",
    color: "#f5f0e5",
    accent: "#e8643c",
    technique: "SVG halftone patterns + misregistration offset",
  },
  {
    id: 14,
    name: "Kaligrafia Atramentowa",
    desc: "Atrament i pędzel, asymetryczny układ, czerwone pieczęcie, złote akcenty",
    emoji: "🖋️",
    color: "#f8f4ec",
    accent: "#c0201a",
    technique: "perfect-freehand brush strokes + red seals",
  },
  {
    id: 15,
    name: "Wired Elements",
    desc: "Interfejs w stylu szkicu ołówkowego — biblioteka wired-elements jako główny element",
    emoji: "✏️",
    color: "#faf7f0",
    accent: "#1a1510",
    technique: "wired-elements web components",
  },
];

export default function PokazPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #faf5ee 0%, #f0e8d8 100%)",
        fontFamily: "'Patrick Hand', cursive",
        padding: "40px 24px 80px",
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h1
            style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: "clamp(48px, 8vw, 96px)",
              letterSpacing: 6,
              margin: 0,
              color: "#1a1510",
              lineHeight: 1,
            }}
          >
            POKAZ LAYOUTÓW
          </h1>
          <p
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 22,
              color: "#5a4a3a",
              marginTop: 12,
            }}
          >
            15 stylów interfejsu dla Polutek.pl — każdy unikalny, każdy ręcznie rysowany ✏️
          </p>
          <div
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "8px 20px",
              border: "2px solid #1a1510",
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 14,
              color: "#5a4a3a",
            }}
          >
            kliknij na layout aby zobaczyć wersję pełnoekranową
          </div>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 28,
          }}
        >
          {LAYOUTS.map((layout) => (
            <Link
              key={layout.id}
              href={`/eksperyment${layout.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  backgroundColor: layout.color,
                  border: `2px solid ${layout.accent}40`,
                  padding: 24,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px) rotate(-0.5deg)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `6px 8px 0 ${layout.accent}30`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "none";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                {/* Number badge */}
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: layout.accent,
                    color: layout.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Bebas Neue', cursive",
                    fontSize: 18,
                    letterSpacing: 0,
                  }}
                >
                  {layout.id}
                </div>

                {/* Emoji */}
                <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>{layout.emoji}</div>

                {/* Name */}
                <h2
                  style={{
                    fontFamily: "'Bebas Neue', cursive",
                    fontSize: 22,
                    letterSpacing: 2,
                    color: layout.accent,
                    margin: "0 0 8px 0",
                  }}
                >
                  {layout.name}
                </h2>

                {/* Desc */}
                <p
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: 15,
                    color: layout.accent,
                    opacity: 0.8,
                    margin: "0 0 12px 0",
                    lineHeight: 1.5,
                  }}
                >
                  {layout.desc}
                </p>

                {/* Technique tag */}
                <div
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    border: `1px solid ${layout.accent}60`,
                    fontFamily: "'Patrick Hand', cursive",
                    fontSize: 12,
                    color: layout.accent,
                    opacity: 0.7,
                  }}
                >
                  {layout.technique}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <div
          style={{
            textAlign: "center",
            marginTop: 60,
            fontFamily: "'Caveat', cursive",
            fontSize: 16,
            color: "#5a4a3a",
            opacity: 0.6,
          }}
        >
          Polutek.pl — eksperymentalne layouty 2026 ✨
          <br />
          roughjs · rough-notation · perfect-freehand · framer-motion · wired-elements
        </div>
      </div>
    </div>
  );
}
