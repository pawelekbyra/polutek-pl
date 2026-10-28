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

const VID = "c52f0407-b0e8-4b5c-b6d3-a9f152653002";
const HASH = "c".repeat(64);
const OLD_HASH = "d".repeat(64);
const fileOf = (lang: string, hash = HASH) => `${lang}-${hash}.vtt`;
/** Private caption storage (HLS bucket) plus the optional legacy public bucket. */
function captionStorage(over: Record<string, unknown> = {}) {
  return {
    putCaption: vi.fn(async (i: { videoId: string; lang: string }) => ({ file: fileOf(i.lang), key: `videos/${i.videoId}/captions/${fileOf(i.lang)}` })),
    deleteCaption: vi.fn(async () => undefined),
    deletePublic: vi.fn(async () => undefined),
    ...over,
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
  beforeEach(() => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: `https://thumbs.example.com/videos/${VID}/subtitles/old.vtt`, subtitleUrlEn: null }));
  });

  it("stores a valid file PRIVATELY, points the film at a reference (not a URL) and removes the previous public file", async () => {
    const s = captionStorage();
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "pl", bytes: VTT }, ctx, s as never);
    expect(r).toEqual({ ok: true, data: { url: `hlscap:${fileOf("pl")}`, cues: 1 } });
    expect(s.putCaption).toHaveBeenCalledWith({ videoId: VID, lang: "pl", bytes: expect.any(Uint8Array) });
    expect(video.updateAdminVideo).toHaveBeenCalledWith({ id: VID, subtitleUrlPl: `hlscap:${fileOf("pl")}` }, ctx);
    expect(JSON.stringify(video.updateAdminVideo.mock.calls)).not.toMatch(/https?:/);
    expect(s.deletePublic).toHaveBeenCalledWith(`videos/${VID}/subtitles/old.vtt`);
    expect(s.deleteCaption).not.toHaveBeenCalled();
  });

  it("replacing a private file removes the old private object, but never the file it just wrote", async () => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: `hlscap:${fileOf("pl", OLD_HASH)}`, subtitleUrlEn: null }));
    const s = captionStorage();
    await uploadVideoSubtitle({ videoId: VID, lang: "pl", bytes: VTT }, ctx, s as never);
    expect(s.deleteCaption).toHaveBeenCalledTimes(1);
    expect(s.deleteCaption).toHaveBeenCalledWith(VID, `videos/${VID}/captions/${fileOf("pl", OLD_HASH)}`);
    expect(s.deletePublic).not.toHaveBeenCalled();

    // Uploading identical bytes again keeps the one file.
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: `hlscap:${fileOf("pl")}`, subtitleUrlEn: null }));
    const same = captionStorage();
    await uploadVideoSubtitle({ videoId: VID, lang: "pl", bytes: VTT }, ctx, same as never);
    expect(same.deleteCaption).not.toHaveBeenCalled();
  });

  it("removes the new file again when the row could not be written (no orphan, nothing public)", async () => {
    video.updateAdminVideo.mockResolvedValue({ ok: false, error: { code: "DB", statusCode: 500 } });
    const s = captionStorage();
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "pl", bytes: VTT }, ctx, s as never);
    expect(r.ok).toBe(false);
    expect(s.deleteCaption).toHaveBeenCalledWith(VID, `videos/${VID}/captions/${fileOf("pl")}`);
    expect(s.deletePublic).not.toHaveBeenCalled();
  });

  it("reports a storage failure instead of changing the row", async () => {
    const s = captionStorage({ putCaption: vi.fn(async () => { throw new Error("AccessDenied"); }) });
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "pl", bytes: VTT }, ctx, s as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CAPTION_STORAGE_FAILED");
    expect(video.updateAdminVideo).not.toHaveBeenCalled();
  });

  it("never deletes a foreign subtitle URL (old panel paste)", async () => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: null, subtitleUrlEn: `https://thumbs.example.com/videos/${VID}/covers/x.jpg` }));
    const s = captionStorage();
    await uploadVideoSubtitle({ videoId: VID, lang: "en", bytes: VTT }, ctx, s as never);
    expect(s.deletePublic).not.toHaveBeenCalled();
    expect(s.deleteCaption).not.toHaveBeenCalled();
  });

  it("refuses invalid WebVTT without storing anything", async () => {
    const s = captionStorage();
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "pl", bytes: new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\nx") }, ctx, s as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SUBTITLE_INVALID");
    expect(s.putCaption).not.toHaveBeenCalled();
  });

  it("says when R2 is not configured", async () => {
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "pl", bytes: VTT }, ctx, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("R2_NOT_CONFIGURED");
  });
});

