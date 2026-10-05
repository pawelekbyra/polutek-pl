import { beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({ recordAuditEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/modules/audit", () => audit);
const media = vi.hoisted(() => ({ invalidateDefaultThumbnailCache: vi.fn(), MediaStorageService: { deleteOwnedThumbnail: vi.fn(async () => true) }, R2ThumbnailStorageClient: class { static isConfigured = () => false; } }));
vi.mock("@/lib/modules/media", () => media);

import { getDefaultThumbnailState, removeDefaultThumbnail, setDefaultThumbnail } from "@/lib/modules/admin-content";
import type { AppContext } from "@/lib/modules/shared/app-context";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function makeCtx(over: { existing?: string | null; creatorUrls?: number; actor?: AppContext["actor"] } = {}) {
  const appSetting = {
    findUnique: vi.fn(async () => (over.existing ? { key: "default_video_thumbnail", value: over.existing, updatedAt: new Date("2026-10-01T10:00:00Z"), updatedBy: "adm1" } : null)),
    upsert: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const creator = { updateMany: vi.fn(async () => ({ count: over.creatorUrls ?? 0 })), findFirst: vi.fn(async () => (over.creatorUrls ? { defaultThumbnailUrl: "https://old.example/x.png" } : null)) };
  const prisma = { appSetting, creator };
  const ctx = { actor: over.actor ?? { type: "admin", userId: "adm1" }, prisma, db: { read: prisma, writeTransaction: async (fn: (tx: unknown) => unknown) => fn(prisma) } } as unknown as AppContext;
  return { ctx, appSetting, creator };
}
const storage = () => ({ putPrivate: vi.fn(async () => ({ key: "settings/default-video-thumbnail/hash.jpg", storageUrl: "https://acc.r2.cloudflarestorage.com/priv/settings/default-video-thumbnail/hash.jpg" })) });

beforeEach(() => vi.clearAllMocks());

describe("setDefaultThumbnail", () => {
  it("stores the file, saves the setting with before/after in the audit, then deletes the old file", async () => {
    const { ctx, appSetting } = makeCtx({ existing: "https://acc.r2.cloudflarestorage.com/priv/settings/default-video-thumbnail/old.png", creatorUrls: 1 });
    const del = vi.fn(async () => true);
    const s = storage();
    const r = await setDefaultThumbnail({ bytes: JPEG }, ctx, s as never, del);
    expect(r).toMatchObject({ ok: true, data: { replaced: true } });
    expect(s.putPrivate).toHaveBeenCalledWith(expect.objectContaining({ scope: "settings/default-video-thumbnail", contentType: "image/jpeg" }));
    expect(appSetting.upsert).toHaveBeenCalled();
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "DEFAULT_THUMBNAIL_UPDATED", metadata: expect.objectContaining({ before: expect.stringContaining("old.png"), clearedCreatorUrls: 1, via: "admin_panel" }) }), expect.anything());
    expect(del).toHaveBeenCalledWith(expect.stringContaining("old.png"));
    expect(media.invalidateDefaultThumbnailCache).toHaveBeenCalled();
    // The new file is written first: order of the calls proves "no gap".
    expect(s.putPrivate.mock.invocationCallOrder[0]).toBeLessThan(del.mock.invocationCallOrder[0]);
  });

  it("does not delete the file when the same picture is uploaded again (content-hashed key)", async () => {
    const same = "https://acc.r2.cloudflarestorage.com/priv/settings/default-video-thumbnail/hash.jpg";
    const { ctx } = makeCtx({ existing: same });
    const del = vi.fn();
    await setDefaultThumbnail({ bytes: JPEG }, ctx, storage() as never, del);
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses a non-image, an oversized file, an empty file and a non-admin before touching storage", async () => {
    const { ctx } = makeCtx();
    const s = storage();
    for (const bytes of [new TextEncoder().encode("<svg/>"), new Uint8Array(0)]) {
      const r = await setDefaultThumbnail({ bytes }, ctx, s as never);
      expect(r.ok).toBe(false);
    }
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(JPEG);
    expect(await setDefaultThumbnail({ bytes: big }, ctx, s as never)).toMatchObject({ ok: false, error: { code: "COVER_TOO_LARGE" } });
    const other = makeCtx({ actor: { type: "user", userId: "u" } });
    expect(await setDefaultThumbnail({ bytes: JPEG }, other.ctx, s as never)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(s.putPrivate).not.toHaveBeenCalled();
  });

  it("answers R2_NOT_CONFIGURED without storage", async () => {
    const { ctx } = makeCtx();
    expect(await setDefaultThumbnail({ bytes: JPEG }, ctx, null)).toMatchObject({ ok: false, error: { code: "R2_NOT_CONFIGURED" } });
  });
});

describe("removeDefaultThumbnail and state", () => {
  it("deletes the row, audits before/after and removes the file", async () => {
    const { ctx, appSetting } = makeCtx({ existing: "https://x/priv/a.jpg" });
    const del = vi.fn(async () => true);
    expect(await removeDefaultThumbnail(ctx, del)).toMatchObject({ ok: true, data: { deleted: true } });
    expect(appSetting.delete).toHaveBeenCalled();
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "DEFAULT_THUMBNAIL_DELETED", metadata: expect.objectContaining({ before: "https://x/priv/a.jpg", after: null }) }), expect.anything());
    expect(del).toHaveBeenCalledWith("https://x/priv/a.jpg");
  });

  it("with nothing uploaded still clears a legacy creator URL, and reports nothing deleted when there is none", async () => {
    const withUrl = makeCtx({ creatorUrls: 1 });
    expect(await removeDefaultThumbnail(withUrl.ctx, vi.fn())).toMatchObject({ ok: true, data: { deleted: true } });
    const none = makeCtx();
    expect(await removeDefaultThumbnail(none.ctx, vi.fn())).toMatchObject({ ok: true, data: { deleted: false } });
  });

  it("state reports a legacy creator URL that shadows the upload", async () => {
    const { ctx } = makeCtx({ existing: "https://x/priv/a.jpg", creatorUrls: 1 });
    expect(await getDefaultThumbnailState(ctx)).toMatchObject({ storageUrl: "https://x/priv/a.jpg", creatorOverrideUrl: "https://old.example/x.png" });
  });
});
