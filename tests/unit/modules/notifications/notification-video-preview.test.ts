import { describe, expect, it, vi } from "vitest";
import { listUserNotifications } from "@/lib/modules/notifications/application/user-notifications.use-cases";
import { notificationTypeHasVideo, notificationVideoPreview, type NotificationVideoRow } from "@/lib/modules/notifications/domain/notification-video";

const NOW = new Date("2026-10-28T12:00:00Z");
const ENV = { NEXT_PUBLIC_R2_PUBLIC_HOST: "thumbs.pawelperfect.com", CLOUDFLARE_R2_ACCOUNT_ID: "acc", CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE: "priv" };
const PRIVATE_URL = "https://acc.r2.cloudflarestorage.com/priv/videos/v1/abc.jpg";
const PUBLIC_URL = "https://thumbs.pawelperfect.com/videos/v1/abc.jpg";

const video = (over: Partial<NotificationVideoRow> = {}): NotificationVideoRow => ({
  id: "v1", slug: "film", status: "PUBLISHED", publishedAt: new Date("2026-10-01T00:00:00Z"), moderationStatus: "APPROVED",
  thumbnailUrl: PRIVATE_URL, thumbnailPublicUrl: PUBLIC_URL, creator: { status: "ACTIVE", deletedAt: null }, ...over,
});

describe("notificationVideoPreview", () => {
  it("returns id, slug and the public R2 cover of a visible published video", () => {
    expect(notificationVideoPreview(video(), NOW, ENV)).toEqual({ videoId: "v1", videoSlug: "film", thumbnailUrl: PUBLIC_URL });
  });

  it("falls back to the thumbnail proxy path when the public copy is missing or stale", () => {
    expect(notificationVideoPreview(video({ thumbnailPublicUrl: null }), NOW, ENV)?.thumbnailUrl).toBe("/api/videos/v1/thumbnail");
    expect(notificationVideoPreview(video({ thumbnailUrl: "https://acc.r2.cloudflarestorage.com/priv/videos/v1/other.jpg" }), NOW, ENV)?.thumbnailUrl).toBe("/api/videos/v1/thumbnail");
  });

  it.each([
    ["draft", { status: "DRAFT" }],
    ["archived", { status: "ARCHIVED" }],
    ["unlisted (stricter than the thumbnail route)", { status: "UNLISTED" }],
    ["removed by moderation", { moderationStatus: "REMOVED" }],
    ["not yet due", { publishedAt: new Date("2026-11-01T00:00:00Z") }],
    ["hidden channel", { creator: { status: "SUSPENDED", deletedAt: null } }],
    ["deleted channel", { creator: { status: "ACTIVE", deletedAt: new Date("2026-10-02T00:00:00Z") } }],
    ["no channel", { creator: null }],
  ] as const)("returns no preview for a %s video", (_name, over) => {
    expect(notificationVideoPreview(video(over as Partial<NotificationVideoRow>), NOW, ENV)).toBeNull();
  });

  it("returns no preview for a missing (deleted) video", () => {
    expect(notificationVideoPreview(undefined, NOW, ENV)).toBeNull();
  });

  it("still shows the cover of login-only, paid and patron-zone videos like the public lists do", () => {
    // Access tier is not part of the input: covers are public regardless of who may play the video.
    expect(notificationVideoPreview(video(), NOW, ENV)).not.toBeNull();
  });

  it("only new-video and premiere types carry a video", () => {
    expect(["new_video", "premiere"].every((t) => notificationTypeHasVideo(t as never))).toBe(true);
    expect(["comment_reply", "comment_like", "creator_like", "welcome", "support", "moderation", "announcement", "notification"].some((t) => notificationTypeHasVideo(t as never))).toBe(false);
  });
});

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: "NEW_VIDEO", titlePl: "T", titleEn: "T", bodyPl: "B", bodyEn: "B", href: "/watch/film", videoId: "v1", read: false,
  createdAt: new Date("2026-10-14T10:00:00Z"), templateKey: null, params: null, ...over,
});

function ctxWith(rows: unknown[], videos: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(videos);
  const prisma = {
    notification: { findMany: vi.fn().mockResolvedValue(rows), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ language: "pl" }) },
    video: { findMany },
  };
  return { ctx: { actor: { type: "user", userId: "me" }, prisma, now: () => NOW } as never, findMany };
}

describe("listUserNotifications video preview", () => {
  it("loads all videos of a page with ONE query on small columns (no N+1)", async () => {
    const rows = [row("a", { videoId: "v1" }), row("b", { videoId: "v2" }), row("c", { videoId: "v1" }), row("d", { videoId: "v3", templateKey: "premiere", params: {} })];
    const { ctx, findMany } = ctxWith(rows, [video(), video({ id: "v2", slug: "dwa" }), video({ id: "v3", slug: "trzy", status: "DRAFT" })]);
    const page = await listUserNotifications(ctx, { limit: 10 });
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: { in: ["v1", "v2", "v3"] } });
    expect(Object.keys(args.select).sort()).toEqual(["creator", "id", "moderationStatus", "publishedAt", "slug", "status", "thumbnailPublicUrl", "thumbnailUrl"]);
    expect(page.items.map((n) => [n.videoId, n.videoSlug, n.thumbnailUrl === null])).toEqual([
      ["v1", "film", false], ["v2", "dwa", false], ["v1", "film", false], [null, null, true],
    ]);
  });

  it("does not query videos for pages without video notifications and leaves other types empty", async () => {
    const rows = [row("a", { kind: "COMMENT", videoId: "v1" }), row("b", { kind: "WELCOME", videoId: null })];
    const { ctx, findMany } = ctxWith(rows, [video()]);
    const page = await listUserNotifications(ctx, { limit: 10 });
    expect(findMany).not.toHaveBeenCalled();
    expect(page.items.every((n) => n.videoId === null && n.videoSlug === null && n.thumbnailUrl === null)).toBe(true);
  });

  it("gives no preview when the video row is gone, and never leaks the stored private URL", async () => {
    const { ctx } = ctxWith([row("a"), row("b", { videoId: "v1" })], []);
    const gone = await listUserNotifications(ctx, { limit: 10 });
    expect(gone.items.every((n) => n.thumbnailUrl === null && n.videoId === null)).toBe(true);
    const { ctx: ctx2 } = ctxWith([row("a")], [video({ thumbnailPublicUrl: null })]);
    const page = await listUserNotifications(ctx2, { limit: 10 });
    expect(JSON.stringify(page)).not.toContain("r2.cloudflarestorage.com");
  });
});
