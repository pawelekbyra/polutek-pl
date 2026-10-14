"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import type { AnalyticsOverview, AnalyticsVideoList, VideoDetail } from "@/lib/modules/creator-analytics";
import { StudioApiError, studioApi } from "./studio-client";
import { Card, Notice, focusRingClass, ghostButtonClass } from "./ui";
import AnalyticsOverviewView from "./analytics/AnalyticsOverviewView";
import AnalyticsVideosView from "./analytics/AnalyticsVideosView";
import AnalyticsVideoDetailView from "./analytics/AnalyticsVideoDetailView";

const RANGES = [7, 28, 90] as const;
type Tab = "overview" | "videos";

type Loaded<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

function useStudioData<T>(path: string): Loaded<T> {
  const { tx } = useLanguage();
  const [result, setResult] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    setResult({ state: "loading" });
    studioApi<T>(path)
      .then((data) => !cancelled && setResult({ state: "ready", data }))
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof StudioApiError ? e.message : tx("Nie udało się wczytać statystyk.", "Could not load the statistics.");
        setResult({ state: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [path, tx]);
  return result;
}

/**
 * Studio "Statystyki": overview, per-video table and a video detail for one period (7, 28 or 90 days). All numbers
 * come from `/api/studio/analytics/*` (authorized per channel on the server); this component only presents them.
 */
export default function StudioAnalytics() {
  const { tx } = useLanguage();
  const [range, setRange] = useState<(typeof RANGES)[number]>(28);
  const [tab, setTab] = useState<Tab>("overview");
  const [videoId, setVideoId] = useState<string | null>(null);

  const rangeLabel = (r: number) => tx("{0} dni", "{0} days", r);

  return (
    <div className="grid gap-4">
      <Card title={tx("Statystyki", "Statistics")}>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={tx("Okres", "Period")} className="flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold transition ${focusRingClass} ${
                  range === r ? "bg-[var(--chan-ink)] text-[var(--chan-card)]" : "border border-[var(--chan-line)] text-[var(--chan-ink)] hover:bg-[var(--chan-surface)]"
                }`}
              >
                {rangeLabel(r)}
              </button>
            ))}
          </div>
          <div className="mx-1 hidden h-5 w-px bg-[var(--chan-line)] sm:block" aria-hidden="true" />
          <div role="group" aria-label={tx("Widok", "View")} className="flex flex-wrap gap-1">
            {(["overview", "videos"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={videoId === null && tab === id}
                onClick={() => {
                  setTab(id);
                  setVideoId(null);
                }}
                className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold transition ${focusRingClass} ${
                  videoId === null && tab === id ? "bg-[var(--chan-surface)] text-[var(--chan-ink)] ring-1 ring-[var(--chan-line)]" : "text-[var(--chan-muted)] hover:bg-[var(--chan-surface)]"
                }`}
              >
                {id === "overview" ? tx("Przegląd", "Overview") : tx("Filmy", "Videos")}
              </button>
            ))}
          </div>
          <a className={`${ghostButtonClass} ml-auto`} href={`/api/studio/analytics/export?range=${range}&kind=daily`} download>
            {tx("Pobierz CSV (dzień po dniu)", "Download CSV (daily)")}
          </a>
        </div>
        <p className="mt-3 text-[12px] text-[var(--chan-muted)]">
          {tx(
            "Okres liczymy w dniach UTC, łącznie z dzisiejszym. Wyświetlenie to odtwarzanie dłuższe niż 10 sekund; twoje własne podglądy się nie liczą. Nie pokazujemy danych osobowych widzów, a wartości z małej próby (poniżej 10 wyświetleń) są ukryte.",
            "The period is counted in UTC days, including today. A view is a play longer than 10 seconds; your own previews are not counted. We show no personal data about viewers, and values from a small sample (under 10 views) are hidden.",
          )}
        </p>
      </Card>

      {videoId ? (
        <DetailPane range={range} videoId={videoId} onBack={() => setVideoId(null)} />
      ) : tab === "overview" ? (
        <OverviewPane range={range} />
      ) : (
        <VideosPane range={range} onOpen={setVideoId} />
      )}
    </div>
  );
}

function Pending({ loaded }: { loaded: Loaded<unknown> }) {
  const { tx } = useLanguage();
  if (loaded.state === "error") return <Notice kind="error">{loaded.message}</Notice>;
  return <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję statystyki…", "Loading statistics…")}</p>;
}

function OverviewPane({ range }: { range: number }) {
  const loaded = useStudioData<AnalyticsOverview>(`/api/studio/analytics/overview?range=${range}`);
  return loaded.state === "ready" ? <AnalyticsOverviewView data={loaded.data} /> : <Pending loaded={loaded} />;
}

function VideosPane({ range, onOpen }: { range: number; onOpen: (id: string) => void }) {
  const loaded = useStudioData<AnalyticsVideoList>(`/api/studio/analytics/videos?range=${range}`);
  return loaded.state === "ready" ? <AnalyticsVideosView data={loaded.data} onOpen={onOpen} /> : <Pending loaded={loaded} />;
}

function DetailPane({ range, videoId, onBack }: { range: number; videoId: string; onBack: () => void }) {
  const loaded = useStudioData<VideoDetail>(`/api/studio/analytics/videos/${encodeURIComponent(videoId)}?range=${range}`);
  return loaded.state === "ready" ? <AnalyticsVideoDetailView data={loaded.data} onBack={onBack} /> : <Pending loaded={loaded} />;
}
