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
    <div className="mb-6 space-y-2">
      <h1 className="text-3xl font-black tracking-tight text-neutral-950">
        {displayTitle}
      </h1>
      {displayDescription ? (
        <p className="max-w-3xl text-sm text-neutral-600">{displayDescription}</p>
      ) : null}
    </div>
  );
}
