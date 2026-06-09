import { createScopedLogger } from "@/lib/logger";
import { NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { reorderAdminVideos } from '@/lib/modules/video';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { response } = await requireAdminForApi("REORDER_ADMIN_VIDEOS");
  if (response) return response;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const body = await req.json();
    const { videos } = body;

    const result = await reorderAdminVideos(videos, ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
      return handleApiError(error);
  }
}
