import Link from "next/link";

const TABS = [
  ["ruch", "Ruch i źródła"],
  ["swiat", "Świat"],
  ["lejek", "Lejek i atrybucja"],
  ["ogladalnosc", "Oglądalność"],
  ["jakosc", "Jakość odtwarzania"],
] as const;

export type AnalyticsTab = (typeof TABS)[number][0];

export const parseTab = (raw: string | undefined): AnalyticsTab => (TABS.some(([id]) => id === raw) ? (raw as AnalyticsTab) : "ruch");

/** Tabs of the Analityka screen; the global period (`range`, `cmp`) is carried over in the links. */
export function AnalyticsTabs({ current, query }: { current: AnalyticsTab; query: Record<string, string | undefined> }) {
  const keep = new URLSearchParams();
  for (const k of ["range", "cmp"]) if (query[k]) keep.set(k, query[k]!);
  return (
    <nav className="tabs" aria-label="Sekcje analityki">
      {TABS.map(([id, label]) => {
        const q = new URLSearchParams(keep);
        if (id !== "ruch") q.set("tab", id);
        const qs = q.toString();
        return (
          <Link key={id} href={`/analityka${qs ? `?${qs}` : ""}`} aria-current={id === current ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
