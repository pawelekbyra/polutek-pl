import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { makeR2Client, readR2Credentials } from "./r2-storage";

export interface UploadedPart {
  partNumber: number;
  size: number;
  etag: string;
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.name === "NoSuchUpload" || e?.$metadata?.httpStatusCode === 404;
}

/** Multipart upload operations on the PRIVATE originals bucket (browser PUTs parts to presigned URLs). */
export class OriginalsMultipart {
  constructor(
    private readonly client: S3Client,
    readonly bucket: string,
  ) {}

  /** Null when R2 is not configured (the route then answers 503 R2_NOT_CONFIGURED). */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): OriginalsMultipart | null {
    const credentials = readR2Credentials(env);
    const bucket = env.CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS;
    if (!credentials || !bucket) return null;
    return new OriginalsMultipart(makeR2Client(credentials), bucket);
  }

  async create(key: string, contentType: string): Promise<string> {
    const res = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
    if (!res.UploadId) throw new Error("R2 did not return an UploadId");
    return res.UploadId;
  }

  presignPart(key: string, uploadId: string, partNumber: number, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), {
      expiresIn: expiresInSeconds,
    });
  }

  /** Parts R2 already holds (for resume); empty when the upload no longer exists. */
  async listParts(key: string, uploadId: string): Promise<UploadedPart[]> {
    const parts: UploadedPart[] = [];
    let marker: string | undefined;
    try {
      do {
        const res = await this.client.send(new ListPartsCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker, MaxParts: 1000 }));
        for (const p of res.Parts ?? []) {
          if (p.PartNumber && p.ETag) parts.push({ partNumber: p.PartNumber, size: p.Size ?? 0, etag: p.ETag });
        }
        marker = res.IsTruncated ? String(res.NextPartNumberMarker) : undefined;
      } while (marker);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
    return parts;
  }

  async complete(key: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: [...parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
      }),
    );
  }

  async abort(key: string, uploadId: string): Promise<void> {
    try {
      await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  async head(key: string): Promise<{ exists: boolean; sizeBytes: number | null }> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { exists: true, sizeBytes: r.ContentLength ?? null };
    } catch (err) {
      if (isNotFound(err)) return { exists: false, sizeBytes: null };
      throw err;
    }
  }

  async readHead(key: string, bytes: number): Promise<Uint8Array> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
    if (!res.Body) return new Uint8Array();
    return res.Body.transformToByteArray();
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
