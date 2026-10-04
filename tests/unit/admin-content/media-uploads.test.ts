import { beforeEach, describe, expect, it, vi } from "vitest";

const video = vi.hoisted(() => ({
  getAdminVideoById: vi.fn(),
  updateAdminVideo: vi.fn(),
}));
const audit = vi.hoisted(() => ({ recordAuditEventSafe: vi.fn(async () => undefined) }));
vi.mock("@/lib/modules/video", () => video);
vi.mock("@/lib/modules/audit", () => audit);
const tr = vi.hoisted(() => ({ setTranslationSubtitle: vi.fn(async () => ({ ok: true as const, data: { previous: null } })) }));
vi.mock("@/lib/modules/translations", async () => ({ ...(await vi.importActual<object>("@/lib/modules/translations")), ...tr }));

import { removeVideoSubtitle, uploadVideoCover, uploadVideoSubtitle } from "@/lib/modules/admin-content";
import type { AppContext } from "@/lib/modules/shared/app-context";

const findTranslation = vi.fn();
const ctx = { actor: { type: "admin", userId: "adm1" }, prisma: { videoTranslation: { findUnique: findTranslation } } } as unknown as AppContext;
const ok = <T,>(data: T) => ({ ok: true as const, data });
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const VTT = new TextEncoder().encode("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nCześć\n");

function storage() {
  return {
    putPrivate: vi.fn(async (i: { scope: string; extension: string }) => ({ key: `${i.scope}/hash.${i.extension}`, storageUrl: `https://acc.r2.cloudflarestorage.com/priv/${i.scope}/hash.${i.extension}` })),
    copyToPublic: vi.fn(async (key: string) => `https://thumbs.example.com/${key}`),
    deletePrivate: vi.fn(async () => undefined),
    deletePublic: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_R2_PUBLIC_HOST = "thumbs.example.com";
  process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC = "pub";
  video.getAdminVideoById.mockResolvedValue(ok({ id: "v1", subtitleUrlPl: "https://thumbs.example.com/videos/v1/subtitles/old.vtt", subtitleUrlEn: null }));
  video.updateAdminVideo.mockResolvedValue(ok({ id: "v1", slug: "czesc" }));
});

describe("uploadVideoCover", () => {
  it("stores a real image privately and points the film at it through updateAdminVideo", async () => {
    const s = storage();
    const r = await uploadVideoCover({ videoId: "v1", bytes: JPEG }, ctx, s as never);
    expect(r.ok).toBe(true);
    expect(s.putPrivate).toHaveBeenCalledWith(expect.objectContaining({ scope: "videos/v1/covers", contentType: "image/jpeg", extension: "jpg" }));
    expect(video.updateAdminVideo).toHaveBeenCalledWith({ id: "v1", thumbnailUrl: expect.stringContaining("/videos/v1/covers/") }, ctx);
    expect(audit.recordAuditEventSafe).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "VIDEO_COVER_UPLOADED", targetId: "v1" }));
  });

  it("refuses a non-image before touching storage", async () => {
    const s = storage();
    const r = await uploadVideoCover({ videoId: "v1", bytes: new TextEncoder().encode("<svg/>") }, ctx, s as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("COVER_INVALID_TYPE");
    expect(s.putPrivate).not.toHaveBeenCalled();
  });

  it("refuses an unknown film before storing anything", async () => {
    video.getAdminVideoById.mockResolvedValue({ ok: false, error: { code: "VIDEO_NOT_FOUND", statusCode: 404 } });
    const s = storage();
    const r = await uploadVideoCover({ videoId: "nope", bytes: JPEG }, ctx, s as never);
    expect(r.ok).toBe(false);
    expect(s.putPrivate).not.toHaveBeenCalled();
  });

  it("says when R2 is not configured", async () => {
    const r = await uploadVideoCover({ videoId: "v1", bytes: JPEG }, ctx, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("R2_NOT_CONFIGURED");
  });
});

