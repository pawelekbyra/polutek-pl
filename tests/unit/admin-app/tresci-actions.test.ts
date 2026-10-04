import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  video: {
    createAdminVideo: vi.fn(),
    getAdminVideoById: vi.fn(),
    getAdminVideoDiagnostics: vi.fn(),
    publishAdminVideo: vi.fn(),
    archiveAdminVideo: vi.fn(),
    updateAdminVideo: vi.fn(),
    requestPublishAfterAssetReady: vi.fn(async () => undefined),
    VideoPolicy: { isAssetReadinessBlocker: (c: string) => ["VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE", "VIDEO_PUBLICATION_ASSET_NOT_READY"].includes(c) },
  },
  content: { deleteVideoWithStorage: vi.fn(), removeVideoSubtitle: vi.fn(), saveChannelLayout: vi.fn() },
  guard: { requireAdmin: vi.fn(async () => ({ userId: "adm1", email: "o@x", name: "O", sessionCreatedAt: "", stepUpSecondsLeft: 0 })), hasFreshStepUp: vi.fn(async () => true) },
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-ray": "ray1" }) }));
vi.mock("@/lib/modules/video", () => m.video);
vi.mock("@/lib/modules/video-pipeline", () => ({ enqueueEncode: vi.fn(), cancelEncode: vi.fn(), deleteSelfHlsAsset: vi.fn() }));
vi.mock("@/lib/modules/admin-content", async () => ({ ...m.content, slugify: (await vi.importActual<typeof import("@/lib/modules/admin-content/domain/files")>("@/lib/modules/admin-content/domain/files")).slugify }));
vi.mock("@admin/lib/auth/guard", () => m.guard);

import { createFilmAction, deleteFilmAction, filmStatusAction, saveFilmAction } from "@admin/app/(panel)/tresci/actions";

const UPDATED = new Date("2026-10-04T10:00:00Z");
const FILM = { id: "v1", slug: "czesc", title: "Cześć", status: "DRAFT", premiereAt: null, updatedAt: UPDATED, tier: "PUBLIC" };
const ok = <T,>(data: T) => ({ ok: true as const, data });

function form(over: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = { id: "v1", expectedUpdatedAt: UPDATED.toISOString(), title: "Cześć", slug: "czesc", titleEn: "", description: "", descriptionEn: "", tier: "PUBLIC", when: "draft", fundMode: "off", ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_DEV_FIXTURES;
  m.video.getAdminVideoById.mockResolvedValue(ok(FILM));
  m.video.updateAdminVideo.mockResolvedValue(ok({ ...FILM }));
  m.video.getAdminVideoDiagnostics.mockResolvedValue(ok([]));
  m.guard.hasFreshStepUp.mockResolvedValue(true);
});

describe("createFilmAction", () => {
  it("validates, creates a draft with only the two access levels and opens the upload", async () => {
    m.video.createAdminVideo.mockResolvedValue(ok({ id: "v9", slug: "nowy-film" }));
    const fd = new FormData();
    fd.set("title", "Nowy film");
    fd.set("slug", "");
    fd.set("tier", "LOGGED_IN");
    await expect(createFilmAction(null, fd)).rejects.toThrow("REDIRECT /tresci/nowy-film/edycja?nowy=1#oryginal");
    expect(m.video.createAdminVideo).toHaveBeenCalledWith(expect.objectContaining({ title: "Nowy film", slug: "nowy-film", tier: "LOGGED_IN", status: "DRAFT" }), expect.anything());
  });

  it("refuses the old PATRON tier and an empty title", async () => {
    const fd = new FormData();
    fd.set("title", "");
    fd.set("slug", "x");
    fd.set("tier", "PATRON");
    const r = await createFilmAction(null, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors ?? {})).toEqual(expect.arrayContaining(["title", "tier"]));
    expect(m.video.createAdminVideo).not.toHaveBeenCalled();
  });

  it("shows a slug conflict on the slug field", async () => {
    m.video.createAdminVideo.mockResolvedValue({ ok: false, error: { code: "VIDEO_SLUG_CONFLICT", message: "conflict" } });
    const fd = new FormData();
    fd.set("title", "Cześć");
    fd.set("slug", "czesc");
    fd.set("tier", "PUBLIC");
    const r = await createFilmAction(null, fd);
    expect(r).toMatchObject({ ok: false, fieldErrors: { slug: "Ten adres (slug) ma już inny film." } });
  });
});

