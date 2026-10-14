"use client";

import { useLanguage } from "@/app/components/LanguageContext";
import type { VideoDetail } from "@/lib/modules/creator-analytics";
import { Card, ghostButtonClass } from "../ui";
import LineChart from "./LineChart";
import { FreshnessLabel, MetricCard, NotEnoughData } from "./AnalyticsParts";
import { formatDay, formatPercent, formatWatchTime } from "./analytics-format";

/** One video: totals, views per day, the reach curve (every 5% of its length) and who watched (guests/signed in). */
export default function AnalyticsVideoDetailView({ data, onBack }: { data: VideoDetail; onBack: () => void }) {
  const { tx, language } = useLanguage();
  const num = (n: number) => new Intl.NumberFormat(language).format(n);
  const t = data.totals;
  const avg = formatPercent(t.avgPctViewed, language);
  const curve = data.retention.points;
  const aud = data.audience;

  return (
    <div className="grid gap-4">
      <div>
        <button type="button" className={ghostButtonClass} onClick={onBack}>
          {tx("← Wszystkie filmy", "← All videos")}
        </button>
      </div>
      <Card title={data.video.title}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label={tx("Wyświetlenia", "Views")}
            value={num(t.views)}
            definition={tx("Odtworzenia zaliczone jako wyświetlenie (min. 10 sekund).", "Plays counted as a view (at least 10 seconds).")}
          />
          <MetricCard
            label={tx("Czas oglądania", "Watch time")}
            value={formatWatchTime(t.watchSeconds)}
            definition={tx("Suma czasu faktycznie obejrzanego w zaliczonych wyświetleniach.", "Total time actually watched in counted views.")}
          />
          <MetricCard
            label={tx("Średni % obejrzenia", "Average % viewed")}
            value={avg ?? <NotEnoughData minSample={data.minSample} />}
            definition={tx("Średnia z (czas obejrzany ÷ długość filmu), każde wyświetlenie do 100%.", "Average of (time watched ÷ video length), each view capped at 100%.")}
          />
          <MetricCard
            label={tx("Komentarze", "Comments")}
            value={num(t.comments)}
            definition={tx("Widoczne komentarze dodane w okresie.", "Visible comments added in the period.")}
          />
          <MetricCard
            label={tx("Polubienia", "Likes")}
            value={num(t.likes)}
            definition={tx("Polubienia dodane w okresie (nie suma od początku).", "Likes added in the period (not the all-time total).")}
          />
        </div>
        <div className="mt-3">
          <FreshnessLabel generatedAt={data.freshness.generatedAt} />
        </div>
      </Card>

      <Card title={tx("Wyświetlenia dzień po dniu", "Views per day")}>
        <LineChart
          title={tx("Wyświetlenia filmu dziennie", "Video views per day")}
          xLabels={data.daily.map((d) => formatDay(d.day, language))}
          series={[{ id: "views", label: tx("Wyświetlenia", "Views"), values: data.daily.map((d) => d.views) }]}
          formatValue={(n) => num(Math.round(n))}
          summary={tx("Wykres liniowy wyświetleń filmu; razem {0}.", "Line chart of the video's views; {0} in total.", num(t.views))}
          tableSummaryLabel={tx("Pokaż dane w tabeli", "Show the data as a table")}
          xColumnLabel={tx("Dzień (UTC)", "Day (UTC)")}
          emptyLabel={tx("Brak wyświetleń w tym okresie.", "No views in this period.")}
        />
      </Card>

      <Card title={tx("Dokąd widzowie docierają", "How far viewers get")}>
        <p className="mb-3 text-[12px] text-[var(--chan-muted)]">
          {tx(
            "Odsetek wyświetleń, które dotarły co najmniej do danego miejsca filmu (co 5% długości). To najdalsze miejsce, do którego doszedł widz; nie pokazuje przewijania ani powtórek.",
            "Share of views that reached at least that point of the video (every 5% of its length). It is the furthest point a viewer got to; it does not show skipping or replays.",
          )}
        </p>
        {curve ? (
          <LineChart
            title={tx("Odsetek wyświetleń, które dotarły do danego miejsca", "Share of views that reached each point")}
            xLabels={curve.map((p) => `${p.atPct}%`)}
            series={[{ id: "reach", label: tx("Dotarło", "Reached"), values: curve.map((p) => p.reachedPct) }]}
            formatValue={(n) => `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(n)}%`}
            summary={tx(
              "Krzywa dotarcia z {0} wyświetleń: do połowy filmu dociera {1}%, do końca {2}%.",
              "Reach curve from {0} views: {1}% get to the middle of the video, {2}% to the end.",
              num(data.retention.sessions),
              curve[10]?.reachedPct ?? 0,
              curve[curve.length - 1]?.reachedPct ?? 0,
            )}
            tableSummaryLabel={tx("Pokaż dane w tabeli", "Show the data as a table")}
            xColumnLabel={tx("Miejsce w filmie", "Position in the video")}
            emptyLabel={tx("Brak danych.", "No data.")}
          />
        ) : (
          <p className="rounded-xl bg-[var(--chan-surface)] px-3 py-6 text-center text-[13px] text-[var(--chan-muted)]">
            {data.retention.state === "no_data" ? (
              tx("Brak wyświetleń z poznaną długością filmu w tym okresie.", "No views with a known video length in this period.")
            ) : (
              <>
                <NotEnoughData minSample={data.minSample} />
                {" · "}
                {tx("{0} z wymaganych {1} wyświetleń.", "{0} of the {1} views needed.", data.retention.sessions, data.minSample)}
              </>
            )}
          </p>
        )}
      </Card>

      <Card title={tx("Kto ogląda", "Who is watching")}>
        <p className="mb-3 text-[12px] text-[var(--chan-muted)]">
          {tx(
            "Tylko liczby zbiorcze: nie pokazujemy, kim są widzowie. Subskrybenci to zalogowani widzowie, którzy teraz subskrybują Twój kanał.",
            "Aggregate counts only: we never show who the viewers are. Subscribers are signed-in viewers who currently subscribe to your channel.",
          )}
        </p>
        {aud.state === "ok" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard label={tx("Goście", "Guests")} value={num(aud.guestViews ?? 0)} definition={tx("Wyświetlenia bez logowania.", "Views without signing in.")} />
            <MetricCard label={tx("Zalogowani", "Signed in")} value={num(aud.signedInViews ?? 0)} definition={tx("Wyświetlenia z konta.", "Views from an account.")} />
            <MetricCard
              label={tx("w tym subskrybenci", "of which subscribers")}
              value={num(aud.subscriberViews ?? 0)}
              definition={tx("Wyświetlenia od obecnych subskrybentów.", "Views from current subscribers.")}
            />
          </div>
        ) : (
          <p className="text-[13px] text-[var(--chan-muted)]">
            {aud.state === "no_data" ? tx("Brak wyświetleń w tym okresie.", "No views in this period.") : <NotEnoughData minSample={data.minSample} />}
          </p>
        )}
      </Card>
    </div>
  );
}
