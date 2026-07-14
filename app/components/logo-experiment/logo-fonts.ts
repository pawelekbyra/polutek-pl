/*
 * TEMPORARY logo font bake-off registry (/logo1 … /logo20).
 * Each entry maps a route slug to a self-hosted @font-face family (see
 * app/logo-fonts.css). `egg` marks the last five, which show a lucide Egg icon
 * to the left of the wordmark. Delete this whole directory once a font is chosen.
 */
export interface LogoFontDef {
  /** Route slug, e.g. "logo7". */
  slug: string;
  /** Human label shown on the comparison badge. */
  label: string;
  /** CSS font-family value applied to the wordmark. */
  family: string;
  /** When true, render a leading lucide Egg icon. */
  egg?: boolean;
}

export const LOGO_FONTS: LogoFontDef[] = [
  { slug: "logo1", label: "Frijole", family: "'Frijole', sans-serif" },
  { slug: "logo2", label: "Bowlby One SC", family: "'Bowlby One SC', sans-serif" },
  { slug: "logo3", label: "Bebas Neue", family: "'Bebas Neue', sans-serif" },
  { slug: "logo4", label: "Anton", family: "'Anton', sans-serif" },
  { slug: "logo5", label: "Archivo Black", family: "'Archivo Black', sans-serif" },
  { slug: "logo6", label: "Righteous", family: "'Righteous', sans-serif" },
  { slug: "logo7", label: "Passion One", family: "'Passion One', sans-serif" },
  { slug: "logo8", label: "Titan One", family: "'Titan One', sans-serif" },
  { slug: "logo9", label: "Bungee", family: "'Bungee', sans-serif" },
  { slug: "logo10", label: "Alfa Slab One", family: "'Alfa Slab One', serif" },
  { slug: "logo11", label: "Luckiest Guy", family: "'Luckiest Guy', sans-serif" },
  { slug: "logo12", label: "Staatliches", family: "'Staatliches', sans-serif" },
  { slug: "logo13", label: "Rubik Mono One", family: "'Rubik Mono One', monospace" },
  { slug: "logo14", label: "Russo One", family: "'Russo One', sans-serif" },
  { slug: "logo15", label: "Fjalla One", family: "'Fjalla One', sans-serif" },
  { slug: "logo16", label: "Sigmar One", family: "'Sigmar One', sans-serif", egg: true },
  { slug: "logo17", label: "Black Ops One", family: "'Black Ops One', sans-serif", egg: true },
  { slug: "logo18", label: "Monoton", family: "'Monoton', sans-serif", egg: true },
  { slug: "logo19", label: "Paytone One", family: "'Paytone One', sans-serif", egg: true },
  { slug: "logo20", label: "Teko", family: "'Teko', sans-serif", egg: true },
];

export function getLogoFont(slug: string): LogoFontDef | undefined {
  return LOGO_FONTS.find((font) => font.slug === slug);
}
