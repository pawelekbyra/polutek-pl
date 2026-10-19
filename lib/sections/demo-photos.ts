import { demoPhotoArt, type ArtKind, type ArtPalette } from "./demo-art";

/** DEMO data of the Photos prototype (no database): Polish and English texts, other UI languages use English. */
export type DemoPhoto = {
  id: string;
  src: string;
  caption: { pl: string; en: string };
  /** ISO date. */
  date: string;
  likes: number;
  comments: number;
};

const PALETTES: ArtPalette[] = [
  ["#fde68a", "#f97316", "#7c2d12"],
  ["#bfdbfe", "#2563eb", "#1e3a8a"],
  ["#fbcfe8", "#db2777", "#4c1d95"],
  ["#bbf7d0", "#16a34a", "#064e3b"],
  ["#e9d5ff", "#9333ea", "#312e81"],
  ["#fecaca", "#ef4444", "#7f1d1d"],
  ["#a5f3fc", "#0891b2", "#164e63"],
  ["#fed7aa", "#ea580c", "#431407"],
  ["#ddd6fe", "#6366f1", "#1e1b4b"],
];

const KINDS: ArtKind[] = ["sun", "waves", "mountains", "dots", "rings", "stripes", "blob", "grid"];

const CAPTIONS: { pl: string; en: string }[] = [
  { pl: "Złota godzina nad wodą.", en: "Golden hour over the water." },
  { pl: "Poranek, kawa i plan na dzień.", en: "Morning, coffee and a plan for the day." },
  { pl: "Za kulisami najnowszego odcinka.", en: "Behind the scenes of the latest episode." },
  { pl: "Spacer, który skończył się pomysłem.", en: "A walk that ended in an idea." },
  { pl: "Kolory, które dają energię.", en: "Colors that give energy." },
  { pl: "Test nowego kadru.", en: "Testing a new frame." },
  { pl: "Cisza przed nagraniem.", en: "The calm before recording." },
  { pl: "Wzory, które lubię.", en: "Patterns I like." },
  { pl: "Szkic do okładki.", en: "A sketch for the cover." },
  { pl: "Wieczór w studiu.", en: "An evening in the studio." },
  { pl: "Małe rzeczy, duży efekt.", en: "Small things, big effect." },
  { pl: "Dzięki, że jesteście!", en: "Thanks for being here!" },
  { pl: "Światło, które lubię najbardziej.", en: "The light I like best." },
  { pl: "Nowy rozdział zaczyna się dziś.", en: "A new chapter starts today." },
  { pl: "Inspiracje z podróży.", en: "Inspiration from a trip." },
  { pl: "Dzień zdjęciowy.", en: "Shoot day." },
  { pl: "Chwila oddechu.", en: "A moment to breathe." },
  { pl: "Do zobaczenia w kolejnym filmie.", en: "See you in the next video." },
];

export const DEMO_PHOTOS: readonly DemoPhoto[] = CAPTIONS.map((caption, i) => {
  const day = String(1 + ((i * 5) % 27)).padStart(2, "0");
  const month = String(10 - Math.floor(i / 6)).padStart(2, "0");
  return {
    id: `p${i + 1}`,
    src: demoPhotoArt(KINDS[i % KINDS.length] as ArtKind, PALETTES[i % PALETTES.length] as ArtPalette, 40 + ((i * 37) % 280)),
    caption,
    date: `2026-${month}-${day}`,
    likes: 120 + ((i * 97) % 880),
    comments: 3 + ((i * 13) % 40),
  };
});

export const DEMO_PROFILE = { followers: 12400, following: 87 } as const;
