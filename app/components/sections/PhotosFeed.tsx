"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, MessageCircle } from "lucide-react";
import { useLanguage } from "@/app/components/LanguageContext";
import { APP_NAME } from "@/lib/constants";
import { intlLocale } from "@/lib/i18n/ui";
import { DEMO_PHOTOS, DEMO_PROFILE } from "@/lib/sections/demo-photos";
import SectionDialog from "./SectionDialog";

/** Prototype of an Instagram-like photo feed (flag SHOW_SECTION_NAV): demo data only, likes live in this component's state. */
export function PrototypeBadge() {
  const { tx } = useLanguage();
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--chan-line)] bg-[var(--chan-surface)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--chan-muted)]">
      {tx("Prototyp", "Prototype")}
    </span>
  );
}

export default function PhotosFeed() {
  const { language, tx } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [liked, setLiked] = useState<ReadonlySet<string>>(new Set());
  const number = new Intl.NumberFormat(intlLocale(language), { notation: "compact" });
  const date = new Intl.DateTimeFormat(intlLocale(language), { dateStyle: "long" });
  const pick = (text: { pl: string; en: string }) => (language === "pl" ? text.pl : text.en);
  const total = DEMO_PHOTOS.length;

  const step = useCallback(
    (delta: number) => setOpenIndex((index) => (index === null ? index : (index + delta + total) % total)),
    [total],
  );
  const toggleLike = (id: string) =>
    setLiked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const current = openIndex === null ? null : DEMO_PHOTOS[openIndex];

  return (
    <div>
      <header className="flex flex-col gap-4 px-4 pb-5 pt-2 sm:flex-row sm:items-center sm:gap-8 sm:px-0">
        <div className="flex items-center gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[image:var(--chan-avatar-gradient)] p-[3px] sm:h-24 sm:w-24">
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[var(--chan-card)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-glasses.svg" alt="" className="h-full w-full object-contain" />
            </span>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-brand text-xl font-bold tracking-tight sm:text-2xl">{APP_NAME}</h1>
              <PrototypeBadge />
            </div>
            <p className="mt-1 text-sm text-[var(--chan-muted)]">{tx("Za kulisami, w obrazach.", "Behind the scenes, in pictures.")}</p>
          </div>
        </div>
        <ul className="flex gap-6 text-sm sm:ml-auto">
          <li><strong className="font-bold">{total}</strong> <span className="text-[var(--chan-muted)]">{tx("postów", "posts")}</span></li>
          <li><strong className="font-bold">{number.format(DEMO_PROFILE.followers)}</strong> <span className="text-[var(--chan-muted)]">{tx("obserwujących", "followers")}</span></li>
          <li><strong className="font-bold">{DEMO_PROFILE.following}</strong> <span className="text-[var(--chan-muted)]">{tx("obserwowanych", "following")}</span></li>
        </ul>
      </header>
      <p className="mx-4 mb-3 rounded-2xl bg-[var(--chan-blue-soft)] px-4 py-2 text-xs text-[var(--chan-muted-2)] sm:mx-0">
        {tx("Prototyp: to przykładowe obrazy, jeszcze nie prawdziwe wpisy.", "Prototype: sample images, not real posts yet.")}
      </p>

      <ul aria-label={tx("Siatka zdjęć", "Photo grid")} className="grid grid-cols-3 gap-[2px] sm:gap-3 lg:grid-cols-4">
        {DEMO_PHOTOS.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={pick(photo.caption)}
              className="group relative block aspect-square w-full overflow-hidden bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--chan-blue)] sm:rounded-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transition-none" />
            </button>
          </li>
        ))}
      </ul>

      {current && openIndex !== null ? (
        <SectionDialog
          label={pick(current.caption)}
          onClose={() => setOpenIndex(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
          }}
        >
          <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-y-auto md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:grid-rows-1">
            <div className="relative aspect-square w-full bg-[var(--chan-surface)] md:aspect-auto md:h-full md:min-h-[420px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.src} alt={pick(current.caption)} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={tx("Poprzednie zdjęcie", "Previous photo")}
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--chan-card)]/90 shadow-md transition hover:bg-[var(--chan-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={tx("Następne zdjęcie", "Next photo")}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--chan-card)]/90 shadow-md transition hover:bg-[var(--chan-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2 text-sm font-bold">
                {APP_NAME}
                <PrototypeBadge />
              </div>
              <p className="text-base leading-relaxed">{pick(current.caption)}</p>
              <time dateTime={current.date} className="text-xs text-[var(--chan-muted)]">{date.format(new Date(`${current.date}T12:00:00`))}</time>
              <div className="mt-auto flex items-center gap-5 pt-2 text-sm">
                <button
                  type="button"
                  onClick={() => toggleLike(current.id)}
                  aria-pressed={liked.has(current.id)}
                  aria-label={liked.has(current.id) ? tx("Cofnij polubienie", "Unlike") : tx("Lubię to", "Like")}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1.5 transition hover:bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
                >
                  <Heart className={`h-6 w-6 transition-transform motion-reduce:transition-none ${liked.has(current.id) ? "scale-110 fill-red-500 text-red-500" : ""}`} aria-hidden="true" />
                  <span>{current.likes + (liked.has(current.id) ? 1 : 0)}</span>
                </button>
                <span className="flex items-center gap-1.5 text-[var(--chan-muted-2)]">
                  <MessageCircle className="h-6 w-6" aria-hidden="true" />
                  <span>{current.comments}</span>
                </span>
                <span className="ml-auto text-xs text-[var(--chan-muted)]" aria-live="polite">{openIndex + 1} / {total}</span>
              </div>
            </div>
          </div>
        </SectionDialog>
      ) : null}
    </div>
  );
}
