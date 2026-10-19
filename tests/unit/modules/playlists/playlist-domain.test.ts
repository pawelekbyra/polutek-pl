import { describe, expect, it } from "vitest";
import {
  buildWatchQuery,
  isPlaylistItemVisible,
  isPlaylistListed,
  isPlaylistServedPublicly,
  locateInQueue,
  moveItem,
  parseListParam,
  parseQueueIndex,
  pickUniqueSlug,
  shouldNoIndexPlaylist,
  slugifyPlaylistTitle,
  validateReorder,
} from "@/lib/modules/playlists";

const NOW = new Date("2026-10-19T12:00:00Z");
const visibleVideo = { creatorId: "ch-1", status: "PUBLISHED", moderationStatus: "NONE", isAdult: false, publishedAt: new Date("2026-10-01T00:00:00Z"), premiereAt: null };
const context = { channelId: "ch-1", signedIn: false, now: NOW };

describe("playlist items visible to a viewer", () => {
  it("shows a published, due video of the playlist's own channel", () => {
    expect(isPlaylistItemVisible(visibleVideo, context)).toBe(true);
  });

  it.each([
    ["a draft", { status: "DRAFT" }],
    ["an unlisted video", { status: "UNLISTED" }],
    ["an archived video", { status: "ARCHIVED" }],
    ["a removed video", { moderationStatus: "REMOVED" }],
    ["a video of another channel", { creatorId: "ch-2" }],
    ["a video not yet due", { publishedAt: new Date("2026-11-01T00:00:00Z") }],
    ["an upcoming premiere", { premiereAt: new Date("2026-10-25T00:00:00Z") }],
    ["an adult video for a guest", { isAdult: true }],
    ["an age-restricted video for a guest", { moderationStatus: "AGE_RESTRICTED" }],
  ])("skips %s", (_name, patch) => {
    expect(isPlaylistItemVisible({ ...visibleVideo, ...patch }, context)).toBe(false);
  });

  it("shows an adult video to a signed-in viewer, and a premiere that has started", () => {
    expect(isPlaylistItemVisible({ ...visibleVideo, isAdult: true }, { ...context, signedIn: true })).toBe(true);
    expect(isPlaylistItemVisible({ ...visibleVideo, premiereAt: new Date("2026-10-10T00:00:00Z") }, context)).toBe(true);
  });
});

describe("playlist visibility levels", () => {
  const channel = { status: "ACTIVE", deletedAt: null };

  it("PUBLIC is served and listed, UNLISTED is served but never listed, PRIVATE is never served", () => {
    expect(isPlaylistServedPublicly({ visibility: "PUBLIC" }, channel)).toBe(true);
    expect(isPlaylistListed({ visibility: "PUBLIC" }, channel)).toBe(true);
    expect(isPlaylistServedPublicly({ visibility: "UNLISTED" }, channel)).toBe(true);
    expect(isPlaylistListed({ visibility: "UNLISTED" }, channel)).toBe(false);
    expect(isPlaylistServedPublicly({ visibility: "PRIVATE" }, channel)).toBe(false);
    expect(isPlaylistListed({ visibility: "PRIVATE" }, channel)).toBe(false);
  });

  it("a deleted playlist and a hidden channel are never served", () => {
    expect(isPlaylistServedPublicly({ visibility: "PUBLIC", deletedAt: NOW }, channel)).toBe(false);
    for (const status of ["SUSPENDED", "BANNED", "DELETED", "PENDING_REVIEW"]) {
      expect(isPlaylistServedPublicly({ visibility: "PUBLIC" }, { status, deletedAt: null }), status).toBe(false);
    }
    expect(isPlaylistServedPublicly({ visibility: "PUBLIC" }, { status: "LIMITED", deletedAt: null })).toBe(true);
  });

  it("only a PUBLIC playlist may be indexed", () => {
    expect(shouldNoIndexPlaylist("PUBLIC")).toBe(false);
    expect(shouldNoIndexPlaylist("UNLISTED")).toBe(true);
  });
});

describe("playlist slugs (pure)", () => {
  it("folds diacritics, drops punctuation and never returns an empty slug", () => {
    expect(slugifyPlaylistTitle("Łódź: najlepsze 10 filmów!")).toBe("lodz-najlepsze-10-filmow");
    expect(slugifyPlaylistTitle("!!!")).toBe("playlist");
    expect(slugifyPlaylistTitle("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });

  it("picks the first free suffix", () => {
    expect(pickUniqueSlug("a", new Set())).toBe("a");
    expect(pickUniqueSlug("a", new Set(["a", "a-2"]))).toBe("a-3");
    const long = "b".repeat(60);
    expect(pickUniqueSlug(long, new Set([long])).length).toBeLessThanOrEqual(60);
  });
});

describe("reorder validation", () => {
  it("accepts a permutation of exactly the current videos", () => {
    const check = validateReorder(["a", "b", "c"], ["c", "a", "b"]);
    expect(check).toEqual({ ok: true, assignments: [{ videoId: "c", position: 0 }, { videoId: "a", position: 1 }, { videoId: "b", position: 2 }] });
  });

  it("refuses duplicates, missing, extra and too many ids", () => {
    expect(validateReorder(["a", "b"], ["a", "a"])).toEqual({ ok: false, reason: "DUPLICATE" });
    expect(validateReorder(["a", "b"], ["a"])).toEqual({ ok: false, reason: "MISMATCH" });
    expect(validateReorder(["a", "b"], ["a", "b", "c"])).toEqual({ ok: false, reason: "MISMATCH" });
    expect(validateReorder(["a", "b"], ["a", "z"])).toEqual({ ok: false, reason: "MISMATCH" });
    expect(validateReorder([], Array.from({ length: 201 }, (_, i) => `v${i}`))).toEqual({ ok: false, reason: "TOO_MANY" });
  });

  it("moveItem moves by one place and clamps at the ends", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});

describe("watch page playlist context", () => {
  it("parses ?list= and ?i= defensively", () => {
    expect(parseListParam("Moja-Lista")).toBe("moja-lista");
    expect(parseListParam("../etc")).toBeNull();
    expect(parseListParam("")).toBeNull();
    expect(parseListParam(undefined)).toBeNull();
    expect(parseQueueIndex("3")).toBe(3);
    expect(parseQueueIndex("0")).toBeNull();
    expect(parseQueueIndex("-1")).toBeNull();
    expect(parseQueueIndex("2x")).toBeNull();
    expect(parseQueueIndex("999")).toBeNull();
  });

  it("finds the open video and its neighbours; a video outside the queue has none", () => {
    expect(locateInQueue(["a", "b", "c"], "b")).toEqual({ index: 1, previousId: "a", nextId: "c" });
    expect(locateInQueue(["a", "b", "c"], "a")).toEqual({ index: 0, previousId: null, nextId: "b" });
    expect(locateInQueue(["a", "b", "c"], "c")).toEqual({ index: 2, previousId: "b", nextId: null });
    expect(locateInQueue(["a", "b", "c"], "zzz")).toEqual({ index: -1, previousId: null, nextId: null });
  });

  it("builds the watch query with the list context", () => {
    expect(buildWatchQuery("film one", "moja-lista", 2)).toBe("v=film%20one&list=moja-lista&i=2");
  });
});
