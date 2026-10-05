import { fmtInt, fmtOne, fmtPercent } from "@/lib/modules/admin-overview";

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
