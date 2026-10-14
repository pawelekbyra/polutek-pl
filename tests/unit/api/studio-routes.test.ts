import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  resolveStudioSession: vi.fn(),
  createChannel: vi.fn(),
  updateChannelProfile: vi.fn(),
  requestChannelDeletion: vi.fn(),
  changeChannelHandle: vi.fn(),
  checkHandleAvailability: vi.fn(),
  createAdminVideo: vi.fn(),
  getAdminVideoList: vi.fn(),
  getAdminVideoDetails: vi.fn(),
  updateAdminVideo: vi.fn(),
  cancelAutoPublish: vi.fn(),
  unpublishAdminVideo: vi.fn(),
  listPanelComments: vi.fn(),
  getModerationCounts: vi.fn(),
  hideAdminComment: vi.fn(),
  createCreatorReply: vi.fn(),
  startOriginalUpload: vi.fn(),
  getChannelLimitsView: vi.fn(),
}));

vi.mock("@/lib/api/studio-session", () => ({ resolveStudioSession: m.resolveStudioSession }));
vi.mock("@/lib/modules/channel", () => ({
  createChannel: m.createChannel,
  updateChannelProfile: m.updateChannelProfile,
  requestChannelDeletion: m.requestChannelDeletion,
  changeChannelHandle: m.changeChannelHandle,
  checkHandleAvailability: m.checkHandleAvailability,
  restoreChannel: vi.fn(),
  listMyChannels: vi.fn(),
}));
vi.mock("@/lib/modules/video", () => ({
  createAdminVideo: m.createAdminVideo,
  getAdminVideoList: m.getAdminVideoList,
  getAdminVideoDetails: m.getAdminVideoDetails,
  updateAdminVideo: m.updateAdminVideo,
  publishAdminVideo: vi.fn(),
  archiveAdminVideo: vi.fn(),
  cancelAutoPublish: m.cancelAutoPublish,
  unpublishAdminVideo: m.unpublishAdminVideo,
}));
vi.mock("@/lib/modules/admin-content", async () => ({
  slugify: (await vi.importActual<typeof import("@/lib/modules/admin-content/domain/files")>("@/lib/modules/admin-content/domain/files")).slugify,
  deleteVideoWithStorage: vi.fn(),
  uploadVideoCover: vi.fn(),
  COVER_MAX_BYTES: 5 * 1024 * 1024,
}));
vi.mock("@/lib/modules/video-pipeline", () => ({
  startOriginalUpload: m.startOriginalUpload,
  listOriginalParts: vi.fn(),
  abortOriginalUpload: vi.fn(),
  presignOriginalParts: vi.fn(),
  completeOriginalMultipart: vi.fn(),
  getPipelineState: vi.fn(),
  cancelEncode: vi.fn(),
  getChannelLimitsView: m.getChannelLimitsView,
}));
vi.mock("@/lib/modules/comments", () => ({
  listPanelComments: m.listPanelComments,
  getModerationCounts: m.getModerationCounts,
  hideAdminComment: m.hideAdminComment,
  approveHeldComment: vi.fn(),
  deleteAdminComment: vi.fn(),
  holdCommentForReview: vi.fn(),
  restoreAdminComment: vi.fn(),
  setAdminCommentHeart: vi.fn(),
  createCreatorReply: m.createCreatorReply,
}));

import { AppError } from "@/lib/modules/shared/app-error";
import { describeError } from "@/lib/api/studio-route";
import { GET as meGet } from "@/app/api/studio/me/route";
import { POST as channelPost, PATCH as channelPatch } from "@/app/api/studio/channel/route";
import { GET as handleGet } from "@/app/api/studio/channel/handle/route";
import { POST as videosPost, GET as videosGet } from "@/app/api/studio/videos/route";
import { PATCH as videoPatch, GET as videoGet } from "@/app/api/studio/videos/[id]/route";
import { POST as publishPost } from "@/app/api/studio/videos/[id]/publish/route";
import { POST as uploadPost } from "@/app/api/studio/videos/[id]/upload/route";
import { GET as commentsGet } from "@/app/api/studio/comments/route";
import { POST as commentPost } from "@/app/api/studio/comments/[id]/route";

const channel = { id: "ch-1", slug: "moj", handle: "moj", name: "Mój", status: "ACTIVE", isVerified: false, language: "pl", country: null };
const ctx = { actor: { type: "user", userId: "u1" }, channelId: "ch-1" };
const session = { ctx, userId: "u1", channel, channels: [channel] };

