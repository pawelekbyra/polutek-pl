import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { HlsWriter } from "@/lib/modules/video-pipeline/infrastructure/r2-storage";

function clientWith(responses: unknown[]) {
  const send = vi.fn(async (..._args: unknown[]) => responses.shift());
  return { client: { send } as never, send };
}

describe("HlsWriter.deletePrefix", () => {
  const prefix = "videos/video-1/v/v1/";

  it("does not treat HTTP 200 with a permanent per-object failure as success", async () => {
    const { client, send } = clientWith([
      { Contents: [{ Key: `${prefix}one.ts` }, { Key: `${prefix}two.ts` }] },
      {
        Deleted: [{ Key: `${prefix}one.ts` }],
        Errors: [{ Key: `${prefix}two.ts`, Code: "AccessDenied", Message: "denied" }],
      },
    ]);

    const result = new HlsWriter(client, "hls").deletePrefix(prefix);
    await expect(result).rejects.toThrow(/AccessDenied/);
    await expect(result).rejects.toMatchObject({ failedCount: 1, removedCount: 1, errorCodes: ["AccessDenied"] });
    const command = send.mock.calls[1]?.[0] as DeleteObjectsCommand;
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
    expect(command.input.Delete?.Quiet).toBe(false);
  });

  it("retries only transiently failed keys and counts confirmed deletions", async () => {
    const { client, send } = clientWith([
      { Contents: [{ Key: `${prefix}one.ts` }, { Key: `${prefix}two.ts` }] },
      {
        Deleted: [{ Key: `${prefix}one.ts` }],
        Errors: [{ Key: `${prefix}two.ts`, Code: "SlowDown" }],
      },
      { Deleted: [{ Key: `${prefix}two.ts` }] },
    ]);

    await expect(new HlsWriter(client, "hls").deletePrefix(prefix)).resolves.toBe(2);
    const commands = send.mock.calls.map(([command]) => command);
    expect(commands[0]).toBeInstanceOf(ListObjectsV2Command);
    expect(commands[1]).toBeInstanceOf(DeleteObjectsCommand);
    expect(commands[2]).toBeInstanceOf(DeleteObjectsCommand);
    expect((commands[1] as DeleteObjectsCommand).input.Delete?.Objects?.map(({ Key }) => Key)).toEqual([
      `${prefix}one.ts`, `${prefix}two.ts`,
    ]);
    expect((commands[2] as DeleteObjectsCommand).input.Delete?.Objects?.map(({ Key }) => Key)).toEqual([
      `${prefix}two.ts`,
    ]);
  });

  it("treats an object that disappeared after listing as idempotent", async () => {
    const key = `${prefix}gone.ts`;
    const { client } = clientWith([
      { Contents: [{ Key: key }] },
      { Errors: [{ Key: key, Code: "NoSuchKey" }] },
    ]);

    await expect(new HlsWriter(client, "hls").deletePrefix(prefix)).resolves.toBe(0);
  });

  it("fails visibly after the bounded retries are exhausted", async () => {
    const key = `${prefix}slow.ts`;
    const { client, send } = clientWith([
      { Contents: [{ Key: key }] },
      { Errors: [{ Key: key, Code: "SlowDown" }] },
      { Errors: [{ Key: key, Code: "SlowDown" }] },
      { Errors: [{ Key: key, Code: "SlowDown" }] },
    ]);

    await expect(new HlsWriter(client, "hls").deletePrefix(prefix)).rejects.toThrow(/SlowDown/);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("counts confirmed removals across list pages", async () => {
    const first = `${prefix}one.ts`;
    const second = `${prefix}two.ts`;
    const { client, send } = clientWith([
      { Contents: [{ Key: first }], IsTruncated: true, NextContinuationToken: "page-2" },
      { Deleted: [{ Key: first }] },
      { Contents: [{ Key: second }], IsTruncated: false },
      { Deleted: [{ Key: second }] },
    ]);

    await expect(new HlsWriter(client, "hls").deletePrefix(prefix)).resolves.toBe(2);
    expect((send.mock.calls[2]?.[0] as ListObjectsV2Command).input.ContinuationToken).toBe("page-2");
  });
});

describe("HlsWriter.putFile", () => {
  it("passes the cancellation signal to the S3 request", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "hls-put-test-"));
    const file = path.join(dir, "segment.m4s");
    await writeFile(file, "segment");
    try {
      const send = vi.fn(async (..._args: unknown[]) => ({}));
      const controller = new AbortController();
      await new HlsWriter({ send } as never, "hls").putFile("key", file, "video/iso.segment", controller.signal);
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
      expect(send.mock.calls[0]?.[1]).toEqual({ abortSignal: controller.signal });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
