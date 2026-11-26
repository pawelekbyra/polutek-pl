import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = send;
  }
  class Cmd {
    constructor(public input: unknown) {}
  }
  class DeleteObjectsCommand extends Cmd {}
  class DeleteObjectCommand extends Cmd {}
  class PutObjectCommand extends Cmd {}
  class GetObjectCommand extends Cmd {}
  class ListObjectsV2Command extends Cmd {}
  return { S3Client, DeleteObjectsCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command };
});

import { DELETE_OBJECTS_BATCH_SIZE, R2ThumbnailStorageClient } from "@/lib/modules/media/infrastructure/r2-thumbnail-storage.client";

type SentInput = { Bucket: string; Delete: { Objects: Array<{ Key: string }>; Quiet: boolean } };
const sentBatches = () => send.mock.calls.map((c) => (c[0] as { input: SentInput }).input);

describe("R2ThumbnailStorageClient.deletePublicMany", () => {
  beforeEach(() => {
    send.mockReset();
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "k";
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "s";
    process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC = "pub";
  });

  it("does nothing for an empty list", async () => {
    expect(await new R2ThumbnailStorageClient().deletePublicMany([])).toEqual({ deleted: 0, failed: [] });
    expect(send).not.toHaveBeenCalled();
  });

  it("splits 3500 keys into 4 DeleteObjects requests of at most 1000 keys", async () => {
    send.mockResolvedValue({ Deleted: [] });
    const keys = Array.from({ length: 3500 }, (_, i) => `videos/v${i}/covers/a.webp`);

    const result = await new R2ThumbnailStorageClient().deletePublicMany(keys);

    expect(DELETE_OBJECTS_BATCH_SIZE).toBe(1000);
    expect(result).toEqual({ deleted: 3500, failed: [] });
    const batches = sentBatches();
    expect(batches.map((b) => b.Delete.Objects.length)).toEqual([1000, 1000, 1000, 500]);
    expect(batches.every((b) => b.Bucket === "pub" && b.Delete.Quiet === false)).toBe(true);
    expect(batches.flatMap((b) => b.Delete.Objects.map((o) => o.Key))).toEqual(keys);
  });

  it("reports per-key errors but still processes the other keys and batches; an already absent key counts as gone", async () => {
    const keys = Array.from({ length: 1500 }, (_, i) => `k${i}`);
    send
      .mockResolvedValueOnce({ Errors: [{ Key: "k3", Code: "AccessDenied" }, { Key: "k4", Code: "NoSuchKey" }] })
      .mockResolvedValueOnce({ Errors: [{ Key: "k1200", Code: "InternalError" }] });

    const result = await new R2ThumbnailStorageClient().deletePublicMany(keys);

    expect(result.deleted).toBe(1500 - 2);
    expect(result.failed).toEqual([{ key: "k3", code: "AccessDenied" }, { key: "k1200", code: "InternalError" }]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("propagates a failed request instead of reporting success", async () => {
    send.mockRejectedValue(new Error("network down"));
    await expect(new R2ThumbnailStorageClient().deletePublicMany(["a"])).rejects.toThrow("network down");
  });

  it("requires the public bucket to be configured", async () => {
    delete process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC;
    await expect(new R2ThumbnailStorageClient().deletePublicMany(["a"])).rejects.toThrow(/THUMBNAILS_PUBLIC/);
  });
});