const req = (url: string, init?: RequestInit) => new Request(`https://www.pawelperfect.com${url}`, init);
const json = (body: unknown, method = "POST") => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  m.resolveStudioSession.mockResolvedValue(session);
  delete process.env.PLATFORM_GATE_CHANNEL_CREATION;
});

describe("Studio API: session and channel", () => {
  it("answers 401 without a session on every handler", async () => {
    m.resolveStudioSession.mockResolvedValue(null);
    expect((await meGet(req("/api/studio/me"))).status).toBe(401);
    expect((await videosGet(req("/api/studio/videos"))).status).toBe(401);
    expect((await commentsGet(req("/api/studio/comments"))).status).toBe(401);
  });

  it("answers 409 NO_CHANNEL for a user without a channel when one is needed", async () => {
    m.resolveStudioSession.mockResolvedValue({ ...session, channel: null, channels: [] });
    const response = await videosGet(req("/api/studio/videos"));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("NO_CHANNEL");
    expect((await meGet(req("/api/studio/me"))).status).toBe(200);
  });

  it("reports the channel creation gate in /me (off by default)", async () => {
    const body = await (await meGet(req("/api/studio/me"))).json();
    expect(body.channelCreation).toBe("off");
    process.env.PLATFORM_GATE_CHANNEL_CREATION = "invite";
    expect((await (await meGet(req("/api/studio/me"))).json()).channelCreation).toBe("invite");
  });

  it("exposes the current channel's limits (read only) and survives a failed lookup", async () => {
    m.getChannelLimitsView.mockResolvedValueOnce({ maxVideoSeconds: 900, maxUploadBytes: 1000, maxUploadsPerDay: 5 });
    expect((await (await meGet(req("/api/studio/me"))).json()).limits).toEqual({ maxVideoSeconds: 900, maxUploadBytes: 1000, maxUploadsPerDay: 5 });
    m.getChannelLimitsView.mockRejectedValueOnce(new Error("db down"));
    const failed = await meGet(req("/api/studio/me"));
    expect(failed.status).toBe(200);
    expect((await failed.json()).limits).toBeNull();
  });

  it("creates a channel with the validated body and answers 201", async () => {
    m.createChannel.mockResolvedValue({ ok: true, data: channel });
    const response = await channelPost(req("/api/studio/channel", json({ name: "Mój", handle: "moj", ignored: "x" })));
    expect(response.status).toBe(201);
    expect(m.createChannel).toHaveBeenCalledWith(ctx, { name: "Mój", handle: "moj" });
  });

  it("rejects a malformed body with 400 and does not call the use case", async () => {
    const response = await channelPost(req("/api/studio/channel", json({ name: "", handle: "x" })));
    expect(response.status).toBe(400);
    expect(m.createChannel).not.toHaveBeenCalled();
    const notJson = await channelPatch(req("/api/studio/channel", { method: "PATCH", body: "nope" }));
    expect(notJson.status).toBe(400);
  });

  it("surfaces a use case's error status and message, not internals", async () => {
    m.createChannel.mockResolvedValue({ ok: false, error: new AppError("Zakładanie kanałów nie jest jeszcze otwarte.", 403, "CHANNEL_CREATION_CLOSED") });
    const response = await channelPost(req("/api/studio/channel", json({ name: "Mój", handle: "moj" })));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Zakładanie kanałów nie jest jeszcze otwarte.", code: "CHANNEL_CREATION_CLOSED" });
  });

  it("needs a handle for the availability check", async () => {
    expect((await handleGet(req("/api/studio/channel/handle"))).status).toBe(400);
    m.checkHandleAvailability.mockResolvedValue({ available: true, handle: "moj" });
    const ok = await handleGet(req("/api/studio/channel/handle?handle=moj"));
    expect(await ok.json()).toEqual({ available: true, handle: "moj" });
    expect(m.checkHandleAvailability).toHaveBeenCalledWith(ctx, "moj", { exceptChannelId: "ch-1" });
  });
});

