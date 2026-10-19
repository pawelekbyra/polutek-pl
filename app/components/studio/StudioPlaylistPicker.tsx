"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { jsonBody, studioApi, type StudioVideoList } from "./studio-client";
import { Card, Field, inputClass, smallButtonClass } from "./ui";
import { errorText } from "./StudioPlaylistForm";

/** "Add videos" of a playlist: a search over the channel's own videos (`/api/studio/videos`), already added ones are hidden. */
export default function StudioPlaylistPicker({ playlistId, present, onAdded, onError }: { playlistId: string; present: Set<string>; onAdded: () => Promise<void>; onError: (message: string | null) => void }) {
  const { tx } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudioVideoList["items"] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "30", sort: "newest" });
        if (query.trim()) params.set("q", query.trim());
        const data = await studioApi<StudioVideoList>(`/api/studio/videos?${params.toString()}`);
        if (!cancelled) setResults(data.items);
      } catch (e) {
        if (!cancelled) onError(errorText(e, tx("Nie udało się wczytać filmów.", "Could not load the videos.")));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, tx, onError]);

  const add = async (videoId: string) => {
    setBusyId(videoId);
    try {
      await studioApi(`/api/studio/playlists/${encodeURIComponent(playlistId)}/items`, { method: "POST", ...jsonBody({ videoId }) });
      onError(null);
      await onAdded();
    } catch (e) {
      onError(errorText(e, tx("Nie udało się dodać filmu.", "Could not add the video.")));
    } finally {
      setBusyId(null);
    }
  };

  const available = (results ?? []).filter((video) => !present.has(video.id));

  return (
    <Card title={tx("Dodaj filmy", "Add videos")}>
      <Field label={tx("Szukaj w swoich filmach", "Search your videos")} htmlFor="playlist-picker-search">
        <input id="playlist-picker-search" type="search" className={inputClass} value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      <div className="mt-3">
        {results === null ? (
          <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>
        ) : available.length === 0 ? (
          <p className="text-[14px] text-[var(--chan-muted)]">
            {query.trim() ? tx("Żaden film nie pasuje do wyszukiwania.", "No video matches your search.") : tx("Wszystkie Twoje filmy są już na tej playliście.", "All your videos are already on this playlist.")}
          </p>
        ) : (
          <ul className="grid gap-2">
            {available.map((video) => (
              <li key={video.id} className="flex items-center gap-3 rounded-2xl border border-[var(--chan-line)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnailUrl || `/api/videos/${encodeURIComponent(video.id)}/thumbnail`} alt="" width={96} height={54} loading="lazy" className="h-[40px] w-[72px] shrink-0 rounded-lg bg-[var(--chan-surface)] object-cover" />
                <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--chan-ink)]">{video.title}</p>
                <button type="button" className={smallButtonClass} disabled={busyId !== null} onClick={() => void add(video.id)}>
                  {tx("Dodaj", "Add")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