describe("subtitles of translation languages", () => {
  beforeEach(() => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: null, subtitleUrlEn: null }));
  });

  it("en also mirrors the reference into its translation row", async () => {
    await uploadVideoSubtitle({ videoId: VID, lang: "en", bytes: VTT }, ctx, captionStorage() as never);
    expect(video.updateAdminVideo).toHaveBeenCalledWith({ id: VID, subtitleUrlEn: `hlscap:${fileOf("en")}` }, ctx);
    expect(tr.setTranslationSubtitle).toHaveBeenCalledWith({ videoId: VID, language: "en", url: `hlscap:${fileOf("en")}` }, ctx);
  });

  it("de needs its translation row first and stores nothing without it", async () => {
    findTranslation.mockResolvedValue(null);
    const s = captionStorage();
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "de", bytes: VTT }, ctx, s as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TRANSLATION_MISSING");
    expect(s.putCaption).not.toHaveBeenCalled();
  });

  it("de with a row: stored on the translation, the old file removed, Video columns untouched", async () => {
    findTranslation.mockResolvedValue({ subtitleUrl: `https://thumbs.example.com/videos/${VID}/subtitles/de-old.vtt` });
    const s = captionStorage();
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "de", bytes: VTT }, ctx, s as never);
    expect(r.ok).toBe(true);
    expect(video.updateAdminVideo).not.toHaveBeenCalled();
    expect(tr.setTranslationSubtitle).toHaveBeenCalledWith({ videoId: VID, language: "de", url: `hlscap:${fileOf("de")}` }, ctx);
    expect(s.deletePublic).toHaveBeenCalledWith(`videos/${VID}/subtitles/de-old.vtt`);
  });

  it("refuses an unknown language", async () => {
    const r = await uploadVideoSubtitle({ videoId: VID, lang: "xx", bytes: VTT }, ctx, captionStorage() as never);
    expect(r.ok).toBe(false);
  });
});

describe("removeVideoSubtitle", () => {
  it("clears the column first, then deletes the private file", async () => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: `hlscap:${fileOf("pl")}`, subtitleUrlEn: null }));
    const s = captionStorage();
    const r = await removeVideoSubtitle({ videoId: VID, lang: "pl" }, ctx, s as never);
    expect(r).toEqual({ ok: true, data: { removed: true } });
    expect(video.updateAdminVideo).toHaveBeenCalledWith({ id: VID, subtitleUrlPl: null }, ctx);
    expect(s.deleteCaption).toHaveBeenCalledWith(VID, `videos/${VID}/captions/${fileOf("pl")}`);
    expect(audit.recordAuditEventSafe).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "VIDEO_SUBTITLES_REMOVED" }));
  });

  it("still deletes a legacy public file", async () => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: `https://thumbs.example.com/videos/${VID}/subtitles/old.vtt`, subtitleUrlEn: null }));
    const s = captionStorage();
    await removeVideoSubtitle({ videoId: VID, lang: "pl" }, ctx, s as never);
    expect(s.deletePublic).toHaveBeenCalledWith(`videos/${VID}/subtitles/old.vtt`);
  });

  it("is a no-op when the language has no file", async () => {
    video.getAdminVideoById.mockResolvedValue(ok({ id: VID, subtitleUrlPl: null, subtitleUrlEn: null }));
    const s = captionStorage();
    const r = await removeVideoSubtitle({ videoId: VID, lang: "en" }, ctx, s as never);
    expect(r).toEqual({ ok: true, data: { removed: false } });
    expect(video.updateAdminVideo).not.toHaveBeenCalled();
  });
});
