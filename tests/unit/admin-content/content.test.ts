import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  video: { deleteAdminVideo: vi.fn(), getAdminVideoDetails: vi.fn(), getAdminVideoList: vi.fn(), reorderAdminVideos: vi.fn(), updateAdminVideo: vi.fn() },
  pipeline: { getPipelineState: vi.fn(), purgeVideoStorage: vi.fn(async () => undefined), snapshotVideoStorage: vi.fn(async () => ({ keys: ["a"] })) },
  audit: { recordAuditEventSafe: vi.fn(async () => undefined) },
  deletePublic: vi.fn(async () => undefined),
}));
vi.mock("@/lib/modules/video", () => m.video);
vi.mock("@/lib/modules/video-pipeline", () => m.pipeline);
vi.mock("@/lib/modules/audit", () => m.audit);
vi.mock("@/lib/modules/channel", () => ({ MainChannelService: { getRequired: async () => ({ id: "c1" }) } }));
vi.mock("@/lib/modules/media", async () => {
  const actual = await vi.importActual<typeof import("@/lib/modules/media")>("@/lib/modules/media");
  class R2ThumbnailStorageClient {
    static isPublicServingConfigured = () => true;
    deletePublic = m.deletePublic;
  }
  return { ...actual, R2ThumbnailStorageClient };
});

import { deleteVideoWithStorage, saveChannelLayout } from "@/lib/modules/admin-content";
import type { AppContext } from "@/lib/modules/shared/app-context";

const LAYOUT = [
  { id: "a", slug: "a", title: "A", tier: "PUBLIC", showInSidebar: true, isMainFeatured: true, sidebarOrder: 0, premiereAt: null },
  { id: "b", slug: "b", title: "B", tier: "LOGGED_IN", showInSidebar: true, isMainFeatured: false, sidebarOrder: 1, premiereAt: null },
];
const ctx = { prisma: { video: { findMany: vi.fn(async () => LAYOUT) } }, actor: { type: "admin", userId: "adm" } } as unknown as AppContext;
const ok = <T,>(data: T) => ({ ok: true as const, data });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_R2_PUBLIC_HOST = "thumbs.example.com";
  process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC = "pub";
  m.video.reorderAdminVideos.mockResolvedValue(ok(undefined));
  m.video.updateAdminVideo.mockResolvedValue(ok({}));
});

describe("saveChannelLayout", () => {
  it("saves order and visibility in one call and audits it", async () => {
    const r = await saveChannelLayout({ order: ["b", "a"], hidden: ["a"], heroId: "a" }, ctx);
    expect(r).toEqual({ ok: true, data: { saved: 2 } });
    expect(m.video.reorderAdminVideos).toHaveBeenCalledWith([{ id: "b", sidebarOrder: 0, showInSidebar: true }, { id: "a", sidebarOrder: 1, showInSidebar: false }], ctx);
    expect(m.video.updateAdminVideo).not.toHaveBeenCalled(); // Hero unchanged
    expect(m.audit.recordAuditEventSafe).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "VIDEO_LAYOUT_SAVED" }));
  });

  it("changes the Hero through updateAdminVideo (Hero rules stay in the use case)", async () => {
    await saveChannelLayout({ order: ["a", "b"], hidden: [], heroId: "b" }, ctx);
    expect(m.video.updateAdminVideo).toHaveBeenCalledWith({ id: "b", isMainFeatured: true }, ctx);
  });

  it("refuses a stale or duplicated list", async () => {
    for (const order of [["a", "b", "x"], ["a", "a"]]) {
      const r = await saveChannelLayout({ order, hidden: [], heroId: null }, ctx);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("LAYOUT_STALE");
    }
    expect(m.video.reorderAdminVideos).not.toHaveBeenCalled();
  });
});

describe("deleteVideoWithStorage", () => {
  it("snapshots storage, deletes the row, purges R2 and our own subtitle files", async () => {
    m.video.getAdminVideoDetails.mockResolvedValue(ok({ id: "v1", subtitleUrlPl: "https://thumbs.example.com/videos/v1/subtitles/h.vtt", subtitleUrlEn: "https://other.example.com/x.vtt" }));
    m.video.deleteAdminVideo.mockResolvedValue(ok({ id: "v1" }));
    const r = await deleteVideoWithStorage("v1", ctx);
    expect(r.ok).toBe(true);
    expect(m.pipeline.snapshotVideoStorage).toHaveBeenCalledBefore(m.video.deleteAdminVideo);
    expect(m.pipeline.purgeVideoStorage).toHaveBeenCalledWith("v1", { keys: ["a"] });
    expect(m.deletePublic).toHaveBeenCalledTimes(1);
    expect(m.deletePublic).toHaveBeenCalledWith("videos/v1/subtitles/h.vtt");
  });

  it("purges nothing when the delete is refused", async () => {
    m.video.getAdminVideoDetails.mockResolvedValue(ok({ id: "v1", subtitleUrlPl: null, subtitleUrlEn: null }));
    m.video.deleteAdminVideo.mockResolvedValue({ ok: false, error: { code: "VIDEO_NOT_FOUND" } });
    const r = await deleteVideoWithStorage("v1", ctx);
    expect(r.ok).toBe(false);
    expect(m.pipeline.purgeVideoStorage).not.toHaveBeenCalled();
  });
});