describe("Studio API: videos", () => {
  it("creates a draft with a unique slug (title plus random suffix) and PUBLIC tier by default", async () => {
    m.createAdminVideo.mockResolvedValue({ ok: true, data: { id: "v1" } });
    const response = await videosPost(req("/api/studio/videos", json({ title: "Mój Pierwszy Film" })));
    expect(response.status).toBe(201);
    const input = m.createAdminVideo.mock.calls[0][0];
    expect(input.slug).toMatch(/^moj-pierwszy-film-[0-9a-f]{6}$/);
    expect(input.tier).toBe("PUBLIC");
    expect(input).not.toHaveProperty("status");
  });

  it("never lets a creator set the tier to anything but PUBLIC or LOGGED_IN, or set protected fields", async () => {
    const bad = await videosPost(req("/api/studio/videos", json({ title: "Film", tier: "PATRON" })));
    expect(bad.status).toBe(400);
    m.updateAdminVideo.mockResolvedValue({ ok: true, data: { id: "v1" } });
    await videoPatch(
      req("/api/studio/videos/v1", json({ title: "Nowy", isMainFeatured: true, status: "PUBLISHED", creatorId: "other" }, "PATCH")),
      params("v1"),
    );
    expect(m.updateAdminVideo).toHaveBeenCalledWith({ id: "v1", title: "Nowy" }, ctx);
  });

  it("converts premiereAt to a Date and null to null", async () => {
    m.updateAdminVideo.mockResolvedValue({ ok: true, data: { id: "v1" } });
    await videoPatch(req("/api/studio/videos/v1", json({ premiereAt: "2026-12-01T18:00:00Z" }, "PATCH")), params("v1"));
    expect(m.updateAdminVideo.mock.calls[0][0].premiereAt).toEqual(new Date("2026-12-01T18:00:00Z"));
    await videoPatch(req("/api/studio/videos/v1", json({ premiereAt: null }, "PATCH")), params("v1"));
    expect(m.updateAdminVideo.mock.calls[1][0].premiereAt).toBeNull();
  });

  it("returns video details without the audit trail", async () => {
    m.getAdminVideoDetails.mockResolvedValue({ ok: true, data: { id: "v1", title: "T", diagnostics: [], auditLogs: [{ actorUserId: "adm" }] } });
    const body = await (await videoGet(req("/api/studio/videos/v1"), params("v1"))).json();
    expect(body).toEqual({ id: "v1", title: "T", diagnostics: [] });
  });

  it("starts an upload through the same use case as the panel", async () => {
    m.startOriginalUpload.mockResolvedValue({ ok: true, data: { originalId: "o1", partSize: 1, partCount: 1, fileSize: 10, version: 1 } });
    const response = await uploadPost(req("/api/studio/videos/v1/upload", json({ fileName: "a.mp4", fileSize: 10 })), params("v1"));
    expect(response.status).toBe(200);
    expect(m.startOriginalUpload).toHaveBeenCalledWith({ videoId: "v1", fileName: "a.mp4", fileSize: 10 }, ctx);
  });

  it("clamps list paging", async () => {
    m.getAdminVideoList.mockResolvedValue({ ok: true, data: { items: [] } });
    await videosGet(req("/api/studio/videos?limit=9999&page=-3"));
    expect(m.getAdminVideoList).toHaveBeenCalledWith({ page: 1, limit: 50, query: undefined, status: undefined }, ctx);
  });

  it("passes only whitelisted search, status and sort to the list use case", async () => {
    m.getAdminVideoList.mockResolvedValue({ ok: true, data: { items: [] } });
    await videosGet(req("/api/studio/videos?q=kot&status=DRAFT&sort=views&limit=10&page=2"));
    expect(m.getAdminVideoList).toHaveBeenLastCalledWith({ page: 2, limit: 10, query: "kot", status: "DRAFT", orderBy: "views" }, ctx);
    await videosGet(req("/api/studio/videos?sort=newest"));
    expect(m.getAdminVideoList.mock.calls[1][0].orderBy).toBe("createdAt");
  });

  it("answers 400 for an unknown status or sort and does not reach the use case", async () => {
    expect((await videosGet(req("/api/studio/videos?status=REMOVED"))).status).toBe(400);
    expect((await videosGet(req("/api/studio/videos?sort=password"))).status).toBe(400);
    expect(m.getAdminVideoList).not.toHaveBeenCalled();
  });

  it("creates a private draft by default and maps the visibility fields of the wizard", async () => {
    m.createAdminVideo.mockResolvedValue({ ok: true, data: { id: "v1" } });
    await videosPost(req("/api/studio/videos", json({ title: "Film" })));
    expect(m.createAdminVideo.mock.calls[0][0]).toMatchObject({ publishAfterAssetReady: false, premiereAt: null });
    await videosPost(
      req("/api/studio/videos", json({ title: "Film", publishAfterAssetReady: true, premiereAt: "2026-12-01T18:00:00Z", tier: "LOGGED_IN", description: "Opis" })),
    );
    expect(m.createAdminVideo.mock.calls[1][0]).toMatchObject({
      publishAfterAssetReady: true,
      premiereAt: new Date("2026-12-01T18:00:00Z"),
      tier: "LOGGED_IN",
      description: "Opis",
    });
    expect(m.createAdminVideo.mock.calls[1][1]).toBe(ctx);
  });

  it("passes tags, category and comments mode on create and refuses values outside the whitelist", async () => {
    m.createAdminVideo.mockResolvedValue({ ok: true, data: { id: "v1" } });
    await videosPost(req("/api/studio/videos", json({ title: "Film", tags: ["#a", "A", "b"], category: "music", commentsMode: "HELD" })));
    expect(m.createAdminVideo.mock.calls[0][0]).toMatchObject({ tags: ["a", "b"], category: "music", commentsMode: "HELD" });
    expect((await videosPost(req("/api/studio/videos", json({ title: "Film", category: "cats" })))).status).toBe(400);
    expect((await videosPost(req("/api/studio/videos", json({ title: "Film", commentsMode: "ALL" })))).status).toBe(400);
    expect((await videosPost(req("/api/studio/videos", json({ title: "Film", tags: ["a".repeat(31)] })))).status).toBe(400);
  });

  it("cancels the automatic publication through the publish route's whitelist", async () => {
    m.cancelAutoPublish.mockResolvedValue({ ok: true, data: { id: "v1", publishAfterAssetReady: false } });
    const res = await publishPost(req("/api/studio/videos/v1/publish", json({ action: "cancel_auto_publish" })), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(200);
    expect(m.cancelAutoPublish).toHaveBeenCalledWith("v1", ctx);
    expect((await publishPost(req("/api/studio/videos/v1/publish", json({ action: "delete" })), { params: Promise.resolve({ id: "v1" }) })).status).toBe(400);
  });

  it("unpublishes through the publish route's whitelist", async () => {
    m.unpublishAdminVideo.mockResolvedValue({ ok: true, data: { id: "v1", status: "DRAFT" } });
    const res = await publishPost(req("/api/studio/videos/v1/publish", json({ action: "unpublish" })), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(200);
    expect(m.unpublishAdminVideo).toHaveBeenCalledWith("v1", ctx);
  });

  it("rejects a title over 100 and a description over 5000 characters", async () => {
    expect((await videosPost(req("/api/studio/videos", json({ title: "a".repeat(101) })))).status).toBe(400);
    expect((await videosPost(req("/api/studio/videos", json({ title: "t", description: "d".repeat(5001) })))).status).toBe(400);
  });
});

describe("Studio API: comments", () => {
  it("always scopes the list to the user's channel, whatever the query says", async () => {
    m.listPanelComments.mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    m.getModerationCounts.mockResolvedValue({ ok: true, data: { comments: 0, held: 0, pendingReports: 0 } });
    await commentsGet(req("/api/studio/comments?channelId=other&status=HIDDEN"));
    expect(m.listPanelComments.mock.calls[0][1]).toMatchObject({ channelId: "ch-1", status: "HIDDEN" });
    expect(m.getModerationCounts).toHaveBeenCalledWith(ctx, { channelId: "ch-1" });
  });

  it("runs the requested moderation action and requires text for a reply", async () => {
    m.hideAdminComment.mockResolvedValue({ ok: true, data: undefined });
    expect((await commentPost(req("/api/studio/comments/c1", json({ action: "hide" })), params("c1"))).status).toBe(200);
    expect(m.hideAdminComment).toHaveBeenCalledWith("c1", ctx);

    expect((await commentPost(req("/api/studio/comments/c1", json({ action: "reply" })), params("c1"))).status).toBe(400);
    m.createCreatorReply.mockResolvedValue({ ok: true, data: { id: "r1" } });
    await commentPost(req("/api/studio/comments/c1", json({ action: "reply", text: "Dzięki", heart: true })), params("c1"));
    expect(m.createCreatorReply).toHaveBeenCalledWith(ctx, { commentId: "c1", text: "Dzięki", heart: true });
  });

  it("maps the comments module's tagged errors to statuses", async () => {
    m.hideAdminComment.mockResolvedValue({ ok: false, error: { type: "UNAUTHORIZED", message: "Nie masz dostępu do tego kanału." } });
    const response = await commentPost(req("/api/studio/comments/c-b", json({ action: "hide" })), params("c-b"));
    expect(response.status).toBe(401);
  });
});

describe("describeError", () => {
  it("never leaks text of a 500", () => {
    expect(describeError({ type: "DATABASE_ERROR", message: "relation Creator missing" }).message).toBe("Błąd serwera. Spróbuj ponownie.");
    expect(describeError(new Error("boom")).status).toBe(500);
  });
});
