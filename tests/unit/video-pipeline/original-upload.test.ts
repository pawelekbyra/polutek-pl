import type { VideoOriginal } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueue, requestPublish, audit, auditSafe, limitError } = vi.hoisted(() => ({
  limitError: vi.fn(async (..._a: unknown[]) => null as unknown),
  enqueue: vi.fn(),
  requestPublish: vi.fn(async (..._a: unknown[]) => undefined),
  audit: vi.fn(async (..._a: unknown[]) => undefined),
  auditSafe: vi.fn(async (..._a: unknown[]) => undefined),
}));

vi.mock("@/lib/modules/channel", () => ({ MainChannelService: { getRequired: async () => ({ id: "chan" }) } }));
vi.mock("@/lib/modules/video-pipeline/application/channel-limits", () => ({ channelUploadLimitError: limitError }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: audit, recordAuditEventSafe: auditSafe }));
vi.mock("@/lib/modules/video", () => ({ requestPublishAfterAssetReady: requestPublish }));
vi.mock("@/lib/modules/video-pipeline/application/encode-queue.use-cases", () => ({ enqueueEncode: enqueue }));

import { STALE_UPLOAD_MS, abandonStaleOriginalUploads, abortOriginalUpload, completeOriginalMultipart, presignOriginalParts, sanitizeFileName, startOriginalUpload } from "@/lib/modules/video-pipeline/application/original-upload.use-cases";
import { AppError } from "@/lib/modules/shared/app-error";
import { MIB } from "@/lib/modules/video-pipeline/domain/upload-policy";

const MP4 = Uint8Array.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);

function original(over: Partial<VideoOriginal> = {}): VideoOriginal {
  return {
    id: "o1", videoId: "v1", bucket: "polutek", objectKey: "originals/v1/1.mp4", originalFileName: "a.mp4", mimeType: "video/mp4",
    sizeBytes: BigInt(20 * MIB), status: "UPLOADING", failureReason: null, version: 1, uploadId: "up1", uploadPartSize: 16 * MIB, uploadPartCount: 2,
    uploadStartedAt: new Date(), uploadCompletedAt: null, verifiedAt: null, supersededAt: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  } as VideoOriginal;
}

function setup(row: VideoOriginal | null = original(), opts: { activeJob?: boolean; stale?: VideoOriginal[] } = {}) {
  const prisma = {
    video: { findFirst: vi.fn(async () => ({ id: "v1", title: "t", status: "DRAFT", activeOriginalId: null })), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    $executeRaw: vi.fn(async () => 1),
    videoEncodeJob: { findFirst: vi.fn(async () => (opts.activeJob ? { id: "j" } : null)) },
    videoOriginal: {
      findFirst: vi.fn(async (a: { orderBy?: unknown }) => (a?.orderBy ? { version: 3 } : row)),
      findMany: vi.fn(async () => opts.stale ?? []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => original({ ...(data as Partial<VideoOriginal>), id: "new" })),
      update: vi.fn(async (_args: { where: unknown; data: Record<string, unknown> }) => ({})),
      updateMany: vi.fn(async (_args: unknown) => ({ count: 1 })),
    },
  };
  const storage = {
    bucket: "polutek",
    create: vi.fn(async () => "up-new"),
    presignPart: vi.fn(async (_k: string, _u: string, n: number) => `https://r2/part/${n}`),
    listParts: vi.fn(async () => []),
    complete: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    head: vi.fn(async () => ({ exists: true, sizeBytes: 20 * MIB })),
    readHead: vi.fn(async () => MP4),
    deleteObject: vi.fn(async () => undefined),
  };
  const ctx = { prisma, db: { read: prisma, writeTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma) }, actor: { type: "admin", userId: "adm" }, now: () => new Date(), requestId: "r" } as never;
  return { prisma, storage, ctx, deps: { storage, now: () => 1234 } };
}

beforeEach(() => {
  vi.clearAllMocks();
  enqueue.mockResolvedValue({ ok: true, data: { id: "job1" } });
  limitError.mockResolvedValue(null);
});

