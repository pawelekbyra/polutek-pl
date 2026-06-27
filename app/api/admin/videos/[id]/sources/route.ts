import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { handleApiError, fromUseCaseResult } from "@/lib/api/api-response";
import { addVideoSource } from "@/lib/modules/video/application/add-video-source.use-case";
import { toAdminVideoAssetDto } from "@/lib/modules/video";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoRepository } from "@/lib/modules/video/infrastructure/video.repository";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_VIDEO_SOURCES");
  if (response) return response;

  try {
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const mainChannel = await MainChannelService.getRequired(ctx);
    const repository = new VideoRepository(ctx.prisma);
    const video = await repository.findByIdForMainChannel(params.id, mainChannel.id);
    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sources = video.assets.map((a: Parameters<typeof toAdminVideoAssetDto>[0]) => toAdminVideoAssetDto(a)).filter(Boolean);
    return NextResponse.json({ sources });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_SOURCE");
  if (response) return response;

  try {
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const body = await req.json();
    const { provider } = body;

    let input: Parameters<typeof addVideoSource>[0];

    if (provider === "YOUTUBE") {
      input = { provider: "YOUTUBE", videoId: params.id, youtubeUrl: body.youtubeUrl };
    } else if (provider === "CLOUDFLARE_STREAM") {
      input = { provider: "CLOUDFLARE_STREAM", videoId: params.id, providerAssetId: body.providerAssetId, providerPlaybackId: body.providerPlaybackId };
    } else if (provider === "R2") {
      input = { provider: "R2", videoId: params.id, bucket: body.bucket, objectKey: body.objectKey };
    } else if (provider === "MUX") {
      input = { provider: "MUX", videoId: params.id, providerAssetId: body.providerAssetId };
    } else {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    return fromUseCaseResult(await addVideoSource(input, ctx));
  } catch (error) {
    return handleApiError(error);
  }
}
