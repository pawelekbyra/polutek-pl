import { describe, expect, it } from "vitest";
import {
  addPlaylistVideo,
  createPlaylist,
  deletePlaylist,
  removePlaylistVideo,
  reorderPlaylist,
  updatePlaylist,
} from "@/lib/modules/playlists";
import { editor, emptyState, guest, makeCtx, moderator, otherOwner, owner, stranger } from "./fake-db";

async function seedPlaylist(state = emptyState(), videos: string[] = ["v1", "v2", "v3"]) {
  const ctx = makeCtx(state, owner);
  const created = await createPlaylist(ctx, { channelId: "ch-1", title: "Moja lista" });
  if (!created.ok) throw new Error("seed failed");
  for (const videoId of videos) {
    const added = await addPlaylistVideo(ctx, { channelId: "ch-1", playlistId: created.data.id, videoId });
    if (!added.ok) throw new Error("seed add failed");
  }
  return { state, id: created.data.id };
}

describe("playlist authorization (playlist.* actions)", () => {
  it("owner and editor manage playlists; moderator, stranger and guest cannot", async () => {
    const state = emptyState();
    expect((await createPlaylist(makeCtx(state, owner), { channelId: "ch-1", title: "A" })).ok).toBe(true);
    expect((await createPlaylist(makeCtx(state, editor), { channelId: "ch-1", title: "B" })).ok).toBe(true);
    for (const actor of [moderator, stranger, guest]) {
      const result = await createPlaylist(makeCtx(state, actor), { channelId: "ch-1", title: "C" });
      expect(result.ok, String(actor.type)).toBe(false);
    }
    expect(state.playlists).toHaveLength(2);
  });

  it("a user of another channel cannot touch a playlist by guessing its id (BOLA)", async () => {
    const { state, id } = await seedPlaylist();
    const ctx = makeCtx(state, otherOwner);
    // Own channel id + foreign playlist id: authorized for the channel, but the playlist is not found there.
    const update = await updatePlaylist(ctx, { channelId: "ch-2", playlistId: id, title: "Hacked" });
    expect(update.ok).toBe(false);
    if (!update.ok) expect((update.error as { statusCode: number }).statusCode).toBe(404);
    expect((await deletePlaylist(ctx, { channelId: "ch-2", playlistId: id })).ok).toBe(false);
    expect((await addPlaylistVideo(ctx, { channelId: "ch-2", playlistId: id, videoId: "x1" })).ok).toBe(false);
    // Foreign channel id: not a member.
    const foreign = await updatePlaylist(ctx, { channelId: "ch-1", playlistId: id, title: "Hacked" });
    expect(foreign.ok).toBe(false);
    expect(state.playlists[0]!.title).toBe("Moja lista");
  });

  it("audits what was changed", async () => {
    const { state, id } = await seedPlaylist(emptyState(), ["v1"]);
    const ctx = makeCtx(state, owner);
    await updatePlaylist(ctx, { channelId: "ch-1", playlistId: id, visibility: "UNLISTED" });
    await removePlaylistVideo(ctx, { channelId: "ch-1", playlistId: id, videoId: "v1" });
    await deletePlaylist(ctx, { channelId: "ch-1", playlistId: id });
    expect(state.audit.map((a) => a.action)).toEqual([
      "PLAYLIST_CREATED",
      "PLAYLIST_VIDEO_ADDED",
      "PLAYLIST_UPDATED",
      "PLAYLIST_VIDEO_REMOVED",
      "PLAYLIST_DELETED",
    ]);
    expect(state.audit.every((a) => a.channelId === "ch-1")).toBe(true);
  });
});

describe("playlist slugs", () => {
  it("are derived from the title and unique within a channel", async () => {
    const state = emptyState();
    const ctx = makeCtx(state, owner);
    const first = await createPlaylist(ctx, { channelId: "ch-1", title: "Zażółć gęślą jaźń!" });
    const second = await createPlaylist(ctx, { channelId: "ch-1", title: "Zażółć gęślą jaźń!" });
    const third = await createPlaylist(ctx, { channelId: "ch-1", title: "Zażółć gęślą jaźń!" });
    expect([first, second, third].map((r) => (r.ok ? r.data.slug : null))).toEqual(["zazolc-gesla-jazn", "zazolc-gesla-jazn-2", "zazolc-gesla-jazn-3"]);
  });

  it("may repeat across channels, and a soft-deleted playlist keeps its slug reserved", async () => {
    const state = emptyState();
    const a = await createPlaylist(makeCtx(state, owner), { channelId: "ch-1", title: "Hity" });
    const b = await createPlaylist(makeCtx(state, otherOwner), { channelId: "ch-2", title: "Hity" });
    expect(a.ok && b.ok && a.data.slug === "hity" && b.data.slug === "hity").toBe(true);
    if (a.ok) await deletePlaylist(makeCtx(state, owner), { channelId: "ch-1", playlistId: a.data.id });
    const again = await createPlaylist(makeCtx(state, owner), { channelId: "ch-1", title: "Hity" });
    expect(again.ok && again.data.slug).toBe("hity-2");
  });

  it("a lost race on the unique index is retried with the next free slug", async () => {
    const state = emptyState();
    const ctx = makeCtx(state, owner);
    const db = ctx.prisma as any;
    // Somebody else committed "race" after we read the taken slugs: our first read is stale, the insert collides.
    state.playlists.push({ id: "rival", channelId: "ch-1", title: "x", description: null, visibility: "PUBLIC", slug: "race", createdAt: new Date(), updatedAt: new Date(), deletedAt: null });
    const realFindMany = db.playlist.findMany;
    let stale = true;
    db.playlist.findMany = async (args: any) => {
      if (stale) {
        stale = false;
        return [];
      }
      return realFindMany(args);
    };
    const result = await createPlaylist(ctx, { channelId: "ch-1", title: "Race" });
    expect(result.ok && result.data.slug).toBe("race-2");
  });
});

