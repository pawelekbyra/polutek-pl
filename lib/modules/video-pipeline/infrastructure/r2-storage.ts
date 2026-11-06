import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DEFAULT_HLS_BUCKET } from "../domain/keys";
import { verifyHlsOutput, type HlsOutputVerification } from "../domain/verify-hls-output";

export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Reads the shared R2 credentials (same variables as the originals/thumbnail clients). */
export function readR2Credentials(env: NodeJS.ProcessEnv = process.env): R2Credentials | null {
  const accountId = env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey };
}

export function makeR2Client(credentials: R2Credentials): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey },
    maxAttempts: 5,
  });
}

export function hlsBucketName(env: NodeJS.ProcessEnv = process.env): string {
  return env.CLOUDFLARE_R2_BUCKET_HLS || DEFAULT_HLS_BUCKET;
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}

const DELETE_OBJECT_MAX_ATTEMPTS = 3;
const TRANSIENT_DELETE_CODES = new Set([
  "InternalError",
  "OperationAborted",
  "RequestTimeout",
  "ServiceUnavailable",
  "SlowDown",
  "Throttling",
  "ThrottlingException",
]);

export class R2DeleteObjectsError extends Error {
  constructor(readonly failedCount: number, readonly errorCodes: string[], readonly removedCount: number) {
    super(`R2 DeleteObjects failed for ${failedCount} object(s) after confirming ${removedCount} removal(s): ${errorCodes.join(", ") || "unknown error"}`);
    this.name = "R2DeleteObjectsError";
  }
}

async function deleteKeysWithRetry(client: S3Client, bucket: string, keys: string[]) {
  let pending = keys;
  let removed = 0;
  const failures: string[] = [];

  for (let attempt = 1; pending.length > 0 && attempt <= DELETE_OBJECT_MAX_ATTEMPTS; attempt += 1) {
    const requested = new Set(pending);
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: pending.map((Key) => ({ Key })), Quiet: false },
    }));
    const deleted = new Set<string>();
    for (const item of result.Deleted ?? []) {
      if (!item.Key || !requested.has(item.Key) || deleted.has(item.Key)) {
        throw new Error("R2 DeleteObjects returned an invalid Deleted entry");
      }
      deleted.add(item.Key);
    }

    const errors = new Map<string, string>();
    for (const item of result.Errors ?? []) {
      const code = item.Code || "Unknown";
      if (!item.Key || !requested.has(item.Key) || errors.has(item.Key) || deleted.has(item.Key)) {
        throw new Error("R2 DeleteObjects returned an invalid Errors entry");
      }
      errors.set(item.Key, code);
    }

    const retry: string[] = [];
    for (const key of pending) {
      if (deleted.has(key)) {
        removed += 1;
        continue;
      }
      const code = errors.get(key);
      if (!code) throw new Error("R2 DeleteObjects returned no result for a requested object");
      if (code === "NoSuchKey" || code === "NotFound") continue; // already absent is idempotent, but not counted as removed
      if (TRANSIENT_DELETE_CODES.has(code) && attempt < DELETE_OBJECT_MAX_ATTEMPTS) retry.push(key);
      else failures.push(code);
    }

    pending = retry;
    if (pending.length > 0) await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** (attempt - 1)));
  }

  return { removed, failures };
}

/** Streams objects of the PRIVATE originals bucket to local disk. */
export class OriginalsReader {
  constructor(private readonly client: S3Client) {}

  async head(bucket: string, key: string): Promise<{ exists: boolean; sizeBytes: number | null }> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { exists: true, sizeBytes: r.ContentLength ?? null };
    } catch (err) {
      if (isNotFound(err)) return { exists: false, sizeBytes: null };
      throw err;
    }
  }

  /** Downloads to `destPath`; `onBytes(done, total)` is throttled by the caller. */
  async download(
    bucket: string,
    key: string,
    destPath: string,
    opts: { signal?: AbortSignal; onBytes?: (done: number, total: number) => void } = {},
  ): Promise<number> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: opts.signal });
    if (!res.Body) throw new Error("R2 returned an empty body");
    const total = res.ContentLength ?? 0;
    let done = 0;
    const body = res.Body as Readable;
    body.on("data", (chunk: Buffer) => {
      done += chunk.length;
      opts.onBytes?.(done, total);
    });
    await pipeline(body, createWriteStream(destPath), opts.signal ? { signal: opts.signal } : undefined);
    return done;
  }
}

/** Writes/deletes objects of the private HLS bucket `polutek-hls`. */
export class HlsWriter {
  constructor(
    private readonly client: S3Client,
    readonly bucket: string,
  ) {}

  async putFile(key: string, filePath: string, contentType: string, signal?: AbortSignal, cacheControl?: string): Promise<number> {
    const { size } = await stat(filePath);
    const body = createReadStream(filePath);
    try {
      await this.client.send(
        new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentLength: size,
        ContentType: contentType,
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
        }),
        signal ? { abortSignal: signal } : undefined,
      );
    } finally {
      body.destroy();
    }
    return size;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  async countPrefix(prefix: string): Promise<number> {
    let count = 0;
    let token: string | undefined;
    do {
      const r = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      count += r.KeyCount ?? 0;
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    return count;
  }

  async verifyOutput(assetKey: string): Promise<HlsOutputVerification> {
    const prefix = `${assetKey}/`;
    const objectKeys: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      for (const object of page.Contents ?? []) if (object.Key) objectKeys.push(object.Key);
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return verifyHlsOutput(prefix, objectKeys, async (key) => {
      try {
        const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        if (!result.Body) return null;
        return result.Body.transformToString();
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    });
  }

  /** Deletes every object under `prefix` (must end with "/"). Returns how many were removed. */
  async deletePrefix(prefix: string): Promise<number> {
    if (!prefix.endsWith("/") || prefix.split("/").filter(Boolean).length < 4) {
      throw new Error(`Refusing to delete a too-broad prefix: ${prefix}`);
    }
    let removed = 0;
    const failures: string[] = [];
    let token: string | undefined;
    do {
      const list = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
      if (keys.length > 0) {
        const result = await deleteKeysWithRetry(this.client, this.bucket, keys);
        removed += result.removed;
        failures.push(...result.failures);
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    if (failures.length > 0) throw new R2DeleteObjectsError(failures.length, [...new Set(failures)], removed);
    return removed;
  }
}