describe("saveFilmAction", () => {
  it("refuses to overwrite a newer version (optimistic lock)", async () => {
    const r = await saveFilmAction(null, form({ expectedUpdatedAt: "2026-10-04T09:00:00.000Z" }));
    expect(r).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(m.video.updateAdminVideo).not.toHaveBeenCalled();
  });

  it("saves the fundraising bar: manual percent clears the goal", async () => {
    const r = await saveFilmAction(null, form({ fundMode: "manual", fundPercent: "65" }));
    expect(r.ok).toBe(true);
    expect(m.video.updateAdminVideo).toHaveBeenCalledWith(expect.objectContaining({ fundraisingManualPercent: 65 }), expect.anything());
  });

  it("parses a goal in złoty with a comma into minor units", async () => {
    await saveFilmAction(null, form({ fundMode: "goal", fundGoal: "2 000,50", fundCurrency: "EUR", fundSince: "2026-09-01" }));
    expect(m.video.updateAdminVideo).toHaveBeenCalledWith(expect.objectContaining({ fundraisingGoalMinor: 200050, fundraisingGoalCurrency: "EUR", fundraisingManualPercent: null, fundraisingStartAt: new Date("2026-09-01T00:00:00Z") }), expect.anything());
  });

  it("rejects a percent outside 0..100", async () => {
    const r = await saveFilmAction(null, form({ fundMode: "manual", fundPercent: "120" }));
    expect(r).toMatchObject({ ok: false, fieldErrors: { fundPercent: expect.any(String) } });
  });

  it("premiere on a draft: Warsaw time to UTC and publish", async () => {
    await saveFilmAction(null, form({ when: "premiere", premiereAt: "2026-12-24T20:00" }));
    expect(m.video.updateAdminVideo).toHaveBeenCalledWith(expect.objectContaining({ premiereAt: new Date("2026-12-24T19:00:00Z"), status: "PUBLISHED" }), expect.anything());
  });

  it("publishing is refused as a whole when a structural blocker exists (nothing saved)", async () => {
    m.video.getAdminVideoDiagnostics.mockResolvedValue(ok([{ severity: "ERROR", code: "VIDEO_PUBLICATION_ARCHIVED", message: "Publikacja zablokowana: Zarchiwizowany film trzeba najpierw przywrócić do szkicu.", field: "status" }]));
    const r = await saveFilmAction(null, form({ when: "now" }));
    expect(r).toMatchObject({ ok: false, code: "NOT_READY" });
    expect(m.video.updateAdminVideo).not.toHaveBeenCalled();
  });

  it("publishing while the video still encodes: saves as draft and asks the worker to publish", async () => {
    m.video.getAdminVideoDiagnostics.mockResolvedValue(ok([{ severity: "ERROR", code: "VIDEO_PUBLICATION_ASSET_NOT_READY", message: "x", field: "activePlaybackRoute" }]));
    const r = await saveFilmAction(null, form({ when: "now", showInSidebar: "on" }));
    expect(r).toMatchObject({ ok: true, message: expect.stringContaining("opublikuje się sam") });
    const call = m.video.updateAdminVideo.mock.calls[0][0];
    expect(call.status).toBeUndefined();
    expect(call.showInSidebar).toBeUndefined();
    expect(m.video.requestPublishAfterAssetReady).toHaveBeenCalledWith("v1", expect.anything());
  });

  it("a published film keeps its stored premiere without a 'must be in the future' error", async () => {
    const past = new Date("2026-10-01T18:00:00Z");
    m.video.getAdminVideoById.mockResolvedValue(ok({ ...FILM, status: "PUBLISHED", premiereAt: past.toISOString() }));
    await saveFilmAction(null, form({ when: "premiere", premiereAt: "2026-10-01T20:00", showInSidebar: "on" }));
    const call = m.video.updateAdminVideo.mock.calls[0][0];
    expect("premiereAt" in call).toBe(false);
    expect(call.showInSidebar).toBe(true);
    expect(call.isMainFeatured).toBe(false);
  });
});

describe("deleteFilmAction", () => {
  it("requires the exact slug", async () => {
    const r = await deleteFilmAction({ id: "v1", typedSlug: "czesc-x", returnTo: "/" });
    expect(r).toMatchObject({ ok: false, code: "TYPED_MISMATCH" });
    expect(m.content.deleteVideoWithStorage).not.toHaveBeenCalled();
  });

  it("requires a fresh step-up", async () => {
    m.guard.hasFreshStepUp.mockResolvedValue(false);
    const r = await deleteFilmAction({ id: "v1", typedSlug: "czesc", returnTo: "/" });
    expect(r).toMatchObject({ ok: false, code: "STEP_UP_REQUIRED" });
    expect(m.content.deleteVideoWithStorage).not.toHaveBeenCalled();
  });

  it("deletes with storage clean-up and returns to the list", async () => {
    m.content.deleteVideoWithStorage.mockResolvedValue(ok({ id: "v1" }));
    await expect(deleteFilmAction({ id: "v1", typedSlug: " czesc ", returnTo: "/" })).rejects.toThrow("REDIRECT /tresci?usunieto=1");
    expect(m.content.deleteVideoWithStorage).toHaveBeenCalledWith("v1", expect.objectContaining({ actor: { type: "admin", userId: "adm1" }, requestId: "ray1" }));
  });
});

describe("filmStatusAction", () => {
  it("unpublishing also takes the film off the list and the Hero", async () => {
    const r = await filmStatusAction({ id: "v1", op: "unpublish" });
    expect(r.ok).toBe(true);
    expect(m.video.updateAdminVideo).toHaveBeenCalledWith({ id: "v1", status: "DRAFT", isMainFeatured: false, showInSidebar: false }, expect.anything());
  });

  it("refuses everything when the panel runs on sample data", async () => {
    process.env.ADMIN_DEV_FIXTURES = "1";
    const r = await filmStatusAction({ id: "v1", op: "publish" });
    expect(r).toMatchObject({ ok: false, code: "SAMPLE_DATA" });
    expect(m.video.publishAdminVideo).not.toHaveBeenCalled();
  });
});
