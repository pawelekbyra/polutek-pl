// Client-safe: no imports from lib/modules (the admin-overview barrel pulls the Postgres driver into the browser bundle).
const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const fmtInt = (v: number) => nf0.format(Math.round(v));
const fmtOne = (v: number) => nf1.format(v);
const fmtPercent = (v: number, digits = 0) => `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: digits }).format(v)}%`;

/** Value kinds that can cross the server/client boundary (functions cannot), formatted the same everywhere. */
export type ValueFormat = "int" | "pct" | "one" | "sec" | "ms" | "h";

export function formatValue(v: number, f: ValueFormat): string {
  switch (f) {
    case "int":
      return fmtInt(v);
    case "pct":
      return fmtPercent(v, 1);
    case "one":
      return fmtOne(v);
    case "sec":
      return `${fmtOne(v)} s`;
    case "ms":
      return `${fmtInt(v)} ms`;
    case "h":
      return `${fmtOne(v)} h`;
  }
}

export const NO_MEASUREMENT = "bez pomiaru";
