import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageProvider } from "@prisma/client";

export class StorageService {
  private static getS3Client(provider: StorageProvider) {
    if (provider === 'R2') {
      return new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      });
    }

    // Default S3
    return new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  static async getPresignedUrl(provider: StorageProvider, bucket: string, key: string, expiresInSeconds: number = 900) {
    const client = this.getS3Client(provider);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000)
    };
  }
}
