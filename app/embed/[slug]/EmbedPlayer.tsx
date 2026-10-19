"use client";

import PremiumWrapper from "@/app/components/PremiumWrapper";
import VideoPlayer from "@/app/components/VideoPlayer";
import type { PublicVideoDTO } from "@/app/types/video";

/**
 * The same player stack as the site (PremiumWrapper -> playback plan from /api/media-source -> VideoPlayer / hls.js),
 * with no site chrome around it. It is mounted only for a PUBLIC-tier video (the server page decides); the plan request
 * still goes through checkVideoAccess like everywhere else. It does not autoplay: the viewer's click starts it, with sound.
 */
export default function EmbedPlayer({ video }: { video: PublicVideoDTO }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div className="relative aspect-video max-h-full w-full">
        <PremiumWrapper videoId={video.id} requiredTier="PUBLIC" premiereAt={null}>
          <VideoPlayer video={video} startWithSound autoPlay={false} />
        </PremiumWrapper>
      </div>
    </div>
  );
}
