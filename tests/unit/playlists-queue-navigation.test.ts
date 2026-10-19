import { describe, expect, it } from "vitest";
import { planQueueSelect, planSidebarSwitch } from "@/app/components/playlists/queue-navigation";
import type { PlaylistQueueDto } from "@/lib/modules/playlists/domain/playlist.dto";

const item = (id: string) => ({ id, slug: `film-${id}`, title: id, titleEn: null, thumbnailUrl: "/t", duration: null, tier: "PUBLIC" as const, isAdult: false, views: 0, publishedAt: null });
const queue: PlaylistQueueDto = { slug: "hity", title: "Hity", channelSlug: "kanal", index: 0, items: [item("a"), item("b"), item("c")] };

describe("watch page playlist navigation", () => {
  it("a sidebar pick inside the playlist keeps ?list= and the place in the list", () => {
    expect(planSidebarSwitch(queue, "c", "film-c")).toEqual({ query: "v=film-c&list=hity&i=3", leaveQueue: false });
  });

  it("a sidebar pick outside the playlist leaves it", () => {
    expect(planSidebarSwitch(queue, "zzz", "film-zzz")).toEqual({ query: "v=film-zzz", leaveQueue: true });
    expect(planSidebarSwitch(queue, "zzz", undefined)).toEqual({ query: "v=zzz", leaveQueue: true });
  });

  it("without a playlist nothing changes from the plain ?v= address", () => {
    expect(planSidebarSwitch(null, "a", "film-a")).toEqual({ query: "v=film-a", leaveQueue: false });
  });

  it("a queue entry opens in place only when the home list knows the video", () => {
    expect(planQueueSelect(queue, 1, ["a", "b"])).toEqual({ videoId: "b", query: "v=film-b&list=hity&i=2", inPlace: true });
    expect(planQueueSelect(queue, 2, ["a", "b"])).toEqual({ videoId: "c", query: "v=film-c&list=hity&i=3", inPlace: false });
  });

  it("an index outside the queue, or no queue, gives no plan", () => {
    expect(planQueueSelect(queue, 3, [])).toBeNull();
    expect(planQueueSelect(queue, -1, [])).toBeNull();
    expect(planQueueSelect(null, 0, [])).toBeNull();
  });
});
