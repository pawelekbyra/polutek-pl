import { NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { updateAdminVideo, archiveAdminVideo, getCloudflareUploadUrl, attachCloudflareAsset, importLegacyVideoToCloudflare } from '@/lib/modules/video';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { VideoStatus, AccessTier } from '@prisma/client';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = await requireAdminForApi("PATCH_ADMIN_VIDEO");
  if (response) return response;

  const videoId = params.id;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const body = await req.json();

    const result = await updateAdminVideo({ ...body, id: videoId }, ctx);
    return fromUseCaseResult(result);
  } catch (error: any) {
    return fromUseCaseResult({ ok: false, error });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { response } = await requireAdminForApi("POST_ADMIN_VIDEO_ACTION");
    if (response) return response;

    const videoId = params.id;

    try {
        const actor = await getActorFromAuth();
        const ctx = createAppContext({ actor });
        const { action } = await req.json();

        switch (action) {
            case 'publish':
                return fromUseCaseResult(await updateAdminVideo({ id: videoId, status: VideoStatus.PUBLISHED }, ctx));
            case 'unpublish':
                return fromUseCaseResult(await updateAdminVideo({ id: videoId, status: VideoStatus.DRAFT }, ctx));
            case 'archive':
                return fromUseCaseResult(await archiveAdminVideo(videoId, ctx));
            case 'restore':
                return fromUseCaseResult(await updateAdminVideo({ id: videoId, status: VideoStatus.DRAFT }, ctx));
            case 'set-hero':
                return fromUseCaseResult(await updateAdminVideo({ id: videoId, isMainFeatured: true, status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC }, ctx));
            case 'create-upload-url':
                return fromUseCaseResult(await getCloudflareUploadUrl({ videoId }, ctx));
            case 'attach-asset':
                const { providerAssetId, providerPlaybackId, processingState } = await req.json();
                return fromUseCaseResult(await attachCloudflareAsset({ videoId, providerAssetId, providerPlaybackId, processingState }, ctx));
            case 'import-legacy-to-cloudflare':
                return fromUseCaseResult(await importLegacyVideoToCloudflare({ videoId }, ctx));
            default:
                return fromUseCaseResult({ ok: false, error: { code: 'INVALID_ACTION', message: `Action ${action} not supported`, statusCode: 400 } as any });
        }
    } catch (error: any) {
        return fromUseCaseResult({ ok: false, error });
    }
}
