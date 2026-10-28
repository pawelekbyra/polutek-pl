import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { createScopedLogger } from "@/lib/logger";
import { CAPTION_DEFAULT_BUCKET, captionFileName, captionObjectKey, isCaptionKeyOf } from "../domain/protected-caption";

const logger = createScopedLogger("R2CaptionStorageClient");

function isNotFound(err: unknown) {
  const candidate = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate?.name === "NoSuchKey" || candidate?.name === "NotFound" || candidate?.$metadata?.httpStatusCode === 404;
}

/**
 * WebVTT files in the PRIVATE HLS bucket (`CLOUDFLARE_R2_BUCKET_HLS`, default `polutek-hls`), under
 * `videos/<id>/captions/`. Reuses the R2 credentials of the other clients; the token needs Object Read & Write
 * on this bucket (the panel already deletes HLS versions there). Nothing here is publicly reachable: the
 * Worker serves the files behind the video's token (see `domain/protected-caption.ts`).
 */
export class R2CaptionStorageClient {
  private client: S3Client | null = null;

  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.CLOUDFLARE_R2_ACCOUNT_ID && env.CLOUDFLARE_R2_ACCESS_KEY_ID && env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  }

  static bucket(env: NodeJS.ProcessEnv = process.env): string {
    return env.CLOUDFLARE_R2_BUCKET_HLS?.trim() || CAPTION_DEFAULT_BUCKET;
  }

  static hashContent(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }

  private s3(): S3Client {
    if (!this.client) {
      const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
      const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
      const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
      if (!accountId || !accessKeyId || !secretAccessKey) throw new Error("R2 captions not configured: CLOUDFLARE_R2_* is missing.");
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
    return this.client;
  }

  /** Stores the file under its content-hashed name (the same bytes always land on the same key). */
  async putCaption(input: { videoId: string; lang: string; bytes: Uint8Array }): Promise<{ file: string; key: string }> {
    const file = captionFileName(input.lang, R2CaptionStorageClient.hashContent(input.bytes));
    const key = captionObjectKey(input.videoId, file);
    await this.s3().send(new PutObjectCommand({
      Bucket: R2CaptionStorageClient.bucket(),
      Key: key,
      Body: input.bytes,
      ContentType: "text/vtt; charset=utf-8",
      CacheControl: "private, max-age=0",
    }));
    logger.info("Stored private caption", { key });
    return { file, key };
  }

  /** Size of the stored object, or null when it does not exist. */
  async headCaption(key: string): Promise<{ sizeBytes: number } | null> {
    try {
      const r = await this.s3().send(new HeadObjectCommand({ Bucket: R2CaptionStorageClient.bucket(), Key: key }));
      return { sizeBytes: r.ContentLength ?? 0 };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async getCaption(key: string): Promise<Uint8Array | null> {
    try {
      const r = await this.s3().send(new GetObjectCommand({ Bucket: R2CaptionStorageClient.bucket(), Key: key }));
      return r.Body ? await r.Body.transformToByteArray() : null;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /** Deletes one caption object; refuses any key outside `videos/<videoId>/captions/`. Missing objects are not an error. */
  async deleteCaption(videoId: string, key: string): Promise<void> {
    if (!isCaptionKeyOf(videoId, key)) throw new Error(`Refusing to delete a non-caption key: ${key}`);
    await this.s3().send(new DeleteObjectCommand({ Bucket: R2CaptionStorageClient.bucket(), Key: key }));
    logger.info("Deleted private caption", { key });
  }
}
