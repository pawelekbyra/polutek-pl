"use client";

import { useLanguage } from "@/app/components/LanguageContext";
import type { AnalyticsOverview } from "@/lib/modules/creator-analytics";
import { Card } from "../ui";
import LineChart from "./LineChart";
import { FreshnessLabel, MetricCard, NotEnoughData } from "./AnalyticsParts";
import { formatDay, formatDelta, formatPercent, formatWatchTime } from "./analytics-format";

/** Cards plus two charts (views, subscribers) for the whole channel. */
export default function AnalyticsOverviewView({ data }: { data: AnalyticsOverview }) {
  const { tx, language } = useLanguage();
  const num = (n: number) => new Intl.NumberFormat(language).format(n);
  const { totals, subscribers } = data;
  const avg = formatPercent(totals.avgPctViewed, language);
  const dayLabels = data.daily.map((d) => formatDay(d.day, language));
  // Today always carries the live count; the question is whether any earlier day has a record.
  const noSubs = data.daily.slice(0, -1).every((d) => d.subscribers === null);

  return (
    <div className="grid gap-4">
      <Card title={tx("Podsumowanie okresu", "Period summary")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label={tx("Wyświetlenia", "Views")}
            value={num(totals.views)}
            definition={tx(
              "Odtworzenia zaliczone jako wyświetlenie (film oglądany co najmniej 10 sekund). Twoje podglądy się nie liczą.",
              "Plays counted as a view (watched for at least 10 seconds). Your own previews are not counted.",
            )}
          />
          <MetricCard
            label={tx("Czas oglądania", "Watch time")}
            value={formatWatchTime(totals.watchSeconds)}
            definition={tx(
              "Suma czasu faktycznie obejrzanego we wszystkich zaliczonych wyświetleniach.",
              "Total time actually watched across all counted views.",
            )}
          />
          <MetricCard
            label={tx("Średni % obejrzenia", "Average % viewed")}
            value={avg ?? <NotEnoughData minSample={data.minSample} />}
            definition={tx(
              "Średnia z (czas obejrzany ÷ długość filmu) po jednym wyświetleniu, każde ograniczone do 100%.",
              "Average of (time watched ÷ video length) per view, each capped at 100%.",
            )}
          />
          <MetricCard
            label={tx("Subskrybenci", "Subscribers")}
            value={num(subscribers.current)}
            definition={tx("Bieżąca liczba subskrybentów kanału.", "Current number of channel subscribers.")}
            note={
              subscribers.net === null
                ? tx("Zmiana w okresie: brak zapisu z dnia poprzedzającego okres.", "Change in period: no record from the day before the period.")
                : tx("Zmiana w okresie: {0}", "Change in period: {0}", formatDelta(subscribers.net, language))
            }
          />
          <MetricCard
            label={tx("Nowi subskrybenci", "New subscribers")}
            value={num(subscribers.gained)}
            definition={tx(
              "Subskrypcje założone w okresie, które nadal trwają (kto zdążył odejść w tym samym okresie, nie jest tu policzony).",
              "Subscriptions made in the period that are still active (anyone who left within the same period is not counted).",
            )}
          />
          <MetricCard
            label={tx("Utraceni subskrybenci", "Lost subscribers")}
            value={subscribers.lost === null ? "–" : num(subscribers.lost)}
            definition={tx(
              "Subskrybenci sprzed okresu, którzy odeszli: nowi minus zmiana netto. Wymaga zapisu z dnia przed okresem.",
              "Subscribers from before the period who left: new minus net change. Needs a record from the day before the period.",
            )}
          />
          <MetricCard
            label={tx("Komentarze", "Comments")}
            value={num(totals.comments)}
            definition={tx(
              "Widoczne komentarze dodane pod Twoimi filmami w okresie (z odpowiedziami).",
              "Visible comments added under your videos in the period (replies included).",
            )}
          />
        </div>
        <div className="mt-3">
          <FreshnessLabel generatedAt={data.freshness.generatedAt} subscribersSnapshotDay={data.freshness.subscribersSnapshotDay} />
        </div>
      </Card>

      <Card title={tx("Wyświetlenia dzień po dniu", "Views per day")}>
        <LineChart
          title={tx("Wyświetlenia dziennie", "Views per day")}
          xLabels={dayLabels}
          series={[{ id: "views", label: tx("Wyświetlenia", "Views"), values: data.daily.map((d) => d.views) }]}
          formatValue={(n) => num(Math.round(n))}
          summary={tx(
            "Wykres liniowy wyświetleń z {0} dni; razem {1}.",
            "Line chart of views over {0} days; {1} in total.",
            data.daily.length,
            num(totals.views),
          )}
          tableSummaryLabel={tx("Pokaż dane w tabeli", "Show the data as a table")}
          xColumnLabel={tx("Dzień (UTC)", "Day (UTC)")}
          emptyLabel={tx("Brak wyświetleń w tym okresie.", "No views in this period.")}
        />
      </Card>

      <Card title={tx("Subskrybenci w czasie", "Subscribers over time")}>
        {noSubs && (
          <p className="mb-2 text-[12px] text-[var(--chan-muted)]">
            {tx(
              "Zapis liczby subskrybentów robimy raz dziennie; dni bez zapisu zostają puste, niczego nie zgadujemy.",
              "We record the subscriber count once a day; days without a record stay empty, nothing is guessed.",
            )}
          </p>
        )}
        <LineChart
          title={tx("Subskrybenci na koniec dnia", "Subscribers at the end of the day")}
          xLabels={dayLabels}
          series={[{ id: "subs", label: tx("Subskrybenci", "Subscribers"), values: data.daily.map((d) => d.subscribers) }]}
          formatValue={(n) => num(Math.round(n))}
          summary={tx(
            "Wykres liniowy liczby subskrybentów; dziś {0}.",
            "Line chart of the subscriber count; today {0}.",
            num(subscribers.current),
          )}
          tableSummaryLabel={tx("Pokaż dane w tabeli", "Show the data as a table")}
          xColumnLabel={tx("Dzień (UTC)", "Day (UTC)")}
          emptyLabel={tx("Brak zapisów subskrybentów w tym okresie.", "No subscriber records in this period.")}
        />
      </Card>
    </div>
  );
}
