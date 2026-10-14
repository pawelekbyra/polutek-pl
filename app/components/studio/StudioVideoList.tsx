"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { StudioApiError, studioApi, studioThumbnailSrc, type StudioVideo, type StudioVideoList as VideoListData } from "./studio-client";
import { buildVideoListQuery, type SortKey, type StatusFilter } from "./video-form";
import { Badge, Card, Notice, buttonClass, ghostButtonClass, inputClass } from "./ui";

const PAGE_SIZE = 20;

/** Studio -> Content list: search by title, status filter, sort and paging; thumbnails on the left. */
export default function StudioVideoList({ onUpload, onEdit }: { onUpload: () => void; onEdit: (id: string) => void }) {
  const { tx, language } = useLanguage();
  const [list, setList] = useState<VideoListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  // The search box is applied a moment after typing stops, so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    studioApi<VideoListData>(`/api/studio/videos?${buildVideoListQuery({ q, status, sort, page, limit: PAGE_SIZE })}`)
      .then((data) => {
        if (cancelled) return;
        setList(data);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof StudioApiError ? e.message : tx("Nie udało się wczytać filmów.", "Could not load videos.")));
    return () => {
      cancelled = true;
    };
  }, [q, status, sort, page, tx]);

  const statusLabel: Record<StudioVideo["status"], string> = {
    DRAFT: tx("Szkic", "Draft"),
    PUBLISHED: tx("Opublikowany", "Published"),
    UNLISTED: tx("Niepubliczny", "Unlisted"),
    ARCHIVED: tx("Zarchiwizowany", "Archived"),
  };
  const filtered = q !== "" || status !== "ALL";

  return (
    <Card
      title={tx("Twoje filmy", "Your videos")}
      actions={
        <button type="button" className={buttonClass} onClick={onUpload}>
          {tx("Prześlij film", "Upload a video")}
        </button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="grid gap-1">
          <label htmlFor="vl-search" className="text-[13px] font-semibold text-[var(--chan-ink)]">
            {tx("Szukaj po tytule", "Search by title")}
          </label>
          <input id="vl-search" type="search" className={inputClass} value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label htmlFor="vl-status" className="text-[13px] font-semibold text-[var(--chan-ink)]">
            {tx("Status", "Status")}
          </label>
          <select
            id="vl-status"
            className={inputClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="ALL">{tx("Wszystkie", "All")}</option>
            <option value="DRAFT">{tx("Szkice", "Drafts")}</option>
            <option value="PUBLISHED">{tx("Opublikowane", "Published")}</option>
            <option value="UNLISTED">{tx("Niepubliczne", "Unlisted")}</option>
            <option value="ARCHIVED">{tx("Zarchiwizowane", "Archived")}</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="vl-sort" className="text-[13px] font-semibold text-[var(--chan-ink)]">
            {tx("Sortuj", "Sort by")}
          </label>
          <select
            id="vl-sort"
            className={inputClass}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              setPage(1);
            }}
          >
            <option value="newest">{tx("Najnowsze", "Newest")}</option>
            <option value="views">{tx("Wyświetlenia", "Views")}</option>
          </select>
        </div>
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {!list && !error && <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>}
      {list && list.items.length === 0 && (
        <p className="text-[14px] text-[var(--chan-muted)]">
          {filtered
            ? tx("Żaden film nie pasuje do wybranych filtrów.", "No video matches the selected filters.")
            : tx("Nie masz jeszcze żadnych filmów. Prześlij pierwszy.", "You have no videos yet. Upload your first one.")}
        </p>
      )}
      {list && list.items.length > 0 && (
        <>
          <p className="mb-2 text-[12px] text-[var(--chan-muted)]" role="status">
            {tx("Filmów: {0}", "Videos: {0}", list.total)}
          </p>
          <ul className="divide-y divide-[var(--chan-line)]">
            {list.items.map((video) => (
              <li key={video.id} className="flex flex-wrap items-center gap-3 py-3">
                {/* The list DTO's thumbnailUrl is already a public src (proxy path or public bucket URL). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={studioThumbnailSrc(video)}
                  alt=""
                  loading="lazy"
                  width={160}
                  height={90}
                  className="h-[54px] w-24 shrink-0 rounded-none bg-[var(--chan-surface)] object-cover sm:h-[72px] sm:w-32"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[var(--chan-ink)]">{video.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--chan-muted)]">
                    <Badge tone={video.status === "PUBLISHED" ? "good" : "neutral"}>{statusLabel[video.status]}</Badge>
                    {video.isAdult && <Badge tone="warn">18+</Badge>}
                    <span>{video.tier === "PUBLIC" ? tx("Dla wszystkich", "Public") : tx("Dla zalogowanych", "Signed-in only")}</span>
                    <span>{tx("{0} wyświetleń", "{0} views", video.views)}</span>
                    {typeof video.commentsCount === "number" && <span>{tx("Komentarze: {0}", "Comments: {0}", video.commentsCount)}</span>}
                    <span>{tx("Dodano {0}", "Added {0}", new Date(video.createdAt).toLocaleDateString(language))}</span>
                  </p>
                </div>
                <button type="button" className={ghostButtonClass} onClick={() => onEdit(video.id)}>
                  {tx("Edytuj", "Edit")}
                </button>
              </li>
            ))}
          </ul>
          {list.totalPages > 1 && (
            <nav className="mt-4 flex flex-wrap items-center gap-3" aria-label={tx("Strony listy filmów", "Video list pages")}>
              <button type="button" className={ghostButtonClass} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {tx("Poprzednia", "Previous")}
              </button>
              <span className="text-[13px] text-[var(--chan-muted)]">{tx("Strona {0} z {1}", "Page {0} of {1}", list.page, list.totalPages)}</span>
              <button type="button" className={ghostButtonClass} disabled={page >= list.totalPages} onClick={() => setPage(page + 1)}>
                {tx("Następna", "Next")}
              </button>
            </nav>
          )}
        </>
      )}
    </Card>
  );
}
