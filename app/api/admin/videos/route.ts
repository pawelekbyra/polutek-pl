import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { getAdminVideoList, createAdminVideo, updateAdminVideo, archiveAdminVideo } from '@/lib/modules/video';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { parseVideoQueryParams } from '@/lib/services/admin/admin-query-parser';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_VIDEOS");
  if (response) return response;

  const actor = await getActorFromAuth();
  const ctx = createAppContext({ actor });
  const options = parseVideoQueryParams(req);

  try {
    const result = await getAdminVideoList({
        ...options,
        isMainFeatured: options.isMainFeatured === undefined ? 'ALL' : String(options.isMainFeatured),
        showInSidebar: options.showInSidebar === undefined ? 'ALL' : String(options.showInSidebar),
        migrationStatus: options.migrationStatus || 'ALL',
    }, ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_VIDEOS_ERROR]", error);
      return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("POST_ADMIN_VIDEOS");
  if (response) return response;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const body = await req.json();

    if (body.id) {
        const result = await updateAdminVideo(body, ctx);
        return fromUseCaseResult(result);
    } else {
        const result = await createAdminVideo(body, ctx);
        return fromUseCaseResult(result);
    }
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_VIDEO_POST_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("DELETE_ADMIN_VIDEOS");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
  }

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await archiveAdminVideo(id, ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_VIDEO_DELETE_ERROR]", error);
    return handleApiError(error);
  }
}
