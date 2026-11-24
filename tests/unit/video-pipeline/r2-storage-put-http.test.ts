import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { HlsWriter } from "@/lib/modules/video-pipeline/infrastructure/r2-storage";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | "timeout"> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

describe("HlsWriter.putFile over the AWS SDK HTTP protocol", () => {
  it("aborts an in-flight PUT and the receiver observes the interrupted request", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "hls-put-abort-http-"));
    const file = path.join(dir, "segment.m4s");
    await writeFile(file, "");
    await truncate(file, 512 * 1024 * 1024);
    const controller = new AbortController();
    let requestStartedResolve!: () => void;
    let requestFinishedResolve!: (state: "aborted" | "completed" | "completed-after-abort" | "continued-after-abort") => void;
    const requestStarted = new Promise<void>((resolve) => { requestStartedResolve = resolve; });
    const requestFinished = new Promise<"aborted" | "completed" | "completed-after-abort" | "continued-after-abort">((resolve) => {
      requestFinishedResolve = resolve;
    });
    const server = createServer((request) => {
      let paused = false;
      let bytesAfterAbort = 0;
      request.on("data", (chunk: Buffer) => {
        if (!paused) {
          paused = true;
          request.pause();
          requestStartedResolve();
          return;
        }
        if (controller.signal.aborted) {
          bytesAfterAbort += chunk.length;
          if (bytesAfterAbort >= 1024 * 1024) {
            requestFinishedResolve("continued-after-abort");
            request.destroy();
          }
        }
      });
      request.once("aborted", () => requestFinishedResolve("aborted"));
      request.once("end", () => requestFinishedResolve(controller.signal.aborted ? "completed-after-abort" : "completed"));
      controller.signal.addEventListener("abort", () => request.resume(), { once: true });
      request.on("error", () => undefined);
    });
    let client: S3Client | undefined;

    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const { port } = server.address() as AddressInfo;
      const activeClient = new S3Client({
        region: "auto",
        endpoint: `http://127.0.0.1:${port}`,
        forcePathStyle: true,
        credentials: { accessKeyId: "loopback-only", secretAccessKey: "loopback-only" },
        maxAttempts: 1,
      });
      client = activeClient;

      const put = new HlsWriter(activeClient, "hls").putFile("videos/video-1/v/v1/segment.m4s", file, "video/iso.segment", controller.signal);
      await requestStarted;
      controller.abort();

      const putResult = await withTimeout(put.then(() => "resolved", (error: unknown) =>
        error instanceof Error ? error.name : "rejected"), 3_000);
      expect(putResult).toBe("AbortError");
      const requestResult = await withTimeout(requestFinished, 3_000);
      expect(requestResult).toBe("aborted");
    } finally {
      controller.abort();
      client?.destroy();
      server.closeAllConnections();
      server.close();
      await once(server, "close");
      await rm(dir, { recursive: true, force: true });
    }
  }, 10_000);
});
