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

  async putFile(key: string, filePath: string, contentType: string, cacheControl?: string): Promise<number> {
    const { size } = await stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: size,
        ContentType: contentType,
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
      }),
    );
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

  /** Deletes every object under `prefix` (must end with "/"). Returns how many were removed. */
  async deletePrefix(prefix: string): Promise<number> {
    if (!prefix.endsWith("/") || prefix.split("/").filter(Boolean).length < 4) {
      throw new Error(`Refusing to delete a too-broad prefix: ${prefix}`);
    }
    let removed = 0;
    let token: string | undefined;
    do {
      const list = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
      if (keys.length > 0) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
        removed += keys.length;
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return removed;
  }
}
