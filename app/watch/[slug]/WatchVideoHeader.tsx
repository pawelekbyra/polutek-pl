"use client";

import type { PublicVideoDTO } from "@/app/types/video";
import { useLanguage } from "@/app/components/LanguageContext";
import {
  getVideoDisplayDescription,
  getVideoDisplayTitle,
} from "@/lib/video-title-overrides";

type WatchVideoHeaderProps = {
  video: PublicVideoDTO;
};

export function WatchVideoHeader({ video }: WatchVideoHeaderProps) {
  const { language } = useLanguage();
  const displayTitle = getVideoDisplayTitle(video, language);
  const displayDescription = getVideoDisplayDescription(video, language);

  return (
    <div className="mb-6 space-y-3">
      <h1 className="font-brand text-3xl font-bold tracking-tight text-[var(--chan-ink)]">
        {displayTitle}
      </h1>
      {displayDescription ? (
        <div className="max-w-3xl rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-4 py-3">
          <p className="text-sm leading-6 text-[var(--chan-body)]">{displayDescription}</p>
        </div>
      ) : null}
    </div>
  );
}
