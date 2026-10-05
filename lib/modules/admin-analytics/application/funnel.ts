/**
 * Lejek (B6, z liczb w bazie) i atrybucja (B7): wejście -> konto -> komentarz -> napiwek. Konta, komentarze i napiwki
 * to dokładne liczby z bazy serwisu; "wejścia" to telemetria (może być "bez pomiaru"). Kroki 2-4 są kohortą: konta
 * założone w okresie i to, ile z nich kiedykolwiek skomentowało / wpłaciło. Źródła kont i napiwków (atrybucja per
 * źródło) nie są zapisywane przy rejestracji, więc ta część jest jawnie "bez pomiaru".
 */
import { bucketIndex, type CompareKey, type RangeKey } from "@/lib/modules/admin-overview";
import { biggestLoss, buildFunnel } from "../domain/funnel";
import { sampleLevel } from "../domain/qoe";
import type { FunnelDto } from "../domain/types";
import { freshness, timeSeries, unavailable, type Availability } from "./common";
import type { AnalyticsDeps } from "./deps";
import { makePeriod, type Period, type Side } from "./period";

function bucketCounts(period: Period, side: Side, dates: Date[]): number[] {
  const counts = new Array<number>(side.buckets.length).fill(0);
  const shift = side === period.current ? 0 : side.buckets[0].start.getTime() - period.current.buckets[0].start.getTime();
  for (const d of dates) {
    const at = new Date(d.getTime() - shift);
    const i = bucketIndex(period.windows, at);
    if (i >= 0) counts[i]++;
  }
  return counts;
}

export async function getFunnel(deps: AnalyticsDeps, input: { range: RangeKey; compare: CompareKey }): Promise<Availability<FunnelDto>> {
  try {
    const period = makePeriod(input.range, input.compare, deps.now());
    const { from, to } = period.current;
    const [cohort, accountsAt, tipsAt, prevTips, visitors, fresh] = await Promise.all([
      deps.app.accountCohort(from, to),
      deps.app.accountsCreatedAt(from, to),
      deps.app.paymentsCreatedAt(from, to),
      period.previous ? deps.app.paymentsCreatedAt(period.previous.from, period.previous.to) : Promise.resolve(null),
      deps.telemetry ? deps.telemetry.trafficDaily(period.current.fromDay, period.current.toDay).then((r) => (r.length ? r.reduce((a, x) => a + x.visitors, 0) : null)).catch(() => null) : Promise.resolve(null),
      deps.telemetry ? freshness(deps).catch(() => null) : Promise.resolve(null),
    ]);
    const steps = buildFunnel([
      { key: "visitors", label: "Odwiedzający", count: visitors, hint: "Suma dobowych unikalnych z telemetrii; bez pomiaru, gdy telemetria nic nie zebrała." },
      { key: "accounts", label: "Nowe konta", count: cohort.accounts, hint: "Konta założone w okresie (bez usuniętych)." },
      { key: "commenters", label: "…z komentarzem", count: cohort.commenters, hint: "Z kont założonych w okresie: ile napisało kiedykolwiek komentarz." },
      { key: "tippers", label: "…z napiwkiem", count: cohort.tippers, hint: "Z kont założonych w okresie: ile wpłaciło kiedykolwiek (opłacone i częściowo zwrócone)." },
    ]);
    const loss = biggestLoss(steps);
    const accounts = bucketCounts(period, period.current, accountsAt);
    const tips = bucketCounts(period, period.current, tipsAt);
    return {
      available: true,
      data: {
        rangeLabel: period.windows.label,
        steps,
        lossHint: loss ? `Największa strata: „${steps[loss.index].label}” (${Math.round(loss.lostPct)}% odpada względem poprzedniego kroku).` : null,
        tipsInPeriod: tipsAt.length,
        tipsPrevious: prevTips ? prevTips.length : null,
        accounts: timeSeries(period, accounts, null),
        tips: timeSeries(period, tips, null),
        sample: sampleLevel(tipsAt.length, 30),
        attribution: {
          available: false,
          reason: "Źródło konta i napiwku nie jest zapisywane przy rejestracji ani w metadanych płatności, a telemetria celowo nie łączy wizyt z kontami. Atrybucja per źródło wymaga zapisu pierwszego źródła w serwisie (T11), poza zakresem fazy A.",
        },
        notes: [
          "Kroki 2-4 to kohorta: konta założone w okresie i ich późniejsze komentarze oraz napiwki (mogą wydarzyć się po końcu okresu, do teraz).",
          "Telemetria jest anonimowa i nie łączy odwiedzin z kontami, dlatego procent „odwiedzający → konto” jest orientacyjnym stosunkiem dwóch niezależnych liczb, nie ścieżką jednej osoby.",
        ],
        freshness: fresh ?? { rollupAt: null, firstDay: null, coverageDays: 0 },
      },
    };
  } catch (error) {
    return unavailable(`Odczyt z bazy nie powiódł się (${error instanceof Error ? error.name : "błąd"}).`);
  }
}
