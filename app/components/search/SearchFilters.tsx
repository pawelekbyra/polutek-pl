"use client";

import { useRef, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/components/LanguageContext";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { buildSearchQuery } from "@/lib/search-href";
import { VIDEO_CATEGORIES } from "@/lib/video-metadata";
import { videoCategoryLabel } from "@/lib/video-category-label";
import { SEARCH_DURATIONS, SEARCH_SORTS, SEARCH_UPLOADED } from "@/lib/search-options";

export interface SearchFiltersValue {
  q: string;
  category: string;
  duration: string;
  uploaded: string;
  sort: string;
  /** Filters that have no control here (tag, channel) travel with the form so applying a filter does not drop them. */
  tag: string;
  channel: string;
}

const fieldClass =
  "h-10 min-w-0 rounded-full border border-[var(--chan-line)] bg-[var(--chan-card)] px-4 text-sm text-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]";

/**
 * Search form: works as a plain GET form without JavaScript; with it, a change applies at once through a client
 * navigation and the status line says "Searching…" while the server renders the new results.
 */
export default function SearchFilters({ value }: { value: SearchFiltersValue }) {
  const { language, tx } = useLanguage();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (name: string) => String(data.get(name) ?? "").trim();
    const href = `${getLocalizedHref(language, "search")}?${buildSearchQuery({
      q: get("q"),
      category: get("category"),
      tag: get("tag"),
      channel: get("channel"),
      duration: get("duration"),
      uploaded: get("uploaded"),
      sort: get("sort"),
    })}`;
    startTransition(() => router.push(href));
  };

  const applyOnChange = () => formRef.current?.requestSubmit();

  const durationLabel: Record<(typeof SEARCH_DURATIONS)[number], string> = {
    short: tx("Krótkie (do 4 min)", "Short (under 4 min)"),
    medium: tx("Średnie (4-20 min)", "Medium (4-20 min)"),
    long: tx("Długie (ponad 20 min)", "Long (over 20 min)"),
  };
  const uploadedLabel: Record<(typeof SEARCH_UPLOADED)[number], string> = {
    day: tx("Ostatnie 24 godziny", "Last 24 hours"),
    week: tx("Ostatni tydzień", "Last week"),
    month: tx("Ostatni miesiąc", "Last month"),
    year: tx("Ostatni rok", "Last year"),
  };
  const sortLabel: Record<(typeof SEARCH_SORTS)[number], string> = {
    relevance: tx("Trafność", "Relevance"),
    newest: tx("Najnowsze", "Newest"),
    views: tx("Najczęściej oglądane", "Most viewed"),
  };

  return (
    <form
      ref={formRef}
      method="get"
      action={getLocalizedHref(language, "search")}
      role="search"
      onSubmit={onSubmit}
      aria-busy={pending}
      className="grid gap-3 rounded-3xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-3 sm:p-4"
    >
      {value.tag ? <input type="hidden" name="tag" value={value.tag} /> : null}
      {value.channel ? <input type="hidden" name="channel" value={value.channel} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={value.q}
          maxLength={100}
          enterKeyHint="search"
          autoComplete="off"
          aria-label={tx("Szukaj filmów", "Search videos")}
          placeholder={tx("Szukaj filmów", "Search videos")}
          className={`${fieldClass} flex-1`}
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full bg-[var(--chan-ink)] px-6 font-brand text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2"
        >
          {tx("Szukaj", "Search")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <select name="category" defaultValue={value.category} onChange={applyOnChange} aria-label={tx("Kategoria", "Category")} className={fieldClass}>
          <option value="">{tx("Wszystkie kategorie", "All categories")}</option>
          {VIDEO_CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {videoCategoryLabel(tx, key)}
            </option>
          ))}
        </select>
        <select name="duration" defaultValue={value.duration} onChange={applyOnChange} aria-label={tx("Długość", "Duration")} className={fieldClass}>
          <option value="">{tx("Dowolna długość", "Any duration")}</option>
          {SEARCH_DURATIONS.map((key) => (
            <option key={key} value={key}>
              {durationLabel[key]}
            </option>
          ))}
        </select>
        <select name="uploaded" defaultValue={value.uploaded} onChange={applyOnChange} aria-label={tx("Data dodania", "Upload date")} className={fieldClass}>
          <option value="">{tx("Dowolna data", "Any time")}</option>
          {SEARCH_UPLOADED.map((key) => (
            <option key={key} value={key}>
              {uploadedLabel[key]}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={value.sort} onChange={applyOnChange} aria-label={tx("Sortuj", "Sort by")} className={fieldClass}>
          {SEARCH_SORTS.map((key) => (
            <option key={key} value={key}>
              {sortLabel[key]}
            </option>
          ))}
        </select>
      </div>
      <p role="status" aria-live="polite" className="min-h-[1rem] text-xs text-[var(--chan-muted)]">
        {pending ? tx("Szukam…", "Searching…") : ""}
      </p>
    </form>
  );
}
