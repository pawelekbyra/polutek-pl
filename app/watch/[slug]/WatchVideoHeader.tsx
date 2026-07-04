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
      <h1 className="text-3xl font-black tracking-tight text-neutral-950">
        {displayTitle}
      </h1>
      {displayDescription ? (
        <div className="max-w-3xl rounded-2xl border border-[#0f0f0f] bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,15,15,0.10),0_8px_18px_rgba(15,15,15,0.08)]">
          <p className="text-sm leading-6 text-neutral-700">{displayDescription}</p>
        </div>
      ) : null}
    </div>
  );
}
