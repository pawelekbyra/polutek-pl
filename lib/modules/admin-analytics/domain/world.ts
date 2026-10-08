/**
 * Pure rules of the "Świat" map (docs/architecture/admin-world-map.md): how many colour classes, where their
 * limits are, which class a country falls into, and the "conquest" timeline (the day each country was seen for
 * the first time). No I/O, no clock.
 */

/** Ceiling of the colour classes: the design system's sequential scale has 7 steps, the first is "no data". */
export const WORLD_MAX_CLASSES = 6;

/** "Nice" limits 1, 2, 5, 10, 20, 50 ... (each class starts at one of them). */
function niceSequence(max: number): number[] {
  const out: number[] = [];
  for (let p = 1; p <= Math.max(1, max); p *= 10) {
    for (const m of [1, 2, 5]) {
      const v = m * p;
      if (v <= max) out.push(v);
    }
  }
  return out.length ? out : [1];
}

/**
 * Lower limits of the classes for values 1..max. Web traffic by country is extremely skewed (one home country,
 * a long tail of ones and twos), so the limits grow geometrically: equal intervals would paint every country
 * but one in the lightest colour. At most WORLD_MAX_CLASSES classes: when the sequence is longer, every other
 * limit is dropped, always keeping 1. Empty or zero data gives a single class [1].
 */
export function worldClassBreaks(max: number): number[] {
  if (!Number.isFinite(max) || max < 1) return [1];
  let seq = niceSequence(Math.floor(max));
  while (seq.length > WORLD_MAX_CLASSES) seq = seq.filter((_, i) => i % 2 === 0);
  return seq;
}

/** Polish plural of "kraj": 1 kraj, 2-4 kraje (but 12-14 krajów), 5+ krajów. */
export function countriesWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (n === 1) return "kraj";
  return m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? "kraje" : "krajów";
}

/** Class 1..breaks.length of a value; 0 = no visitors (drawn as "brak danych"). */
export function worldClassOf(value: number, breaks: number[]): number {
  if (!(value >= 1)) return 0;
  let cls = 1;
  for (let i = 0; i < breaks.length; i++) if (value >= breaks[i]) cls = i + 1;
  return cls;
}

export type WorldClass = { cls: number; from: number; to: number | null; label: string };

/** Legend of the classes: "1", "2–4", "5–9", "10+" ... (the last class is open). */
export function worldClassLegend(breaks: number[], fmt: (v: number) => string = String): WorldClass[] {
  return breaks.map((from, i) => {
    const next = breaks[i + 1];
    const to = next === undefined ? null : next - 1;
    const label = to === null ? `${fmt(from)}+` : to === from ? fmt(from) : `${fmt(from)}–${fmt(to)}`;
    return { cls: i + 1, from, to, label };
  });
}

export type FirstSeenRow = { code: string; firstDay: string };
export type ConquestStep = { day: string; codes: string[]; total: number };

/**
 * Days on which new countries appeared, in order, with the running total. Unknown codes ("??") never count:
 * a country is only "conquered" when we know which one it is.
 */
export function conquestSteps(rows: FirstSeenRow[]): ConquestStep[] {
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    if (!/^[A-Z]{2}$/.test(r.code) || !/^\d{4}-\d{2}-\d{2}$/.test(r.firstDay)) continue;
    const list = byDay.get(r.firstDay) ?? [];
    list.push(r.code);
    byDay.set(r.firstDay, list);
  }
  let total = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, codes]) => {
      total += codes.length;
      return { day, codes: codes.sort(), total };
    });
}

/**
 * Running total of known countries on each of the given days (keys "YYYY-MM-DD", sorted), for the line
 * "kraje w czasie". Days before the first measurement are null ("bez pomiaru"), never 0.
 */
export function conquestSeries(steps: ConquestStep[], days: string[], firstMeasuredDay: string | null): (number | null)[] {
  let i = 0;
  let total = 0;
  return days.map((day) => {
    while (i < steps.length && steps[i].day <= day) {
      total = steps[i].total;
      i++;
    }
    if (firstMeasuredDay && day < firstMeasuredDay) return null;
    return total;
  });
}