describe("startOriginalUpload", () => {
  const req = { videoId: "v1", fileName: "../../Film.mp4", fileSize: 20 * MIB, contentType: "video/mp4" };

  it("creates the multipart upload and an UPLOADING original with a safe name and part plan", async () => {
    const t = setup(null);
    const res = await startOriginalUpload(req, t.ctx, t.deps);
    expect(res).toMatchObject({ ok: true, data: { originalId: "new", version: 4, partSize: 16 * MIB, partCount: 2 } });
    expect(t.storage.create).toHaveBeenCalledWith("originals/v1/1234.mp4", "video/mp4");
    expect(t.prisma.videoOriginal.create.mock.calls[0][0].data).toMatchObject({ status: "UPLOADING", uploadId: "up-new", originalFileName: "Film.mp4", bucket: "polutek" });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_ORIGINAL_UPLOAD_PROVISIONED" }));
  });

  it("rejects bad types/sizes before touching R2", async () => {
    const t = setup(null);
    expect(await startOriginalUpload({ ...req, fileName: "x.exe" }, t.ctx, t.deps)).toMatchObject({ ok: false, error: { code: "UPLOAD_BAD_TYPE" } });
    expect(await startOriginalUpload({ ...req, fileSize: 999 * 1024 * MIB }, t.ctx, t.deps)).toMatchObject({ ok: false, error: { code: "UPLOAD_TOO_LARGE" } });
    expect(t.storage.create).not.toHaveBeenCalled();
  });

  it("answers 503 when R2 is not configured and 409 while encoding runs", async () => {
    expect(await startOriginalUpload(req, setup(null).ctx, { storage: null })).toMatchObject({ ok: false, error: { code: "R2_NOT_CONFIGURED", statusCode: 503 } });
    const busy = setup(null, { activeJob: true });
    expect(await startOriginalUpload(req, busy.ctx, busy.deps)).toMatchObject({ ok: false, error: { code: "ENCODE_ALREADY_ACTIVE" } });
    expect(busy.storage.create).not.toHaveBeenCalled();
  });

  it("abandons an unfinished earlier upload and aborts its multipart upload", async () => {
    const t = setup(null, { stale: [original({ id: "old", uploadId: "up-old" })] });
    await startOriginalUpload(req, t.ctx, t.deps);
    expect(t.storage.abort).toHaveBeenCalledWith("originals/v1/1.mp4", "up-old");
    expect(t.prisma.videoOriginal.update).toHaveBeenCalledWith({ where: { id: "old" }, data: expect.objectContaining({ status: "ABANDONED" }) });
  });

  it("takes the channel lock and re-checks the limits inside the transaction; a refusal aborts the R2 upload", async () => {
    const t = setup(null);
    await startOriginalUpload(req, t.ctx, t.deps);
    expect(t.prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(limitError).toHaveBeenCalledTimes(2); // early refusal + authoritative check under the lock

    const full = setup(null);
    limitError.mockResolvedValueOnce(null).mockResolvedValueOnce(new AppError("limit", 429, "UPLOAD_DAILY_LIMIT"));
    const res = await startOriginalUpload(req, full.ctx, full.deps);
    expect(res).toMatchObject({ ok: false, error: { code: "UPLOAD_DAILY_LIMIT", statusCode: 429 } });
    expect(full.prisma.videoOriginal.create).not.toHaveBeenCalled();
    expect(full.storage.abort).toHaveBeenCalledWith("originals/v1/1234.mp4", "up-new");
  });

  it("aborts the R2 upload when the DB write fails (no orphan)", async () => {
    const t = setup(null);
    t.prisma.videoOriginal.create.mockRejectedValueOnce(new Error("db"));
    await expect(startOriginalUpload(req, t.ctx, t.deps)).rejects.toThrow("db");
    expect(t.storage.abort).toHaveBeenCalledWith("originals/v1/1234.mp4", "up-new");
  });
});

describe("presignOriginalParts", () => {
  it("signs only valid part numbers of an open upload", async () => {
    const t = setup();
    const ok = await presignOriginalParts({ videoId: "v1", originalId: "o1", partNumbers: [1, 2, 2] }, t.ctx, t.deps);
    expect(ok).toMatchObject({ ok: true, data: { urls: [{ partNumber: 1, url: "https://r2/part/1" }, { partNumber: 2, url: "https://r2/part/2" }] } });
    expect(await presignOriginalParts({ videoId: "v1", originalId: "o1", partNumbers: [3] }, t.ctx, t.deps)).toMatchObject({ ok: false, error: { code: "UPLOAD_BAD_PARTS" } });
    const closed = setup(original({ status: "READY" }));
    expect(await presignOriginalParts({ videoId: "v1", originalId: "o1", partNumbers: [1] }, closed.ctx, closed.deps)).toMatchObject({ ok: false, error: { code: "UPLOAD_NOT_OPEN" } });
  });
});

describe("completeOriginalMultipart", () => {
  const parts = [{ partNumber: 1, etag: '"a"' }, { partNumber: 2, etag: '"b"' }];

  it("verifies the stored file, marks it READY, supersedes older ones and queues encoding", async () => {
    const t = setup();
    const res = await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts, publishAfterReady: true }, t.ctx, t.deps);
    expect(res).toMatchObject({ ok: true, data: { originalId: "o1", job: { id: "job1" } } });
    expect(t.storage.complete).toHaveBeenCalledWith("originals/v1/1.mp4", "up1", [{ partNumber: 1, etag: '"a"' }, { partNumber: 2, etag: '"b"' }]);
    expect(t.prisma.videoOriginal.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUPERSEDED" }) }));
    expect(t.prisma.videoOriginal.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "UPLOADING" },
      data: expect.objectContaining({ status: "READY", uploadId: null, mimeType: "video/mp4" }),
    });
    expect(t.prisma.video.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { activeOriginalId: "o1" } });
    expect(requestPublish).toHaveBeenCalledWith("v1", expect.anything());
    expect(enqueue).toHaveBeenCalledWith({ videoId: "v1", originalId: "o1" }, expect.anything());
  });

  it("does not revive a row that a concurrent abort or newer start closed (compare-and-set)", async () => {
    const t = setup();
    t.prisma.videoOriginal.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts }, t.ctx, t.deps);
    expect(res).toMatchObject({ ok: false, error: { code: "UPLOAD_NOT_OPEN", statusCode: 409 } });
    expect(t.prisma.video.update).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("deletes a file whose content is not a video and never queues it", async () => {
    const t = setup();
    t.storage.readHead.mockResolvedValue(Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]));
    const res = await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts }, t.ctx, t.deps);
    expect(res).toMatchObject({ ok: false, error: { code: "UPLOAD_BAD_CONTENT", statusCode: 422 } });
    expect(t.storage.deleteObject).toHaveBeenCalledWith("originals/v1/1.mp4");
    expect(t.prisma.videoOriginal.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
    expect(enqueue).not.toHaveBeenCalled();
    expect(auditSafe).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_ORIGINAL_UPLOAD_REJECTED" }));
  });

  it("rejects a size that differs from the declared one or exceeds the cap", async () => {
    const t = setup();
    t.storage.head.mockResolvedValue({ exists: true, sizeBytes: 21 * MIB });
    expect(await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts }, t.ctx, t.deps)).toMatchObject({ ok: false, error: { code: "UPLOAD_SIZE_MISMATCH" } });
    const big = setup();
    big.storage.head.mockResolvedValue({ exists: true, sizeBytes: 20 * MIB });
    expect(await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts }, big.ctx, { ...big.deps, maxBytes: 10 * MIB })).toMatchObject({ ok: false, error: { code: "UPLOAD_TOO_LARGE" } });
  });

  it("rejects an incomplete or duplicated part list without calling R2", async () => {
    const t = setup();
    for (const bad of [[parts[0]], [parts[0], parts[0]], [{ partNumber: 1, etag: "a" }, { partNumber: 3, etag: "b" }], [parts[0], { partNumber: 2, etag: " " }]]) {
      expect(await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts: bad }, t.ctx, t.deps)).toMatchObject({ ok: false, error: { code: "UPLOAD_BAD_PARTS" } });
    }
    expect(t.storage.complete).not.toHaveBeenCalled();
  });

  it("is idempotent: a retried complete on a READY original only re-queues", async () => {
    const t = setup(original({ status: "READY", uploadId: null }));
    const res = await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts }, t.ctx, t.deps);
    expect(res.ok).toBe(true);
    expect(t.storage.complete).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(t.prisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { activeOriginalId: "o1" } }));
  });

  it("continues verification when R2 says the upload was already completed", async () => {
    const t = setup();
    t.storage.complete.mockRejectedValue(Object.assign(new Error("gone"), { name: "NoSuchUpload" }));
    expect((await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts }, t.ctx, t.deps)).ok).toBe(true);
  });

  it("maps R2 part errors to a resumable 409", async () => {
    const t = setup();
    t.storage.complete.mockRejectedValue(Object.assign(new Error("x"), { name: "InvalidPart" }));
    expect(await completeOriginalMultipart({ videoId: "v1", originalId: "o1", parts }, t.ctx, t.deps)).toMatchObject({ ok: false, error: { code: "UPLOAD_PARTS_INCOMPLETE", statusCode: 409 } });
  });
});

