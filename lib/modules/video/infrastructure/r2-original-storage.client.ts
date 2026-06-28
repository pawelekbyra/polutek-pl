import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger("R2OriginalStorageClient");

export interface R2PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
  bucket: string;
}

export interface R2ObjectMeta {
  sizeBytes: number | null;
  contentType: string | null;
  exists: boolean;
}

function getConfig() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 not configured. Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS."
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function makeClient() {
  const { accountId, accessKeyId, secretAccessKey } = getConfig();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export class R2OriginalStorageClient {
  static isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS
    );
  }

  async createPresignedUploadUrl(input: {
    objectKey: string;
    contentType?: string;
    expiresInSeconds?: number;
  }): Promise<R2PresignedUploadResult> {
    const { bucket } = getConfig();
    const client = makeClient();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: input.expiresInSeconds ?? 3600,
    });

    logger.info("Created presigned upload URL", { objectKey: input.objectKey, bucket });

    return { uploadUrl, objectKey: input.objectKey, bucket };
  }

  async createPresignedGetUrl(input: {
    objectKey: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const { bucket } = getConfig();
    const client = makeClient();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
    });

    return getSignedUrl(client, command, {
      expiresIn: input.expiresInSeconds ?? 900,
    });
  }

  async getObjectMeta(objectKey: string): Promise<R2ObjectMeta> {
    const { bucket } = getConfig();
    const client = makeClient();

    try {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
      );
      return {
        exists: true,
        sizeBytes: result.ContentLength ?? null,
        contentType: result.ContentType ?? null,
      };
    } catch (err: any) {
      // AWS SDK v3 throws 'NoSuchKey' for HeadObject on missing objects
      if (err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
        return { exists: false, sizeBytes: null, contentType: null };
      }
      throw err;
    }
  }
}
