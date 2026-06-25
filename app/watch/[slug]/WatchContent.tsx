"use client";

import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import PremiumWrapper from "@/app/components/PremiumWrapper";
import VideoPlayer from "@/app/components/VideoPlayer";
import { useLanguage } from "@/app/components/LanguageContext";
import type { PublicVideoDTO } from "@/app/types/video";
import {
  getVideoDisplayDescription,
  getVideoDisplayTitle,
} from "@/lib/video-title-overrides";

type WatchContentProps = {
  video: PublicVideoDTO;
};

export default function WatchContent({ video }: WatchContentProps) {
  const { language } = useLanguage();
  const displayTitle = getVideoDisplayTitle(video, language);
  const displayDescription = getVideoDisplayDescription(video, language);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-neutral-950">{displayTitle}</h1>
          {displayDescription ? (
            <p className="max-w-3xl text-sm text-neutral-600">{displayDescription}</p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl bg-black shadow-2xl aspect-video">
          <PremiumWrapper videoId={video.id} requiredTier={video.tier}>
            <VideoPlayer video={video} />
          </PremiumWrapper>
        </div>
      </main>
      <Footer />
    </div>
  );
}
