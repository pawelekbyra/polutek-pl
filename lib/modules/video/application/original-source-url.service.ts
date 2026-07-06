import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { R2OriginalStorageClient } from "../infrastructure/r2-original-storage.client";

export const PROVIDER_IMPORT_URL_TTL_SECONDS = Number(process.env.VIDEO_PROVIDER_IMPORT_URL_TTL_SECONDS ?? 6 * 60 * 60);

export function redactSignedUrl(value: string): string {
  return value.replace(
    /([?&](X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|X-Amz-Date|X-Amz-Expires)=)[^&]+/gi,
    "$1[REDACTED]",
  );
}

const IMPORTABLE_ORIGINAL_STATUSES = new Set(["READY", "UPLOADED", "VERIFYING"]);

export class OriginalSourceUrlService {
  constructor(private readonly storage = new R2OriginalStorageClient()) {}

  async createProviderImportUrl(
    input: { originalId: string; expiresInSeconds?: number },
    ctx: AppContext,
  ): Promise<{ url: string; expiresAt: Date; objectKey: string }> {
    const original = await ctx.prisma.videoOriginal.findUnique({ where: { id: input.originalId } });
    if (!original) throw new AppError("Original not found.", 404, "ORIGINAL_NOT_FOUND");
    if (!IMPORTABLE_ORIGINAL_STATUSES.has(original.status)) {
      throw new AppError("Original is not ready for provider import.", 409, "ORIGINAL_NOT_IMPORTABLE");
    }

    const expiresInSeconds = input.expiresInSeconds ?? PROVIDER_IMPORT_URL_TTL_SECONDS;
    const url = await this.storage.createPresignedGetUrl({ objectKey: original.objectKey, expiresInSeconds });
    return {
      url,
      objectKey: original.objectKey,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }
}
