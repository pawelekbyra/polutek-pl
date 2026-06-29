"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PublicVideoDTO } from "@/app/types/video";
import RoughHome from "@/app/eksperyment1/RoughHome";

interface MainRoughHomeProps {
  mainVideo: PublicVideoDTO;
  allVideos: PublicVideoDTO[];
  currentVideoId?: string;
}

export default function MainRoughHome({ mainVideo, allVideos, currentVideoId }: MainRoughHomeProps) {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a[href^="/eksperyment4?v="]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const url = new URL(link.href, window.location.origin);
      const videoId = url.searchParams.get("v") || "";
      router.push(videoId ? `/?v=${encodeURIComponent(videoId)}` : "/");
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="main-rough-home">
      <RoughHome
        mainVideo={mainVideo}
        allVideos={allVideos}
        currentVideoId={currentVideoId}
        basePath="/eksperyment4"
        experimentLabel=""
      />
      <style jsx global>{`
        .main-rough-home .fixed.bottom-4.right-4 {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
