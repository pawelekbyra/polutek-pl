"use client";

import React, { useState } from "react";
import type { PublicVideoDTO } from "@/app/types/video";
import ChannelVideoCard from "@/app/components/ChannelVideoCard";
import { useOptionalTx } from "@/lib/i18n/language-context";

interface ChannelVideoGridProps {
  channelId: string;
  /** The first page, rendered by the server. */
  initialVideos: PublicVideoDTO[];
  /** How many public videos the channel has in all. */
  total: number;
  isLoggedIn: boolean;
}

/**
 * The channel page's video grid: the first page comes with the HTML, "Show more" appends the next page in the same
 * order (W04). Looks exactly like the grid it replaced; the button shows only when there is more.
 */
export default function ChannelVideoGrid({ channelId, initialVideos, total, isLoggedIn }: ChannelVideoGridProps) {
  const tx = useOptionalTx();
  const [videos, setVideos] = useState(initialVideos);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // The batch each card came with, so the staggered mount-in restarts for appended cards.
  const [firstOfBatch, setFirstOfBatch] = useState(0);

  const hasMore = videos.length < total;

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/channel/videos?channelId=${encodeURIComponent(channelId)}&offset=${videos.length}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { videos: PublicVideoDTO[] };
      const known = new Set(videos.map((v) => v.id));
      const fresh = data.videos.filter((v) => !known.has(v.id));
      setFirstOfBatch(videos.length);
      setVideos((current) => [...current, ...fresh]);
      // An empty page although the count says more (videos removed meanwhile) is reported like a failure.
      if (data.videos.length === 0) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="channel-video-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8 py-7">
        {videos.map((video, index) => (
          <ChannelVideoCard
            key={video.id}
            video={video}
            isLoggedIn={isLoggedIn}
            index={Math.max(index - firstOfBatch, 0)}
          />
        ))}
      </div>
      {hasMore && (
        <div className="flex flex-col items-center gap-2 pb-6">
          <button
            type="button"
            data-testid="channel-videos-more"
            onClick={() => void loadMore()}
            disabled={loading}
            aria-busy={loading}
            className="min-w-[160px] rounded-full border border-[var(--chan-line)] px-6 py-2.5 text-[13px] font-bold text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {loading ? tx("Ładowanie...", "Loading...") : tx("Pokaż więcej", "Show more")}
          </button>
          {failed && (
            <p role="status" className="text-[12px] text-[var(--chan-muted)]">
              {tx("Nie udało się wczytać filmów.", "Could not load videos.")}
            </p>
          )}
        </div>
      )}
    </>
  );
}