describe("uploadVideoSubtitle", () => {
  it("publishes a valid file under videos/<id>/subtitles, updates the film and removes the previous file", async () => {
    const s = storage();
    const r = await uploadVideoSubtitle({ videoId: "v1", lang: "pl", bytes: VTT }, ctx, s as never);
    expect(r).toEqual({ ok: true, data: { url: "https://thumbs.example.com/videos/v1/subtitles/hash.vtt", cues: 1 } });
    expect(s.putPrivate).toHaveBeenCalledWith(expect.objectContaining({ scope: "videos/v1/subtitles", contentType: "text/vtt; charset=utf-8" }));
    expect(s.deletePrivate).toHaveBeenCalledWith("videos/v1/subtitles/hash.vtt");
    expect(video.updateAdminVideo).toHaveBeenCalledWith({ id: "v1", subtitleUrlPl: "https://thumbs.example.com/videos/v1/subtitles/hash.vtt" }, ctx);
    expect(s.deletePublic).toHaveBeenCalledWith("videos/v1/subtitles/old.vtt");
  });

  it("never deletes a foreign subtitle URL (old panel paste)", async () => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: "v1", subtitleUrlPl: null, subtitleUrlEn: "https://thumbs.example.com/videos/v1/covers/x.jpg" }));
    const s = storage();
    await uploadVideoSubtitle({ videoId: "v1", lang: "en", bytes: VTT }, ctx, s as never);
    expect(s.deletePublic).not.toHaveBeenCalled();
  });

  it("refuses invalid WebVTT without storing anything", async () => {
    const s = storage();
    const r = await uploadVideoSubtitle({ videoId: "v1", lang: "pl", bytes: new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\nx") }, ctx, s as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SUBTITLE_INVALID");
    expect(s.putPrivate).not.toHaveBeenCalled();
  });
});

describe("subtitles of translation languages", () => {
  it("en also mirrors the URL into its translation row", async () => {
    await uploadVideoSubtitle({ videoId: "v1", lang: "en", bytes: VTT }, ctx, storage() as never);
    expect(video.updateAdminVideo).toHaveBeenCalledWith(expect.objectContaining({ subtitleUrlEn: expect.any(String) }), ctx);
    expect(tr.setTranslationSubtitle).toHaveBeenCalledWith({ videoId: "v1", language: "en", url: expect.stringContaining("/subtitles/") }, ctx);
  });

  it("de needs its translation row first and stores nothing without it", async () => {
    findTranslation.mockResolvedValue(null);
    const s = storage();
    const r = await uploadVideoSubtitle({ videoId: "v1", lang: "de", bytes: VTT }, ctx, s as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TRANSLATION_MISSING");
    expect(s.putPrivate).not.toHaveBeenCalled();
  });

  it("de with a row: stored on the translation, the old file removed, Video columns untouched", async () => {
    findTranslation.mockResolvedValue({ subtitleUrl: "https://thumbs.example.com/videos/v1/subtitles/de-old.vtt" });
    const s = storage();
    const r = await uploadVideoSubtitle({ videoId: "v1", lang: "de", bytes: VTT }, ctx, s as never);
    expect(r.ok).toBe(true);
    expect(video.updateAdminVideo).not.toHaveBeenCalled();
    expect(tr.setTranslationSubtitle).toHaveBeenCalledWith(expect.objectContaining({ language: "de" }), ctx);
    expect(s.deletePublic).toHaveBeenCalledWith("videos/v1/subtitles/de-old.vtt");
  });

  it("refuses an unknown language", async () => {
    const r = await uploadVideoSubtitle({ videoId: "v1", lang: "xx", bytes: VTT }, ctx, storage() as never);
    expect(r.ok).toBe(false);
  });
});

describe("removeVideoSubtitle", () => {
  it("clears the column first, then deletes our own file", async () => {
    const s = storage();
    const r = await removeVideoSubtitle({ videoId: "v1", lang: "pl" }, ctx, s as never);
    expect(r).toEqual({ ok: true, data: { removed: true } });
    expect(video.updateAdminVideo).toHaveBeenCalledWith({ id: "v1", subtitleUrlPl: null }, ctx);
    expect(s.deletePublic).toHaveBeenCalledWith("videos/v1/subtitles/old.vtt");
    expect(audit.recordAuditEventSafe).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "VIDEO_SUBTITLES_REMOVED" }));
  });

  it("is a no-op when the language has no file", async () => {
    const s = storage();
    const r = await removeVideoSubtitle({ videoId: "v1", lang: "en" }, ctx, s as never);
    expect(r).toEqual({ ok: true, data: { removed: false } });
    expect(video.updateAdminVideo).not.toHaveBeenCalled();
  });
});
