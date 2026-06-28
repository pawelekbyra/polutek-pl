import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createScopedLogger } from "@/lib/logger";
import { AppError } from "@/lib/modules/shared/app-error";

const DEFAULT_PUT_TTL_SECONDS = 15 * 60;
const DEFAULT_GET_TTL_SECONDS = 60 * 60;
const MAX_SIGNED_URL_TTL_SECONDS = 12 * 60 * 60;
const R2_ENV_PREFIX = "CLOUDFLARE_R2_";

export interface R2OriginalObjectMetadata {
  contentType?: string | null;
  sizeBytes?: number | null;
  checksumSha256?: string | null;
  etag?: string | null;
}

export interface R2PresignedPutUrl {
  uploadUrl: string;
  expiresAt: Date;
  requiredHeaders: Record<string, string>;
}

export interface R2PresignedGetUrl {
  url: string;
  expiresAt: Date;
}

function r2EnvName(suffix: string): string {
  return `${R2_ENV_PREFIX}${suffix}`;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(`${name} is required for Cloudflare R2 original uploads.`, 500, "R2_CONFIGURATION_MISSING");
  return value;
}

function parseTtl(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_SIGNED_URL_TTL_SECONDS) {
    throw new AppError(`${name} must be an integer between 1 and ${MAX_SIGNED_URL_TTL_SECONDS}.`, 500, "R2_CONFIGURATION_INVALID");
  }

  return parsed;
}

function sanitizeFileName(fileName: string | null | undefined): string {
  const fallback = "video-original";
  if (!fileName) return fallback;

  const cleaned = fileName
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return cleaned || fallback;
}

function withoutQuotes(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/^\"|\"$/g, "");
}

export class R2OriginalStorageClient {
  private logger = createScopedLogger("R2OriginalStorageClient");

  private get config() {
    const accountId = requireEnv(r2EnvName("ACCOUNT_ID"));
    const accessKeyId = requireEnv(r2EnvName("ACCESS_KEY_ID"));
    const accessSecret = requireEnv(r2EnvName("SECRET_ACCESS_KEY"));
    const bucket = requireEnv(r2EnvName("BUCKET_VIDEO_ORIGINALS"));

    return {
      accountId,
      accessKeyId,
      accessSecret,
      bucket,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      putTtlSeconds: parseTtl(r2EnvName("SIGNED_PUT_TTL_SECONDS"), DEFAULT_PUT_TTL_SECONDS),
      getTtlSeconds: parseTtl(r2EnvName("SIGNED_GET_TTL_SECONDS"), DEFAULT_GET_TTL_SECONDS),
    };
  }

  private get s3() {
    const { endpoint, accessKeyId, accessSecret } = this.config;

    return new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey: accessSecret,
      },
    });
  }

  get bucket() {
    return this.config.bucket;
  }

  createObjectKey(input: { videoId: string; fileName?: string | null }) {
    const safeFileName = sanitizeFileName(input.fileName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `videos/originals/${input.videoId}/${timestamp}-${randomUUID()}-${safeFileName}`;
  }

  async createPresignedPutUrl(input: {
    objectKey: string;
    contentType?: string | null;
    expiresInSeconds?: number;
  }): Promise<R2PresignedPutUrl> {
    const { bucket, putTtlSeconds } = this.config;
    const expiresIn = input.expiresInSeconds ?? putTtlSeconds;
    const contentType = input.contentType?.trim() || "application/octet-stream";

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      ContentType: contentType,
      Metadata: {
        purpose: "video-original",
      },
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });

    return {
      uploadUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      requiredHeaders: {
        "Content-Type": contentType,
      },
    };
  }

  async createPresignedGetUrl(input: {
    objectKey: string;
    expiresInSeconds?: number;
  }): Promise<R2PresignedGetUrl> {
    const { bucket, getTtlSeconds } = this.config;
    const expiresIn = input.expiresInSeconds ?? getTtlSeconds;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async getObjectMetadata(objectKey: string): Promise<R2OriginalObjectMetadata> {
    const { bucket } = this.config;

    try {
      const response = await this.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      return {
        contentType: response.ContentType ?? null,
        sizeBytes: typeof response.ContentLength === "number" ? response.ContentLength : null,
        checksumSha256: response.ChecksumSHA256 ?? null,
        etag: withoutQuotes(response.ETag),
      };
    } catch (error: unknown) {
      if (error instanceof NotFound || (error && typeof error === "object" && (error as { name?: string }).name === "NotFound")) {
        throw new AppError("R2 original object was not found.", 404, "R2_ORIGINAL_OBJECT_NOT_FOUND");
      }

      this.logger.error("R2 HeadObject failed", { objectKey, error });
      throw new AppError("Could not verify R2 original object.", 502, "R2_ORIGINAL_VERIFY_FAILED");
    }
  }
}