describe("playlist items", () => {
  it("holds only videos of its own channel and each video once", async () => {
    const { state, id } = await seedPlaylist(emptyState(), ["v1"]);
    const ctx = makeCtx(state, owner);
    const foreign = await addPlaylistVideo(ctx, { channelId: "ch-1", playlistId: id, videoId: "x1" });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect((foreign.error as { statusCode: number }).statusCode).toBe(404);
    const duplicate = await addPlaylistVideo(ctx, { channelId: "ch-1", playlistId: id, videoId: "v1" });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect((duplicate.error as { code?: string }).code).toBe("CONFLICT");
    expect(state.items.map((i) => i.videoId)).toEqual(["v1"]);
  });

  it("appends at the end and keeps the order after a removal", async () => {
    const { state, id } = await seedPlaylist();
    const ctx = makeCtx(state, owner);
    await removePlaylistVideo(ctx, { channelId: "ch-1", playlistId: id, videoId: "v2" });
    const added = await addPlaylistVideo(ctx, { channelId: "ch-1", playlistId: id, videoId: "v2" });
    expect(added.ok && added.data.position).toBe(3);
    expect([...state.items].sort((a, b) => a.position - b.position).map((i) => i.videoId)).toEqual(["v1", "v3", "v2"]);
  });

  it("removing a video that is not on the playlist is a 404", async () => {
    const { state, id } = await seedPlaylist(emptyState(), ["v1"]);
    const result = await removePlaylistVideo(makeCtx(state, owner), { channelId: "ch-1", playlistId: id, videoId: "v3" });
    expect(result.ok).toBe(false);
  });
});

describe("playlist reorder", () => {
  it("applies a complete new order and positions become 0..n-1", async () => {
    const { state, id } = await seedPlaylist();
    const result = await reorderPlaylist(makeCtx(state, editor), { channelId: "ch-1", playlistId: id, videoIds: ["v3", "v1", "v2"] });
    expect(result.ok).toBe(true);
    expect([...state.items].sort((a, b) => a.position - b.position).map((i) => [i.videoId, i.position])).toEqual([["v3", 0], ["v1", 1], ["v2", 2]]);
  });

  it.each([
    ["a missing video", ["v1", "v2"]],
    ["an extra video", ["v1", "v2", "v3", "x1"]],
    ["a foreign video instead of one of ours", ["v1", "v2", "x1"]],
    ["a repeated video", ["v1", "v1", "v2"]],
  ])("refuses %s and writes nothing", async (_name, videoIds) => {
    const { state, id } = await seedPlaylist();
    const before = JSON.stringify(state.items);
    const result = await reorderPlaylist(makeCtx(state, owner), { channelId: "ch-1", playlistId: id, videoIds });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(state.items)).toBe(before);
    expect(state.audit.some((a) => a.action === "PLAYLIST_REORDERED")).toBe(false);
  });

  it("is atomic: a failure halfway rolls every position back", async () => {
    const state = emptyState();
    const seeded = await seedPlaylist(state);
    const before = JSON.stringify(state.items);
    const failing = makeCtx(state, owner, { failSetPositionAfter: 1 });
    await expect(reorderPlaylist(failing, { channelId: "ch-1", playlistId: seeded.id, videoIds: ["v3", "v2", "v1"] })).rejects.toThrow("boom");
    expect(JSON.stringify(state.items)).toBe(before);
    expect(state.audit.some((a) => a.action === "PLAYLIST_REORDERED")).toBe(false);
  });

  it("a moderator cannot reorder", async () => {
    const { state, id } = await seedPlaylist();
    const result = await reorderPlaylist(makeCtx(state, moderator), { channelId: "ch-1", playlistId: id, videoIds: ["v3", "v1", "v2"] });
    expect(result.ok).toBe(false);
  });
});

describe("playlist input validation", () => {
  it("rejects an empty or too long title and a bad visibility", async () => {
    const ctx = makeCtx(emptyState(), owner);
    expect((await createPlaylist(ctx, { channelId: "ch-1", title: "   " })).ok).toBe(false);
    expect((await createPlaylist(ctx, { channelId: "ch-1", title: "x".repeat(101) })).ok).toBe(false);
    expect((await createPlaylist(ctx, { channelId: "ch-1", title: "ok", visibility: "SECRET" })).ok).toBe(false);
    expect((await createPlaylist(ctx, { channelId: "ch-1", title: "ok", description: "d".repeat(1001) })).ok).toBe(false);
  });

  it("update needs at least one field", async () => {
    const { state, id } = await seedPlaylist(emptyState(), []);
    expect((await updatePlaylist(makeCtx(state, owner), { channelId: "ch-1", playlistId: id })).ok).toBe(false);
  });
});