describe("abortOriginalUpload / sanitizeFileName", () => {
  it("aborts R2 and abandons the row", async () => {
    const t = setup();
    expect((await abortOriginalUpload({ videoId: "v1", originalId: "o1" }, t.ctx, t.deps)).ok).toBe(true);
    expect(t.storage.abort).toHaveBeenCalledWith("originals/v1/1.mp4", "up1");
    expect(t.prisma.videoOriginal.update.mock.calls[0][0].data).toMatchObject({ status: "ABANDONED" });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_ORIGINAL_UPLOAD_ABORTED" }));
  });
  it("keeps only a harmless display name", () => {
    expect(sanitizeFileName("C:\\x\\y\\a.mp4")).toBe("a.mp4");
    expect(sanitizeFileName("a\u0000b\n.mp4")).toBe("ab.mp4");
    expect(sanitizeFileName("x".repeat(500))?.length).toBe(200);
    expect(sanitizeFileName(undefined)).toBeNull();
  });
});

describe("abandonStaleOriginalUploads", () => {
  const stale = [
    original({ id: "s1", uploadId: "up-a", objectKey: "originals/v1/a.mp4" }),
    original({ id: "s2", uploadId: "up-b", objectKey: "originals/v1/b.mp4" }),
  ];

  it("aborts the multipart upload and closes uploads older than 7 days", async () => {
    const t = setup(null, { stale });
    t.prisma.videoOriginal.updateMany.mockResolvedValue({ count: 1 });
    // The second upload was already expired by R2's own 7-day rule: that is not a failure.
    t.storage.abort.mockResolvedValueOnce(undefined).mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "NoSuchUpload" }));
    const now = Date.UTC(2026, 9, 10);
    const res = await abandonStaleOriginalUploads({}, t.ctx, { storage: t.storage, now: () => now });
    expect(res).toEqual({ ok: true, data: { found: 2, abandoned: 2, abortFailures: 0 } });
    expect(t.storage.abort).toHaveBeenCalledWith("originals/v1/a.mp4", "up-a");
    const where = (t.prisma.videoOriginal.findMany.mock.calls[0] as unknown as [{ where: { status: string; OR: Array<Record<string, { lt: Date }>> } }])[0].where;
    expect(where.status).toBe("UPLOADING");
    expect(where.OR[0].uploadStartedAt.lt.getTime()).toBe(now - STALE_UPLOAD_MS);
    expect(t.prisma.videoOriginal.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", status: "UPLOADING" },
      data: expect.objectContaining({ status: "ABANDONED", uploadId: null }),
    });
    expect(auditSafe).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_ORIGINAL_UPLOADS_ABANDONED" }));
  });

  it("only counts in dry-run mode and touches nothing", async () => {
    const t = setup(null, { stale });
    const res = await abandonStaleOriginalUploads({ dryRun: true }, t.ctx, t.deps);
    expect(res).toEqual({ ok: true, data: { found: 2, abandoned: 0, abortFailures: 0 } });
    expect(t.storage.abort).not.toHaveBeenCalled();
    expect(t.prisma.videoOriginal.updateMany).not.toHaveBeenCalled();
  });
});
