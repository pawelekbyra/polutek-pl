import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult } from "@/lib/modules/shared/result";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { provisionCloudflareUpload } from "./provision-cloudflare-upload.use-case";

export interface GetCloudflareUploadUrlInput {
  videoId: string;
}

export interface CloudflareUploadUrlDto {
  uploadUrl: string;
  providerAssetId: string;
}

export async function getCloudflareUploadUrl(
  input: GetCloudflareUploadUrlInput,
  ctx: AppContext
): Promise<UseCaseResult<CloudflareUploadUrlDto, VideoNotFoundError | VideoNotOnMainChannelError | any>> {
  return provisionCloudflareUpload(input, ctx);
}
