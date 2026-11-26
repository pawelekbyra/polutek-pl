import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { createScopedLogger } from "@/lib/logger";
import {
  R2_PUBLIC_THUMBNAIL_CACHE_CONTROL,
  buildPrivateThumbnailStorageUrl,
  buildPublicThumbnailUrl,
  buildThumbnailObjectKey,
  getR2ThumbnailConfig,
} from "../domain/r2-thumbnail";

const logger = createScopedLogger("R2ThumbnailStorageClient");

/** S3 DeleteObjects accepts at most 1000 keys per request. */
export const DELETE_OBJECTS_BATCH_SIZE = 1000;

export interface DeleteManyResult {
  /** Keys the store confirmed as removed (an already-absent key counts as removed: the goal is "gone"). */
  deleted: number;
  /** Keys that could not be removed, with the store's error code. */
  failed: Array<{ key: string; code: string }>;
}

export interface R2ThumbnailObject {
  body: ReadableStream<Uint8Array>;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`R2 thumbnails not configured: ${name} is missing.`);
  return value;
}

function makeClient() {
  const accountId = requireEnv("CLOUDFLARE_R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

function isNotFound(err: unknown) {
  const candidate = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate?.name === "NoSuchKey" || candidate?.name === "NotFound" || candidate?.$metadata?.httpStatusCode === 404;
}

/**
 * S3-API client for the thumbnail buckets (see `domain/r2-thumbnail.ts` for
 * the private/public split). Reuses the R2 credentials of the video-originals
 * client; the token must have Object Read & Write on both thumbnail buckets.
 */
export class R2ThumbnailStorageClient {
  /** Uploads go to R2 once the private bucket is configured. */
  static isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE
    );
  }

  /** Published thumbnails are copied to the public bucket only when it and its host are configured. */
  static isPublicServingConfigured(): boolean {
    return Boolean(
      this.isConfigured() &&
      process.env.CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC &&
      getR2ThumbnailConfig(process.env).publicHost
    );
  }

  static hashContent(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }

  /** Stores an upload in the private bucket and returns the value for `thumbnailUrl`. */
  async putPrivate(input: { scope: string; bytes: Uint8Array; contentType: string; extension: string }): Promise<{ key: string; storageUrl: string }> {
    const accountId = requireEnv("CLOUDFLARE_R2_ACCOUNT_ID");
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE");
    const key = buildThumbnailObjectKey(input.scope, R2ThumbnailStorageClient.hashContent(input.bytes), input.extension);

    await makeClient().send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.contentType,
    }));

    logger.info("Stored private thumbnail", { key, bucket });
    return { key, storageUrl: buildPrivateThumbnailStorageUrl(accountId, bucket, key) };
  }

  async getPrivate(key: string): Promise<R2ThumbnailObject | null> {
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE");
    try {
      const result = await makeClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) return null;
      return {
        body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        contentType: result.ContentType ?? null,
        contentLength: result.ContentLength ?? null,
        etag: result.ETag ?? null,
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /** Copies a private object to the public bucket under the same key and returns its public URL. */
  async copyToPublic(key: string): Promise<string> {
    const privateBucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE");
    const publicBucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC");
    const publicHost = getR2ThumbnailConfig(process.env).publicHost;
    if (!publicHost) throw new Error("R2 thumbnails not configured: NEXT_PUBLIC_R2_PUBLIC_HOST is missing.");

    const client = makeClient();
    const source = await client.send(new GetObjectCommand({ Bucket: privateBucket, Key: key }));
    if (!source.Body) throw new Error(`Private thumbnail ${key} has no body`);
    const bytes = await source.Body.transformToByteArray();

    await client.send(new PutObjectCommand({
      Bucket: publicBucket,
      Key: key,
      Body: bytes,
      ContentType: source.ContentType,
      CacheControl: R2_PUBLIC_THUMBNAIL_CACHE_CONTROL,
    }));

    logger.info("Copied thumbnail to public bucket", { key, publicBucket });
    return buildPublicThumbnailUrl(publicHost, key);
  }

  /** Reads an object of the public bucket through the S3 API (used by the captions migration). */
  async getPublic(key: string): Promise<Uint8Array | null> {
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC");
    try {
      const result = await makeClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return result.Body ? await result.Body.transformToByteArray() : null;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async deletePublic(key: string): Promise<void> {
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC");
    await makeClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    logger.info("Deleted public thumbnail copy", { key, bucket });
  }

  /**
   * Removes many public objects with one DeleteObjects request per 1000 keys instead of one request per key
   * (the orphan sweep removes thousands). Never throws for a per-key failure: those come back in `failed`, so one
   * bad key does not stop the others. A failed whole request (network, auth) still throws.
   */
  async deletePublicMany(keys: string[]): Promise<DeleteManyResult> {
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC");
    const result: DeleteManyResult = { deleted: 0, failed: [] };
    if (keys.length === 0) return result;
    const client = makeClient();
    for (let i = 0; i < keys.length; i += DELETE_OBJECTS_BATCH_SIZE) {
      const batch = keys.slice(i, i + DELETE_OBJECTS_BATCH_SIZE);
      const response = await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
      }));
      const errors = new Map<string, string>();
      for (const item of response.Errors ?? []) if (item.Key) errors.set(item.Key, item.Code || "Unknown");
      for (const key of batch) {
        const code = errors.get(key);
        if (!code || code === "NoSuchKey" || code === "NotFound") result.deleted += 1;
        else result.failed.push({ key, code });
      }
    }
    logger.info("Deleted public thumbnail copies", { bucket, deleted: result.deleted, failed: result.failed.length });
    return result;
  }

  async deletePrivate(key: string): Promise<void> {
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE");
    await makeClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    logger.info("Deleted private thumbnail", { key, bucket });
  }

  async listPublicObjects(): Promise<Array<{ key: string; lastModified: Date | null }>> {
    const bucket = requireEnv("CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC");
    const client = makeClient();
    const objects: Array<{ key: string; lastModified: Date | null }> = [];
    let continuationToken: string | undefined;

    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
      for (const object of page.Contents ?? []) {
        if (object.Key) objects.push({ key: object.Key, lastModified: object.LastModified ?? null });
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
  }
}
