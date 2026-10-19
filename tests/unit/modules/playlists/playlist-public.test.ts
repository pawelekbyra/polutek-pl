import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  loadPublicPlaylist: vi.fn(),
  loadPublicPlaylistSummaries: vi.fn(),
  loadQueue: vi.fn(),
  loadVideoChannel: vi.fn(),
}));
vi.mock("@/lib/modules/playlists/infrastructure/public-playlist.repository", () => repo);

import { getPlaylistQueue, getPublicPlaylist, listPublicPlaylistsForChannel } from "@/lib/modules/playlists";

const card = (id: string) => ({ id, slug: `s-${id}`, title: id, titleEn: null, thumbnailUrl: `/api/videos/${id}/thumbnail`, duration: null, tier: "PUBLIC" as const, isAdult: false, views: 0, publishedAt: null });
const channel = { id: "ch-1", name: "Kanał", slug: "kanal", handle: null, status: "ACTIVE", deletedAt: null };

beforeEach(() => vi.resetAllMocks());

describe("public playlist reads", () => {
  it("serves a playlist with only the items the repository kept for this viewer", async () => {
    repo.loadPublicPlaylist.mockResolvedValue({ channel, playlist: { id: "p1", slug: "hity", title: "Hity", description: null, visibility: "UNLISTED" }, items: [card("a"), card("b")] });
    const result = await getPublicPlaylist({ channelKey: "kanal", playlistSlug: "hity", signedIn: false });
    expect(result?.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result?.visibility).toBe("UNLISTED");
    expect(repo.loadPublicPlaylist).toHaveBeenCalledWith("kanal", "hity", false, expect.any(Date));
  });

  it("an unknown playlist, a PRIVATE one and a hidden channel are all just not found", async () => {
    repo.loadPublicPlaylist.mockResolvedValueOnce(null);
    expect(await getPublicPlaylist({ channelKey: "kanal", playlistSlug: "nie-ma", signedIn: true })).toBeNull();
    repo.loadPublicPlaylist.mockResolvedValueOnce({ channel, playlist: { id: "p1", slug: "x", title: "X", description: null, visibility: "PRIVATE" }, items: [card("a")] });
    expect(await getPublicPlaylist({ channelKey: "kanal", playlistSlug: "x", signedIn: true })).toBeNull();
    repo.loadPublicPlaylist.mockResolvedValueOnce({ channel: { ...channel, status: "SUSPENDED" }, playlist: { id: "p1", slug: "x", title: "X", description: null, visibility: "PUBLIC" }, items: [card("a")] });
    expect(await getPublicPlaylist({ channelKey: "kanal", playlistSlug: "x", signedIn: true })).toBeNull();
  });

  it("the channel shelf skips playlists with nothing the viewer can see and counts only visible videos", async () => {
    repo.loadPublicPlaylistSummaries.mockResolvedValue([
      { id: "p1", slug: "pelna", title: "Pełna", description: null, visible: [card("a"), card("b")] },
      { id: "p2", slug: "pusta", title: "Pusta", description: null, visible: [] },
    ]);
    const shelf = await listPublicPlaylistsForChannel({ channelId: "ch-1", channelSlug: "kanal", signedIn: false });
    expect(shelf).toEqual([{ id: "p1", slug: "pelna", title: "Pełna", description: null, itemCount: 2, coverThumbnailUrl: "/api/videos/a/thumbnail", channelSlug: "kanal" }]);
  });
});

describe("playlist queue of the watch page", () => {
  it("gives the queue and the place of the open video", async () => {
    repo.loadVideoChannel.mockResolvedValue(channel);
    repo.loadQueue.mockResolvedValue({ playlist: { id: "p1", slug: "hity", title: "Hity" }, items: [card("a"), card("b"), card("c")] });
    const queue = await getPlaylistQueue({ videoId: "b", listSlug: "hity", signedIn: true });
    expect(queue).toMatchObject({ slug: "hity", channelSlug: "kanal", index: 1 });
    expect(queue?.items).toHaveLength(3);
    expect(repo.loadQueue).toHaveBeenCalledWith("ch-1", "hity", true, expect.any(Date));
  });

  it("looks the playlist up in the open video's own channel only", async () => {
    repo.loadVideoChannel.mockResolvedValue({ ...channel, id: "ch-9" });
    repo.loadQueue.mockResolvedValue(null);
    expect(await getPlaylistQueue({ videoId: "b", listSlug: "hity", signedIn: false })).toBeNull();
    expect(repo.loadQueue).toHaveBeenCalledWith("ch-9", "hity", false, expect.any(Date));
  });

  it("no queue when the open video is not among the visible items (nothing leaks about hidden entries)", async () => {
    repo.loadVideoChannel.mockResolvedValue(channel);
    repo.loadQueue.mockResolvedValue({ playlist: { id: "p1", slug: "hity", title: "Hity" }, items: [card("a"), card("c")] });
    expect(await getPlaylistQueue({ videoId: "b", listSlug: "hity", signedIn: false })).toBeNull();
  });

  it("no queue for an unknown video or a hidden channel", async () => {
    repo.loadVideoChannel.mockResolvedValueOnce(null);
    expect(await getPlaylistQueue({ videoId: "zzz", listSlug: "hity", signedIn: false })).toBeNull();
    repo.loadVideoChannel.mockResolvedValueOnce({ ...channel, status: "BANNED" });
    repo.loadQueue.mockResolvedValueOnce({ playlist: { id: "p1", slug: "hity", title: "Hity" }, items: [card("b")] });
    expect(await getPlaylistQueue({ videoId: "b", listSlug: "hity", signedIn: false })).toBeNull();
  });
});
